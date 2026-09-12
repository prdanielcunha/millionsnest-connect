import crypto from 'node:crypto';
import { CanonicalContextProvider, CanonicalCoreContext } from '../../core/runtime/connectCore';
import { FirestorePersonalVault, VaultWrite } from '../storage/firestorePersonalVault';
import { extractWhatsAppText, parseWhatsAppExport, ParsedWhatsAppMessage } from '../whatsapp/whatsappExport';
import { deriveRadarPeople, RadarPerson, RadarSignal } from './radarSignals';
import { buildComposerPlan, ComposerChannel, ComposerObjective, ComposerStyle } from './composerPlaybook';
import {
  automaticPotentialFromPriority,
  compareIdentity,
  manualPriorityRank,
  mergeSignals,
  newPersonDocumentId,
  normalizeIdentityName,
  normalizePhone,
  potentialRank,
  safeEffectivePotential,
  uniqueStrings,
  ManualPriority,
  PotentialLevel,
} from './identityResolution';

export type RadarComposerTone = 'curto' | 'conversa' | 'audio' | 'video';

export interface PersonalRadarLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn?(message: string, meta?: Record<string, unknown>): void;
  error?(message: string, meta?: Record<string, unknown>): void;
}

export type RadarRequestContext = {
  authToken: string;
  organizationId: string;
};

const DAY_MS = 86_400_000;

function isoNow(now: () => number): string {
  return new Date(now()).toISOString();
}

function sourceIdFromText(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  return `wa_${crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 24)}`;
}

function safeBase64(value: unknown): Buffer {
  if (typeof value !== 'string' || !value || value.length > 8_000_000) throw new Error('IMPORT_PAYLOAD_INVALID');
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(value)) throw new Error('IMPORT_PAYLOAD_INVALID');
  const bytes = Buffer.from(value, 'base64');
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('IMPORT_FILE_SIZE_INVALID');
  return bytes;
}

function normalizeSelfNames(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim())
    .filter(Boolean)
    .slice(0, 8)));
}

function chunkMessages(messages: ParsedWhatsAppMessage[], size = 100): ParsedWhatsAppMessage[][] {
  const chunks: ParsedWhatsAppMessage[][] = [];
  for (let i = 0; i < messages.length; i += size) chunks.push(messages.slice(i, i + size));
  return chunks;
}

function signalPriority(signal: RadarSignal): number {
  const rank: Record<RadarSignal['type'], number> = {
    explicit_product_interest: 0,
    commercial_followup_due: 1,
    unanswered_conversation: 2,
    recurring_relevant_topic: 3,
  };
  return rank[signal.type];
}

function personPriority(person: RadarPerson): number {
  return person.signals.length ? Math.min(...person.signals.map(signalPriority)) : 99;
}

function legacyComposerPreferences(tone: RadarComposerTone): { style?: ComposerStyle; channel?: ComposerChannel; objective?: ComposerObjective } {
  if (tone === 'audio') return { channel: 'audio', style: 'proximo' };
  if (tone === 'video') return { channel: 'texto', objective: 'pedir_video', style: 'amigavel' };
  if (tone === 'conversa') return { channel: 'texto', objective: 'descobrir_dor', style: 'consultivo' };
  return { channel: 'texto', style: 'objetivo' };
}

function isActivelySnoozed(person: Record<string, unknown>, nowMs: number): boolean {
  if (person.radarState !== 'snoozed') return false;
  const untilMs = Date.parse(String(person.snoozedUntil || ''));
  return Number.isFinite(untilMs) && untilMs > nowMs;
}

function resolveSnoozeDays(value: unknown): number {
  const days = value === undefined ? 7 : Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('SNOOZE_DAYS_INVALID');
  return days;
}

function latestDate(a: unknown, b: unknown): string | null {
  const left = typeof a === 'string' ? a : '';
  const right = typeof b === 'string' ? b : '';
  return left >= right ? (left || null) : (right || null);
}

function earliestDate(a: unknown, b: unknown): string | null {
  const values = [a, b].filter((value): value is string => typeof value === 'string' && Boolean(value));
  if (!values.length) return null;
  return values.sort()[0];
}

function validPotential(value: unknown): PotentialLevel | undefined {
  return ['very_high', 'high', 'medium', 'low', 'unknown'].includes(String(value))
    ? value as PotentialLevel
    : undefined;
}

function validManualPriority(value: unknown): ManualPriority | undefined {
  return ['normal', 'important', 'priority'].includes(String(value))
    ? value as ManualPriority
    : undefined;
}

export class PersonalRadarService {
  constructor(
    private readonly contextProvider: CanonicalContextProvider,
    private readonly vault: FirestorePersonalVault,
    private readonly now: () => number = Date.now,
    private readonly logger: PersonalRadarLogger = console,
  ) {}

  private async resolvePilotContext(input: RadarRequestContext): Promise<CanonicalCoreContext> {
    const resolution = await this.contextProvider.resolve({
      authToken: input.authToken,
      requestedOrganizationId: input.organizationId,
    });
    if (resolution.status !== 'resolved') throw new Error('RADAR_CONTEXT_DENIED');
    if (!resolution.context.globalAccess) throw new Error('RADAR_PILOT_FORBIDDEN');
    if (resolution.context.organizationId !== input.organizationId) throw new Error('RADAR_TENANT_MISMATCH');
    return resolution.context;
  }

  async importWhatsApp(
    request: RadarRequestContext,
    input: { fileName: string; contentBase64: string; selfNames?: string[] },
  ) {
    const context = await this.resolvePilotContext(request);
    const fileName = typeof input.fileName === 'string' ? input.fileName.trim().slice(0, 240) : '';
    if (!fileName) throw new Error('IMPORT_FILENAME_REQUIRED');
    const bytes = safeBase64(input.contentBase64);
    const text = extractWhatsAppText(fileName, bytes);
    const sourceId = sourceIdFromText(text);
    const existingSource = await this.vault.get(request.authToken, context.actorUid, ['personalSources', sourceId]);
    if (existingSource) {
      return {
        status: 'deduplicated' as const,
        sourceId,
        messageCount: Number(existingSource.messageCount || 0),
        participantCount: Number(existingSource.participantCount || 0),
        radarCount: Number(existingSource.radarCount || 0),
        mergedPeopleCount: 0,
        identityReviewCount: 0,
      };
    }

    const parsed = parseWhatsAppExport(text);
    const selfNames = normalizeSelfNames(input.selfNames);
    const people = deriveRadarPeople({ messages: parsed.messages, selfNames }).slice(0, 250);
    const createdAt = isoNow(this.now);
    const chunks = chunkMessages(parsed.messages);
    const existingPeople = await this.vault.list(request.authToken, context.actorUid, ['personalPeople'], 1_500);
    const workingPeople: Array<Record<string, unknown> & { id: string }> = existingPeople.map(person => ({ ...person }));
    const peopleWrites: VaultWrite[] = [];
    let mergedPeopleCount = 0;
    let identityReviewCount = 0;

    for (const person of people) {
      const rankedMatches = workingPeople
        .map(existing => ({ existing, match: compareIdentity(person, existing) }))
        .filter(item => item.match.kind !== 'none')
        .sort((a, b) => b.match.confidence - a.match.confidence);

      const strong = rankedMatches.find(item => item.match.kind === 'strong');
      const ambiguous = rankedMatches
        .filter(item => item.match.kind === 'ambiguous')
        .slice(0, 3)
        .map(item => ({
          personId: String(item.existing.id),
          displayName: String(item.existing.displayName || ''),
          confidence: item.match.confidence,
          reasons: item.match.reasons,
        }));

      const priority = personPriority(person);
      const automaticPotential = automaticPotentialFromPriority(priority);

      if (strong) {
        const existing = strong.existing;
        const merged: Record<string, unknown> & { id: string } = {
          ...existing,
          id: String(existing.id),
          displayName: String(existing.displayName || person.displayName),
          normalizedName: String(existing.normalizedName || person.normalizedName),
          phone: normalizePhone(existing.phone) || normalizePhone(person.phone),
          messageCount: Number(existing.messageCount || 0) + person.messageCount,
          firstDateKey: earliestDate(existing.firstDateKey, person.firstDateKey),
          lastDateKey: latestDate(existing.lastDateKey, person.lastDateKey),
          signals: mergeSignals(existing.signals, person.signals),
          sourceId: String(existing.sourceId || sourceId),
          sourceIds: uniqueStrings(existing.sourceIds, existing.sourceId, sourceId),
          identityAliases: uniqueStrings(existing.identityAliases, existing.displayName, person.displayName),
          identityConfirmedAliases: uniqueStrings(existing.identityConfirmedAliases, person.normalizedName),
          identityConfidence: strong.match.confidence,
          identityResolution: 'auto_strong_match',
          identityReview: [],
          priority: Math.min(Number(existing.priority ?? 99), priority),
          automaticPotential: potentialRank(existing.automaticPotential) <= potentialRank(automaticPotential)
            ? existing.automaticPotential || automaticPotential
            : automaticPotential,
          favorite: Boolean(existing.favorite),
          manualPriority: validManualPriority(existing.manualPriority) || 'normal',
          manualPotential: validPotential(existing.manualPotential) || null,
          notRelevant: Boolean(existing.notRelevant),
          radarState: existing.radarState || 'active',
          snoozedUntil: existing.snoozedUntil || null,
          importedAt: existing.importedAt || createdAt,
          updatedAt: createdAt,
        };
        peopleWrites.push({ path: ['personalPeople', String(existing.id)], data: merged });
        const index = workingPeople.findIndex(item => item.id === existing.id);
        if (index >= 0) workingPeople[index] = merged;
        mergedPeopleCount += 1;
        continue;
      }

      const documentId = newPersonDocumentId(sourceId, person);
      if (ambiguous.length) identityReviewCount += 1;
      const record: Record<string, unknown> & { id: string } = {
        ...person,
        id: documentId,
        sourceId,
        sourceIds: [sourceId],
        ownerUid: context.actorUid,
        importedAt: createdAt,
        radarState: 'active',
        snoozedUntil: null,
        priority,
        automaticPotential,
        manualPotential: null,
        manualPriority: 'normal',
        favorite: false,
        notRelevant: false,
        identityAliases: [person.displayName],
        identityConfirmedAliases: [],
        identityBlockedAliases: [],
        identityConfidence: ambiguous.length ? ambiguous[0].confidence : 0,
        identityResolution: ambiguous.length ? 'needs_review' : 'new_person',
        identityReview: ambiguous,
      };
      peopleWrites.push({ path: ['personalPeople', documentId], data: record });
      workingPeople.push(record);
    }

    const writes: VaultWrite[] = [
      {
        path: ['personalSources', sourceId],
        data: {
          id: sourceId,
          type: 'whatsapp_export',
          fileName,
          ownerUid: context.actorUid,
          createdAt,
          firstDateKey: parsed.firstDateKey,
          lastDateKey: parsed.lastDateKey,
          messageCount: parsed.messages.length,
          participantCount: parsed.participants.length,
          radarCount: people.length,
          mergedPeopleCount,
          identityReviewCount,
          sourceHash: sourceId.replace(/^wa_/, ''),
          organizationHint: request.organizationId,
          privacyScope: 'owner_only',
        },
      },
      {
        path: ['importRuns', sourceId],
        data: {
          id: sourceId,
          sourceId,
          ownerUid: context.actorUid,
          status: 'completed',
          createdAt,
          messageCount: parsed.messages.length,
          participantCount: parsed.participants.length,
          radarCount: people.length,
          mergedPeopleCount,
          identityReviewCount,
        },
      },
      {
        path: ['personalConversations', sourceId],
        data: {
          id: sourceId,
          sourceId,
          ownerUid: context.actorUid,
          fileName,
          createdAt,
          firstDateKey: parsed.firstDateKey,
          lastDateKey: parsed.lastDateKey,
          participantNames: parsed.participants.slice(0, 300),
          messageCount: parsed.messages.length,
          selfNames,
        },
      },
      ...chunks.map((messages, index) => ({
        path: ['personalConversations', sourceId, 'messageChunks', String(index).padStart(4, '0')],
        data: { sourceId, chunkIndex: index, messages },
      })),
      ...peopleWrites,
    ];

    await this.vault.writeMany(request.authToken, context.actorUid, writes);
    this.logger.info('RADAR_WHATSAPP_IMPORT_COMPLETED', {
      sourceId,
      actorUid: context.actorUid.slice(0, 4) + '***',
      messageCount: parsed.messages.length,
      participantCount: parsed.participants.length,
      radarCount: people.length,
      mergedPeopleCount,
      identityReviewCount,
    });

    return {
      status: 'imported' as const,
      sourceId,
      messageCount: parsed.messages.length,
      participantCount: parsed.participants.length,
      radarCount: people.length,
      mergedPeopleCount,
      identityReviewCount,
    };
  }

  async getRadar(request: RadarRequestContext) {
    const context = await this.resolvePilotContext(request);
    const people = await this.vault.list(request.authToken, context.actorUid, ['personalPeople'], 1_500);
    const nowMs = this.now();
    const visible: Array<Record<string, unknown> & { id: string; effectivePotential: PotentialLevel }> = people
      .filter(person => person.radarState !== 'ignored' && !isActivelySnoozed(person, nowMs) && !person.notRelevant)
      .map(person => ({ ...(person as Record<string, unknown> & { id: string }), effectivePotential: safeEffectivePotential(person) }));
    visible.sort((a, b) => {
      const favorite = Number(Boolean(b.favorite)) - Number(Boolean(a.favorite));
      if (favorite !== 0) return favorite;
      const manual = manualPriorityRank(a.manualPriority) - manualPriorityRank(b.manualPriority);
      if (manual !== 0) return manual;
      const potential = potentialRank(a.effectivePotential) - potentialRank(b.effectivePotential);
      if (potential !== 0) return potential;
      const rank = Number(a.priority ?? 99) - Number(b.priority ?? 99);
      if (rank !== 0) return rank;
      return String(b.lastDateKey || '').localeCompare(String(a.lastDateKey || ''));
    });
    return { people: visible, count: visible.length };
  }

  async search(request: RadarRequestContext, rawQuery: string) {
    const context = await this.resolvePilotContext(request);
    const query = rawQuery.trim().toLocaleLowerCase('pt-BR');
    if (query.length < 2 || query.length > 120) throw new Error('SEARCH_QUERY_INVALID');
    const conversations = await this.vault.list(request.authToken, context.actorUid, ['personalConversations'], 80);
    const matches: Array<Record<string, unknown>> = [];

    for (const conversation of conversations) {
      if (matches.length >= 100) break;
      const sourceId = String(conversation.sourceId || conversation.id || '');
      if (!sourceId) continue;
      const chunks = await this.vault.list(
        request.authToken,
        context.actorUid,
        ['personalConversations', sourceId, 'messageChunks'],
        400,
      );
      for (const chunk of chunks) {
        const messages = Array.isArray(chunk.messages) ? chunk.messages : [];
        for (const message of messages as any[]) {
          const haystack = `${message?.sender || ''} ${message?.text || ''}`.toLocaleLowerCase('pt-BR');
          if (!haystack.includes(query)) continue;
          matches.push({
            sourceId,
            sender: String(message?.sender || ''),
            dateKey: String(message?.dateKey || ''),
            timestampLocal: String(message?.timestampLocal || ''),
            snippet: String(message?.text || '').replace(/\s+/g, ' ').trim().slice(0, 300),
          });
          if (matches.length >= 100) break;
        }
        if (matches.length >= 100) break;
      }
    }
    return { query: rawQuery.trim(), matches };
  }

  async updatePerson(
    request: RadarRequestContext,
    personDocumentId: string,
    input: {
      phone?: string | null;
      radarState?: 'active' | 'ignored' | 'snoozed';
      snoozeDays?: number;
      favorite?: boolean;
      manualPriority?: ManualPriority;
      manualPotential?: PotentialLevel | null;
      notRelevant?: boolean;
    },
  ) {
    const context = await this.resolvePilotContext(request);
    const person = await this.vault.get(request.authToken, context.actorUid, ['personalPeople', personDocumentId]);
    if (!person) throw new Error('PERSON_NOT_FOUND');
    const digits = input.phone === undefined ? undefined : normalizePhone(input.phone);
    if (typeof input.phone === 'string' && input.phone.trim() && !digits) throw new Error('PHONE_INVALID');
    const radarState = input.radarState && ['active', 'ignored', 'snoozed'].includes(input.radarState)
      ? input.radarState
      : String(person.radarState || 'active');

    let snoozedUntil = person.snoozedUntil || null;
    if (input.radarState === 'snoozed') {
      const days = resolveSnoozeDays(input.snoozeDays);
      snoozedUntil = new Date(this.now() + days * DAY_MS).toISOString();
    } else if (input.radarState === 'active' || input.radarState === 'ignored') {
      snoozedUntil = null;
    }

    const manualPriority = input.manualPriority === undefined
      ? validManualPriority(person.manualPriority) || 'normal'
      : validManualPriority(input.manualPriority);
    if (!manualPriority) throw new Error('MANUAL_PRIORITY_INVALID');
    const requestedPotential = input.manualPotential === null ? null : validPotential(input.manualPotential);
    if (input.manualPotential !== undefined && input.manualPotential !== null && !requestedPotential) {
      throw new Error('MANUAL_POTENTIAL_INVALID');
    }

    const updated: Record<string, unknown> & { id: string } = {
      ...person,
      id: personDocumentId,
      phone: digits === undefined ? person.phone || null : digits,
      radarState,
      snoozedUntil,
      favorite: input.favorite === undefined ? Boolean(person.favorite) : input.favorite,
      manualPriority,
      manualPotential: input.manualPotential === undefined ? person.manualPotential || null : requestedPotential,
      notRelevant: input.notRelevant === undefined ? Boolean(person.notRelevant) : input.notRelevant,
      updatedAt: isoNow(this.now),
    };
    await this.vault.writeMany(request.authToken, context.actorUid, [{ path: ['personalPeople', personDocumentId], data: updated }]);
    return {
      success: true,
      radarState,
      snoozedUntil,
      person: { ...updated, effectivePotential: safeEffectivePotential(updated) },
    };
  }

  async resolveIdentity(
    request: RadarRequestContext,
    personDocumentId: string,
    candidatePersonId: string,
    action: 'merge' | 'keep_separate',
  ) {
    const context = await this.resolvePilotContext(request);
    if (personDocumentId === candidatePersonId) throw new Error('IDENTITY_SAME_PERSON');
    const [source, target] = await Promise.all([
      this.vault.get(request.authToken, context.actorUid, ['personalPeople', personDocumentId]),
      this.vault.get(request.authToken, context.actorUid, ['personalPeople', candidatePersonId]),
    ]);
    if (!source || !target) throw new Error('PERSON_NOT_FOUND');
    const now = isoNow(this.now);

    if (action === 'keep_separate') {
      const sourceName = normalizeIdentityName(source.normalizedName || source.displayName);
      const targetName = normalizeIdentityName(target.normalizedName || target.displayName);
      await this.vault.writeMany(request.authToken, context.actorUid, [
        {
          path: ['personalPeople', personDocumentId],
          data: {
            ...source,
            identityBlockedAliases: uniqueStrings(source.identityBlockedAliases, targetName),
            identityResolution: 'confirmed_separate',
            identityReview: [],
            updatedAt: now,
          },
        },
        {
          path: ['personalPeople', candidatePersonId],
          data: {
            ...target,
            identityBlockedAliases: uniqueStrings(target.identityBlockedAliases, sourceName),
            updatedAt: now,
          },
        },
      ]);
      return { success: true, action, personId: personDocumentId };
    }

    const mergeId = `merge_${crypto.randomUUID()}`;
    const merged = {
      ...target,
      id: candidatePersonId,
      phone: normalizePhone(target.phone) || normalizePhone(source.phone),
      messageCount: Number(target.messageCount || 0) + Number(source.messageCount || 0),
      firstDateKey: earliestDate(target.firstDateKey, source.firstDateKey),
      lastDateKey: latestDate(target.lastDateKey, source.lastDateKey),
      signals: mergeSignals(target.signals, Array.isArray(source.signals) ? source.signals as RadarSignal[] : []),
      sourceIds: uniqueStrings(target.sourceIds, target.sourceId, source.sourceIds, source.sourceId),
      identityAliases: uniqueStrings(target.identityAliases, target.displayName, source.identityAliases, source.displayName),
      identityConfirmedAliases: uniqueStrings(
        target.identityConfirmedAliases,
        normalizeIdentityName(target.normalizedName || target.displayName),
        normalizeIdentityName(source.normalizedName || source.displayName),
      ),
      identityConfidence: 100,
      identityResolution: 'user_confirmed_merge',
      identityReview: [],
      favorite: Boolean(target.favorite) || Boolean(source.favorite),
      manualPriority: manualPriorityRank(source.manualPriority) < manualPriorityRank(target.manualPriority)
        ? source.manualPriority
        : target.manualPriority,
      manualPotential: potentialRank(safeEffectivePotential(source)) < potentialRank(safeEffectivePotential(target))
        ? source.manualPotential || safeEffectivePotential(source)
        : target.manualPotential || safeEffectivePotential(target),
      notRelevant: Boolean(target.notRelevant) && Boolean(source.notRelevant),
      priority: Math.min(Number(target.priority ?? 99), Number(source.priority ?? 99)),
      automaticPotential: potentialRank(target.automaticPotential) <= potentialRank(source.automaticPotential)
        ? target.automaticPotential
        : source.automaticPotential,
      updatedAt: now,
    };

    await this.vault.writeMany(request.authToken, context.actorUid, [
      { path: ['personalPeople', candidatePersonId], data: merged },
      {
        path: ['identityMergeHistory', mergeId],
        data: {
          id: mergeId,
          sourcePersonId: personDocumentId,
          targetPersonId: candidatePersonId,
          sourceBefore: source,
          targetBefore: target,
          status: 'merged',
          createdAt: now,
          ownerUid: context.actorUid,
        },
      },
    ]);
    await this.vault.deleteMany(request.authToken, context.actorUid, [['personalPeople', personDocumentId]]);
    return { success: true, action, personId: candidatePersonId, mergeId };
  }

  async undoIdentityMerge(request: RadarRequestContext, mergeId: string) {
    const context = await this.resolvePilotContext(request);
    const history = await this.vault.get(request.authToken, context.actorUid, ['identityMergeHistory', mergeId]);
    if (!history || history.status !== 'merged') throw new Error('IDENTITY_MERGE_NOT_FOUND');
    const sourceBefore = history.sourceBefore as Record<string, unknown> | undefined;
    const targetBefore = history.targetBefore as Record<string, unknown> | undefined;
    const sourcePersonId = String(history.sourcePersonId || '');
    const targetPersonId = String(history.targetPersonId || '');
    if (!sourceBefore || !targetBefore || !sourcePersonId || !targetPersonId) throw new Error('IDENTITY_MERGE_INVALID');
    await this.vault.writeMany(request.authToken, context.actorUid, [
      { path: ['personalPeople', sourcePersonId], data: { ...sourceBefore, id: sourcePersonId } },
      { path: ['personalPeople', targetPersonId], data: { ...targetBefore, id: targetPersonId } },
      { path: ['identityMergeHistory', mergeId], data: { ...history, status: 'undone', undoneAt: isoNow(this.now) } },
    ]);
    return { success: true, mergeId, sourcePersonId, targetPersonId };
  }

  async promoteOpportunity(request: RadarRequestContext, personDocumentId: string) {
    const context = await this.resolvePilotContext(request);
    const person = await this.vault.get(request.authToken, context.actorUid, ['personalPeople', personDocumentId]);
    if (!person) throw new Error('PERSON_NOT_FOUND');
    const createdAt = isoNow(this.now);
    await this.vault.writeMany(request.authToken, context.actorUid, [{
      path: ['relationshipOpportunities', personDocumentId],
      data: {
        id: personDocumentId,
        personId: personDocumentId,
        sourceId: person.sourceId || null,
        displayName: person.displayName || null,
        phone: person.phone || null,
        organizationId: request.organizationId,
        status: 'open',
        promotedManually: true,
        createdAt,
        createdByUid: context.actorUid,
        privacyScope: 'owner_only_pilot',
      },
    }]);
    return { success: true, opportunityId: personDocumentId };
  }

  async compose(
    request: RadarRequestContext,
    personDocumentId: string,
    signalId: string,
    tone: RadarComposerTone,
    preferences: { style?: ComposerStyle; channel?: ComposerChannel; objective?: ComposerObjective } = {},
  ) {
    const context = await this.resolvePilotContext(request);
    const person = await this.vault.get(request.authToken, context.actorUid, ['personalPeople', personDocumentId]);
    if (!person) throw new Error('PERSON_NOT_FOUND');
    const signals = Array.isArray(person.signals) ? person.signals as RadarSignal[] : [];
    const signal = signals.find(item => item?.id === signalId);
    if (!signal) throw new Error('SIGNAL_NOT_FOUND');
    if (!['curto', 'conversa', 'audio', 'video'].includes(tone)) throw new Error('COMPOSER_TONE_INVALID');

    const legacy = legacyComposerPreferences(tone);
    const plan = buildComposerPlan({
      person: person as any,
      signal,
      style: preferences.style || legacy.style,
      channel: preferences.channel || legacy.channel,
      objective: preferences.objective || legacy.objective,
    });
    return {
      draft: plan.options[0]?.text || '',
      options: plan.options,
      stage: plan.stage,
      stageLabel: plan.stageLabel,
      objective: plan.objective,
      recommendedChannel: plan.recommendedChannel,
      recommendedStyle: plan.recommendedStyle,
      recommendation: plan.recommendation,
      why: plan.why,
      tip: plan.tip,
      nextSmallYes: plan.nextSmallYes,
      estimatedDurationSeconds: plan.estimatedDurationSeconds || null,
      factsUsed: plan.factsUsed,
      tone,
      personId: personDocumentId,
      signalId,
      phone: person.phone || null,
      evidence: signal.evidence || [],
      automaticSend: false,
    };
  }

  async deleteSource(request: RadarRequestContext, sourceId: string) {
    const context = await this.resolvePilotContext(request);
    const source = await this.vault.get(request.authToken, context.actorUid, ['personalSources', sourceId]);
    if (!source) return { success: true, deleted: false };
    const chunks = await this.vault.list(
      request.authToken,
      context.actorUid,
      ['personalConversations', sourceId, 'messageChunks'],
      500,
    );
    const people = await this.vault.list(request.authToken, context.actorUid, ['personalPeople'], 1_500);
    const opportunityDocs = await this.vault.list(request.authToken, context.actorUid, ['relationshipOpportunities'], 1_500);
    const peopleToDelete = people.filter(person => {
      const sourceIds = Array.isArray(person.sourceIds) ? person.sourceIds : [person.sourceId];
      return sourceIds.length === 1 && sourceIds.includes(sourceId);
    });
    const peopleToUpdate = people.filter(person => {
      const sourceIds = Array.isArray(person.sourceIds) ? person.sourceIds : [person.sourceId];
      return sourceIds.length > 1 && sourceIds.includes(sourceId);
    });
    if (peopleToUpdate.length) {
      await this.vault.writeMany(request.authToken, context.actorUid, peopleToUpdate.map(person => {
        const sourceIds = Array.isArray(person.sourceIds) ? person.sourceIds : [];
        const remainingSourceIds = sourceIds.filter(item => item !== sourceId);
        return {
          path: ['personalPeople', person.id],
          data: {
            ...person,
            sourceIds: remainingSourceIds,
            sourceId: person.sourceId === sourceId ? String(remainingSourceIds[0] || '') : person.sourceId,
            updatedAt: isoNow(this.now),
          },
        };
      }));
    }
    const paths: string[][] = [
      ...chunks.map(chunk => ['personalConversations', sourceId, 'messageChunks', chunk.id]),
      ...peopleToDelete.map(person => ['personalPeople', person.id]),
      ...opportunityDocs.filter(item => item.sourceId === sourceId).map(item => ['relationshipOpportunities', item.id]),
      ['personalConversations', sourceId],
      ['importRuns', sourceId],
      ['personalSources', sourceId],
    ];
    await this.vault.deleteMany(request.authToken, context.actorUid, paths);
    return { success: true, deleted: true };
  }
}
