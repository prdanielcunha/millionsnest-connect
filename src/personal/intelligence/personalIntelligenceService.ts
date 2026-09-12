import crypto from 'node:crypto';
import { CanonicalContextProvider, CanonicalCoreContext } from '../../core/runtime/connectCore';
import { FirestorePersonalVault, VaultDocument, VaultWrite } from '../storage/firestorePersonalVault';
import { normalizeIdentityName, normalizePhone } from '../radar/identityResolution';
import { RadarRequestContext } from '../radar/personalRadarService';
import { PersonalSourcesService } from '../sources/personalSourcesService';

const DAY_MS = 86_400_000;

export type IntelligenceEnvironment = Partial<Pick<NodeJS.ProcessEnv,
  | 'CONNECT_GOOGLE_DRIVE_IMPORT_ENABLED'
  | 'CONNECT_WHATSAPP_BUSINESS_ENABLED'
  | 'CONNECT_INSTAGRAM_PRO_ENABLED'
  | 'CONNECT_CHATGPT_TOOLS_ENABLED'>>;

export type AudienceDefinition = {
  sourceId?: string;
  query?: string;
  signalType?: string;
  activeWithinDays?: number;
  minMessages?: number;
  favoritesOnly?: boolean;
};

function nowIso(now: () => number) {
  return new Date(now()).toISOString();
}

function uniqueStrings(...values: unknown[]): string[] {
  const result: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value !== 'string') return;
    const clean = value.trim();
    if (clean && !result.includes(clean)) result.push(clean);
  };
  values.forEach(visit);
  return result;
}

function safeDate(value: unknown): number | null {
  if (typeof value !== 'string' || !value) return null;
  const parsed = Date.parse(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseVCard(content: string) {
  const unfolded = content.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const cards = unfolded.split(/END:VCARD/i).map(card => card.trim()).filter(card => /BEGIN:VCARD/i.test(card));
  return cards.slice(0, 5_000).map((card, index) => {
    const lines = card.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const valueFor = (prefix: string) => {
      const line = lines.find(item => item.toUpperCase().startsWith(prefix));
      return line ? line.slice(line.indexOf(':') + 1).trim() : '';
    };
    const valuesFor = (prefix: string) => lines
      .filter(item => item.toUpperCase().startsWith(prefix))
      .map(item => item.slice(item.indexOf(':') + 1).trim())
      .filter(Boolean);
    const fn = valueFor('FN');
    const rawName = fn || valueFor('N').split(';').filter(Boolean).reverse().join(' ');
    const phones = uniqueStrings(valuesFor('TEL').map(value => normalizePhone(value))).filter(Boolean);
    const emails = uniqueStrings(valuesFor('EMAIL').map(value => value.toLowerCase())).filter(value => value.includes('@'));
    const socialProfiles = uniqueStrings(valuesFor('X-SOCIALPROFILE'), valuesFor('URL'));
    const keyMaterial = phones[0] || emails[0] || `${normalizeIdentityName(rawName)}:${index}`;
    const id = `contact_${crypto.createHash('sha256').update(keyMaterial).digest('hex').slice(0, 24)}`;
    return {
      id,
      displayName: rawName || phones[0] || emails[0] || `Contato ${index + 1}`,
      normalizedName: normalizeIdentityName(rawName),
      phones,
      emails,
      socialProfiles,
    };
  }).filter(contact => contact.displayName && (contact.phones.length || contact.emails.length || contact.normalizedName));
}

function authoredBy(person: Record<string, unknown>, sender: string): boolean {
  const aliases = new Set(uniqueStrings(
    person.displayName,
    person.probableName,
    person.identityOriginalDisplayName,
    person.identityAliases,
    person.identityConfirmedAliases,
  ).map(normalizeIdentityName).filter(Boolean));
  const senderName = normalizeIdentityName(sender);
  if (senderName && aliases.has(senderName)) return true;
  const phone = normalizePhone(person.phone);
  const senderPhone = normalizePhone(sender);
  return Boolean(phone && senderPhone && phone === senderPhone);
}

function audienceScore(person: Record<string, unknown>): number {
  let score = 0;
  if (person.favorite) score += 100;
  if (person.manualPriority === 'priority') score += 50;
  else if (person.manualPriority === 'important') score += 25;
  if (person.effectivePotential === 'very_high') score += 30;
  else if (person.effectivePotential === 'high') score += 20;
  else if (person.effectivePotential === 'medium') score += 10;
  score += Math.min(20, Math.floor(Number(person.messageCount || 0) / 10));
  return score;
}

export class PersonalIntelligenceService {
  constructor(
    private readonly contextProvider: CanonicalContextProvider,
    private readonly vault: FirestorePersonalVault,
    private readonly sources: PersonalSourcesService,
    private readonly env: IntelligenceEnvironment = process.env,
    private readonly now: () => number = Date.now,
  ) {}

  private async resolveContext(input: RadarRequestContext): Promise<CanonicalCoreContext> {
    const resolution = await this.contextProvider.resolve({
      authToken: input.authToken,
      requestedOrganizationId: input.organizationId,
    });
    if (resolution.status !== 'resolved') throw new Error('RADAR_CONTEXT_DENIED');
    if (!resolution.context.globalAccess) throw new Error('RADAR_PILOT_FORBIDDEN');
    if (resolution.context.organizationId !== input.organizationId) throw new Error('RADAR_TENANT_MISMATCH');
    return resolution.context;
  }

  async getIdentityReview(request: RadarRequestContext) {
    const context = await this.resolveContext(request);
    const [radar, contacts] = await Promise.all([
      this.sources.getRadar(request),
      this.vault.list(request.authToken, context.actorUid, ['personalContacts'], 5_000),
    ]);
    const contactsByPhone = new Map<string, VaultDocument[]>();
    for (const contact of contacts) {
      for (const phone of uniqueStrings(contact.phones).map(normalizePhone).filter(Boolean)) {
        if (!contactsByPhone.has(phone)) contactsByPhone.set(phone, []);
        contactsByPhone.get(phone)!.push(contact);
      }
    }
    const items = (radar.people as Array<Record<string, unknown> & { id: string }>).flatMap(person => {
      const candidates = Array.isArray(person.identityReview) ? person.identityReview : [];
      const probableName = typeof person.probableName === 'string' ? person.probableName.trim() : '';
      const exactContacts = normalizePhone(person.phone) ? contactsByPhone.get(normalizePhone(person.phone)) || [] : [];
      const resolution = String(person.identityResolution || '');
      const needsReview = candidates.length > 0 || Boolean(probableName && !resolution.startsWith('user_confirmed')) || exactContacts.length > 0;
      if (!needsReview) return [];
      return [{
        personId: String(person.id),
        currentDisplayName: String(person.displayName || ''),
        probableName: probableName || null,
        probableNameConfidence: person.probableNameConfidence || 'none',
        probableNameScore: Number(person.probableNameScore || 0),
        resolution,
        phone: person.phone || null,
        evidence: Array.isArray(person.identityEvidence) ? person.identityEvidence : [],
        candidates,
        contactSuggestions: exactContacts.slice(0, 5).map(contact => ({
          contactId: contact.id,
          displayName: String(contact.displayName || ''),
          phones: uniqueStrings(contact.phones),
          emails: uniqueStrings(contact.emails),
          match: 'exact_phone',
        })),
        sources: Array.isArray(person.sources) ? person.sources : [],
      }];
    });
    items.sort((a, b) => {
      const aRank = a.candidates.length ? 0 : a.contactSuggestions.length ? 1 : 2;
      const bRank = b.candidates.length ? 0 : b.contactSuggestions.length ? 1 : 2;
      return aRank - bRank || b.probableNameScore - a.probableNameScore;
    });
    return { items, count: items.length };
  }

  async reviewProbableName(request: RadarRequestContext, personId: string, action: 'confirm' | 'reject') {
    const context = await this.resolveContext(request);
    const person = await this.vault.get(request.authToken, context.actorUid, ['personalPeople', personId]);
    if (!person) throw new Error('PERSON_NOT_FOUND');
    const probableName = typeof person.probableName === 'string' ? person.probableName.trim() : '';
    if (!probableName) throw new Error('PROBABLE_NAME_NOT_AVAILABLE');
    const normalized = normalizeIdentityName(probableName);
    const updatedAt = nowIso(this.now);
    const updated = action === 'confirm'
      ? {
          ...person,
          id: personId,
          identityOriginalDisplayName: person.identityOriginalDisplayName || person.displayName || null,
          displayName: probableName,
          normalizedName: normalized,
          identityAliases: uniqueStrings(person.identityAliases, person.displayName, probableName),
          identityConfirmedAliases: uniqueStrings(person.identityConfirmedAliases, normalized),
          identityResolution: 'user_confirmed_probable_name',
          identityConfidence: 100,
          identityReview: [],
          updatedAt,
        }
      : {
          ...person,
          id: personId,
          identityBlockedAliases: uniqueStrings(person.identityBlockedAliases, normalized),
          probableName: null,
          normalizedProbableName: '',
          probableNameConfidence: 'none',
          probableNameScore: 0,
          identityResolution: 'probable_name_rejected',
          identityReview: [],
          updatedAt,
        };
    await this.vault.writeMany(request.authToken, context.actorUid, [{ path: ['personalPeople', personId], data: updated }]);
    return { success: true, action, person: updated };
  }

  async getTimeline(request: RadarRequestContext, personId: string, limit = 240) {
    const context = await this.resolveContext(request);
    const radar = await this.sources.getRadar(request);
    const person = (radar.people as Array<Record<string, unknown> & { id: string }>).find(item => String(item.id) === personId);
    if (!person) throw new Error('PERSON_NOT_FOUND');
    const rawSourceIds = uniqueStrings(person.rawSourceIds, person.sourceIds, person.sourceId).filter(id => id.startsWith('wa_'));
    const sourceMap = new Map<string, { sourceId: string; label: string; kind: string }>();
    for (const source of (radar.conversations as Array<Record<string, unknown>>)) {
      for (const raw of uniqueStrings(source.rawSourceIds, source.sourceId)) {
        sourceMap.set(raw, { sourceId: String(source.sourceId || raw), label: String(source.label || 'WhatsApp'), kind: String(source.kind || 'unknown') });
      }
    }
    const items: Array<Record<string, unknown>> = [];
    for (const rawSourceId of rawSourceIds.slice(0, 240)) {
      const chunks = await this.vault.list(request.authToken, context.actorUid, ['personalConversations', rawSourceId, 'messageChunks'], 500);
      const source = sourceMap.get(rawSourceId) || { sourceId: rawSourceId, label: 'WhatsApp', kind: 'unknown' };
      for (const chunk of chunks) {
        const messages = Array.isArray(chunk.messages) ? chunk.messages as Array<Record<string, unknown>> : [];
        for (const message of messages) {
          const sender = String(message.sender || '');
          if (!authoredBy(person, sender)) continue;
          items.push({
            type: 'message',
            sourceId: source.sourceId,
            rawSourceId,
            sourceLabel: source.label,
            sourceKind: source.kind,
            sender,
            text: String(message.text || '').slice(0, 4_000),
            dateKey: String(message.dateKey || ''),
            timestampLocal: String(message.timestampLocal || ''),
          });
        }
      }
    }
    if (person.followUpAt) {
      items.push({
        type: 'follow_up',
        sourceId: '',
        sourceLabel: 'Connect',
        text: String(person.followUpNote || 'Follow-up programado'),
        dateKey: String(person.followUpAt).slice(0, 10),
        timestampLocal: String(person.followUpAt),
        status: person.followUpStatus || 'pending',
      });
    }
    items.sort((a, b) => String(b.timestampLocal || b.dateKey || '').localeCompare(String(a.timestampLocal || a.dateKey || '')));
    const capped = Math.max(20, Math.min(500, Number(limit) || 240));
    return { personId, items: items.slice(0, capped), count: Math.min(items.length, capped), totalAvailable: items.length };
  }

  async updateFollowUp(
    request: RadarRequestContext,
    personId: string,
    input: { action: 'schedule' | 'complete' | 'clear'; dueAt?: string; note?: string },
  ) {
    const context = await this.resolveContext(request);
    const person = await this.vault.get(request.authToken, context.actorUid, ['personalPeople', personId]);
    if (!person) throw new Error('PERSON_NOT_FOUND');
    const updatedAt = nowIso(this.now);
    let updated: Record<string, unknown>;
    if (input.action === 'schedule') {
      const dueMs = Date.parse(String(input.dueAt || ''));
      if (!Number.isFinite(dueMs) || dueMs < this.now() - DAY_MS || dueMs > this.now() + 730 * DAY_MS) throw new Error('FOLLOW_UP_DATE_INVALID');
      updated = {
        ...person,
        followUpAt: new Date(dueMs).toISOString(),
        followUpNote: String(input.note || '').trim().slice(0, 500),
        followUpStatus: 'pending',
        followUpUpdatedAt: updatedAt,
        updatedAt,
      };
    } else if (input.action === 'complete') {
      updated = {
        ...person,
        followUpAt: null,
        followUpStatus: 'completed',
        lastFollowUpCompletedAt: updatedAt,
        followUpUpdatedAt: updatedAt,
        updatedAt,
      };
    } else {
      updated = {
        ...person,
        followUpAt: null,
        followUpNote: '',
        followUpStatus: 'cleared',
        followUpUpdatedAt: updatedAt,
        updatedAt,
      };
    }
    await this.vault.writeMany(request.authToken, context.actorUid, [{ path: ['personalPeople', personId], data: updated }]);
    return { success: true, action: input.action, personId, followUpAt: updated.followUpAt || null, status: updated.followUpStatus };
  }

  async listFollowUps(request: RadarRequestContext) {
    const context = await this.resolveContext(request);
    const people = await this.vault.list(request.authToken, context.actorUid, ['personalPeople'], 1_500);
    const items = people
      .filter(person => person.followUpStatus === 'pending' && safeDate(person.followUpAt) !== null)
      .map(person => ({
        personId: person.id,
        displayName: String(person.probableName || person.displayName || ''),
        phone: person.phone || null,
        dueAt: String(person.followUpAt || ''),
        note: String(person.followUpNote || ''),
        overdue: (safeDate(person.followUpAt) || Infinity) < this.now(),
      }))
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    return { items, count: items.length, overdueCount: items.filter(item => item.overdue).length };
  }

  async previewAudience(request: RadarRequestContext, definition: AudienceDefinition = {}) {
    await this.resolveContext(request);
    const radar = await this.sources.getRadar(request);
    const sourceId = String(definition.sourceId || '').trim();
    const query = String(definition.query || '').trim();
    const signalType = String(definition.signalType || '').trim();
    const activeWithinDays = definition.activeWithinDays === undefined ? 0 : Math.max(0, Math.min(3650, Number(definition.activeWithinDays) || 0));
    const minMessages = Math.max(0, Math.min(100_000, Number(definition.minMessages) || 0));
    let matchedSenders = new Set<string>();
    let queryEvidence = new Map<string, Array<Record<string, unknown>>>();
    if (query.length >= 2) {
      const search = await this.sources.search(request, query);
      for (const match of search.matches as Array<Record<string, unknown>>) {
        if (sourceId && String(match.sourceId || '') !== sourceId) continue;
        const sender = normalizeIdentityName(match.sender);
        if (!sender) continue;
        matchedSenders.add(sender);
        if (!queryEvidence.has(sender)) queryEvidence.set(sender, []);
        queryEvidence.get(sender)!.push(match);
      }
    }
    const threshold = activeWithinDays ? this.now() - activeWithinDays * DAY_MS : 0;
    const items = (radar.people as Array<Record<string, unknown> & { id: string }>).filter(person => {
      if (person.notRelevant || person.radarState === 'ignored') return false;
      if (definition.favoritesOnly && !person.favorite) return false;
      if (sourceId && !uniqueStrings(person.sourceIds).includes(sourceId)) return false;
      if (Number(person.messageCount || 0) < minMessages) return false;
      if (activeWithinDays) {
        const last = safeDate(person.lastDateKey);
        if (!last || last < threshold) return false;
      }
      if (signalType) {
        const signals = Array.isArray(person.signals) ? person.signals as Array<Record<string, unknown>> : [];
        if (!signals.some(signal => String(signal.type || '') === signalType)) return false;
      }
      if (query.length >= 2) {
        const aliases = uniqueStrings(person.displayName, person.probableName, person.identityAliases).map(normalizeIdentityName);
        if (!aliases.some(alias => matchedSenders.has(alias))) return false;
      }
      return true;
    }).map(person => {
      const alias = uniqueStrings(person.displayName, person.probableName, person.identityAliases)
        .map(normalizeIdentityName).find(value => matchedSenders.has(value));
      return {
        personId: String(person.id),
        displayName: String(person.probableName || person.displayName || ''),
        phone: person.phone || null,
        sourceIds: uniqueStrings(person.sourceIds),
        messageCount: Number(person.messageCount || 0),
        lastDateKey: person.lastDateKey || null,
        favorite: Boolean(person.favorite),
        manualPriority: person.manualPriority || 'normal',
        effectivePotential: person.effectivePotential || person.automaticPotential || 'unknown',
        score: audienceScore(person),
        evidence: alias ? (queryEvidence.get(alias) || []).slice(0, 3) : [],
        signals: Array.isArray(person.signals) ? (person.signals as Array<Record<string, unknown>>).slice(0, 3) : [],
      };
    }).sort((a, b) => b.score - a.score || String(b.lastDateKey || '').localeCompare(String(a.lastDateKey || ''))).slice(0, 250);
    return { definition: { ...definition, sourceId: sourceId || undefined, query: query || undefined }, items, count: items.length };
  }

  async listAudiences(request: RadarRequestContext) {
    const context = await this.resolveContext(request);
    const documents = await this.vault.list(request.authToken, context.actorUid, ['personalAudiences'], 250);
    const items = documents.map(item => ({
      id: item.id,
      name: String(item.name || ''),
      definition: item.definition || {},
      createdAt: String(item.createdAt || ''),
      updatedAt: String(item.updatedAt || item.createdAt || ''),
    })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { items, count: items.length };
  }

  async saveAudience(request: RadarRequestContext, input: { id?: string; name: string; definition: AudienceDefinition }) {
    const context = await this.resolveContext(request);
    const name = String(input.name || '').trim().slice(0, 120);
    if (!name) throw new Error('AUDIENCE_NAME_REQUIRED');
    const id = input.id?.trim() || `aud_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    if (!/^aud_[A-Za-z0-9_-]{6,80}$/.test(id)) throw new Error('AUDIENCE_ID_INVALID');
    const existing = await this.vault.get(request.authToken, context.actorUid, ['personalAudiences', id]);
    const stamp = nowIso(this.now);
    const record = {
      id,
      ownerUid: context.actorUid,
      name,
      definition: input.definition || {},
      privacyScope: 'owner_only',
      createdAt: String(existing?.createdAt || stamp),
      updatedAt: stamp,
    };
    await this.vault.writeMany(request.authToken, context.actorUid, [{ path: ['personalAudiences', id], data: record }]);
    return { success: true, audience: record };
  }

  async deleteAudience(request: RadarRequestContext, audienceId: string) {
    const context = await this.resolveContext(request);
    await this.vault.deleteMany(request.authToken, context.actorUid, [['personalAudiences', audienceId]]);
    return { success: true, audienceId };
  }

  async importVCard(request: RadarRequestContext, input: { fileName: string; contentBase64: string }) {
    const context = await this.resolveContext(request);
    const fileName = String(input.fileName || '').trim().slice(0, 240);
    if (!/\.vcf$/i.test(fileName)) throw new Error('VCARD_FILE_TYPE_INVALID');
    if (!input.contentBase64 || input.contentBase64.length > 4_000_000) throw new Error('VCARD_PAYLOAD_INVALID');
    const bytes = Buffer.from(input.contentBase64, 'base64');
    if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error('VCARD_FILE_SIZE_INVALID');
    const contacts = parseVCard(bytes.toString('utf8'));
    if (!contacts.length) throw new Error('VCARD_EMPTY');
    const stamp = nowIso(this.now);
    const writes: VaultWrite[] = contacts.map(contact => ({
      path: ['personalContacts', contact.id],
      data: {
        ...contact,
        ownerUid: context.actorUid,
        source: 'vcard',
        latestFileName: fileName,
        importedAt: stamp,
        privacyScope: 'owner_only',
      },
    }));
    const people = await this.vault.list(request.authToken, context.actorUid, ['personalPeople'], 1_500);
    const peopleByPhone = new Map<string, VaultDocument[]>();
    for (const person of people) {
      const phone = normalizePhone(person.phone);
      if (!phone) continue;
      if (!peopleByPhone.has(phone)) peopleByPhone.set(phone, []);
      peopleByPhone.get(phone)!.push(person);
    }
    let matchedPeople = 0;
    for (const contact of contacts) {
      for (const phone of contact.phones) {
        for (const person of peopleByPhone.get(phone) || []) {
          matchedPeople += 1;
          const suggestions = Array.isArray(person.contactSuggestions) ? person.contactSuggestions as Array<Record<string, unknown>> : [];
          const next = [
            { contactId: contact.id, displayName: contact.displayName, phone, emails: contact.emails, source: 'vcard', match: 'exact_phone' },
            ...suggestions.filter(item => String(item.contactId || '') !== contact.id),
          ].slice(0, 8);
          writes.push({
            path: ['personalPeople', person.id],
            data: {
              ...person,
              contactSuggestions: next,
              identityResolution: String(person.identityResolution || '').startsWith('user_confirmed')
                ? person.identityResolution
                : 'contact_match_available',
              updatedAt: stamp,
            },
          });
        }
      }
    }
    const importId = `vcf_${crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 24)}`;
    writes.push({
      path: ['personalContactImports', importId],
      data: { id: importId, ownerUid: context.actorUid, fileName, contactCount: contacts.length, matchedPeople, createdAt: stamp, privacyScope: 'owner_only' },
    });
    await this.vault.writeMany(request.authToken, context.actorUid, writes);
    return { success: true, contactCount: contacts.length, matchedPeople, importId };
  }

  async getImportHealth(request: RadarRequestContext) {
    const context = await this.resolveContext(request);
    const [sources, runs, contactRuns] = await Promise.all([
      this.sources.listSources(request),
      this.vault.list(request.authToken, context.actorUid, ['personalImportRunsV2'], 800),
      this.vault.list(request.authToken, context.actorUid, ['personalContactImports'], 300),
    ]);
    const staleBefore = this.now() - 30 * DAY_MS;
    const staleSources = sources.sources.filter(source => {
      const time = safeDate(source.lastImportedAt || source.updatedAt || source.createdAt);
      return time !== null && time < staleBefore;
    }).length;
    const lastRunAt = runs.map(run => String(run.createdAt || '')).sort().reverse()[0] || null;
    return {
      status: sources.count === 0 && contactRuns.length === 0 ? 'empty' : staleSources > 0 ? 'attention' : 'healthy',
      totals: {
        conversations: sources.count,
        imports: runs.length,
        contactImports: contactRuns.length,
        staleSources,
      },
      lastRunAt,
      items: sources.sources.slice(0, 100).map(source => ({
        sourceId: source.sourceId,
        label: source.label,
        lastImportedAt: source.lastImportedAt || source.updatedAt || source.createdAt,
        importCount: source.importCount || 1,
        lastAddedMessageCount: source.lastAddedMessageCount || 0,
        stale: (() => {
          const time = safeDate(source.lastImportedAt || source.updatedAt || source.createdAt);
          return time !== null && time < staleBefore;
        })(),
      })),
    };
  }

  async getCapabilities(request: RadarRequestContext) {
    await this.resolveContext(request);
    const enabled = (value: string | undefined) => value?.trim().toLowerCase() === 'true';
    return {
      connectors: [
        { id: 'vcard', label: 'iPhone / vCard', status: 'ready', connected: true, mode: 'manual_upload' },
        { id: 'ios_shortcut', label: 'iOS Shortcut / Share Sheet', status: 'api_ready', connected: false, mode: 'user_authorized_handoff' },
        { id: 'google_drive', label: 'Google Drive Import Inbox', status: enabled(this.env.CONNECT_GOOGLE_DRIVE_IMPORT_ENABLED) ? 'enabled' : 'needs_authorization', connected: enabled(this.env.CONNECT_GOOGLE_DRIVE_IMPORT_ENABLED), mode: 'provider_adapter' },
        { id: 'whatsapp_business', label: 'WhatsApp Business oficial', status: enabled(this.env.CONNECT_WHATSAPP_BUSINESS_ENABLED) ? 'enabled' : 'needs_authorization', connected: enabled(this.env.CONNECT_WHATSAPP_BUSINESS_ENABLED), mode: 'official_channel_only' },
        { id: 'instagram_pro', label: 'Instagram Professional', status: enabled(this.env.CONNECT_INSTAGRAM_PRO_ENABLED) ? 'enabled' : 'needs_authorization', connected: enabled(this.env.CONNECT_INSTAGRAM_PRO_ENABLED), mode: 'official_api_only' },
        { id: 'chatgpt_tools', label: 'Connect ↔ ChatGPT', status: 'api_ready', connected: enabled(this.env.CONNECT_CHATGPT_TOOLS_ENABLED), mode: 'authenticated_tool_gateway' },
      ],
      safety: {
        personalWhatsAppScraping: false,
        automaticMassSend: false,
        personalToOrganizationAutoPromotion: false,
      },
    };
  }

  async toolSearchPeople(request: RadarRequestContext, input: AudienceDefinition) {
    const preview = await this.previewAudience(request, input);
    return { people: preview.items, count: preview.count, evidencePolicy: 'source_aware' };
  }

  async toolGetPersonContext(request: RadarRequestContext, personId: string) {
    const [context, timeline] = await Promise.all([
      this.sources.getPersonContext(request, personId),
      this.getTimeline(request, personId, 120),
    ]);
    return { ...context, timeline: timeline.items, automaticSend: false };
  }
}