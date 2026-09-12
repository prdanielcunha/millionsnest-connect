import crypto from 'node:crypto';
import { CanonicalContextProvider, CanonicalCoreContext } from '../../core/runtime/connectCore';
import { FirestorePersonalVault, VaultDocument, VaultWrite } from '../storage/firestorePersonalVault';
import { deriveConversationMetadata } from '../whatsapp/conversationIdentity';
import { extractWhatsAppText, parseWhatsAppExport, ParsedWhatsAppMessage } from '../whatsapp/whatsappExport';
import { normalizeIdentityName, normalizePhone } from '../radar/identityResolution';
import { PersonalRadarService, RadarComposerTone, RadarRequestContext } from '../radar/personalRadarService';
import { ComposerChannel, ComposerObjective, ComposerStyle } from '../radar/composerPlaybook';

export type PersonalSourcesLogger = {
  info(message: string, meta?: Record<string, unknown>): void;
  warn?(message: string, meta?: Record<string, unknown>): void;
  error?(message: string, meta?: Record<string, unknown>): void;
};

type ConversationGroupDocument = VaultDocument & {
  label?: string;
  kind?: string;
  conversationKey?: string;
  rawSourceIds?: string[];
  participantNames?: string[];
  firstDateKey?: string | null;
  lastDateKey?: string | null;
  messageCount?: number;
  importCount?: number;
  createdAt?: string;
  updatedAt?: string;
  lastImportedAt?: string;
  lastAddedMessageCount?: number;
};

type GroupSummary = {
  id: string;
  sourceId: string;
  conversationKey: string;
  label: string;
  kind: string;
  fileName: string;
  createdAt: string;
  updatedAt: string;
  lastImportedAt: string;
  firstDateKey: string | null;
  lastDateKey: string | null;
  participantCount: number;
  messageCount: number;
  peopleCount: number;
  importCount: number;
  lastAddedMessageCount: number;
  rawSourceIds: string[];
  syncMode: 'incremental' | 'legacy';
};

const FINGERPRINT_CHUNK_SIZE = 500;
const MAX_GROUPS = 500;
const MAX_RAW_SOURCES_PER_GROUP = 240;
const MAX_IMPORT_RUNS = 800;

function isoNow(now: () => number): string {
  return new Date(now()).toISOString();
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

function sourceHashFromText(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function messageFingerprint(message: ParsedWhatsAppMessage): string {
  const sender = normalizeIdentityName(message.sender);
  const text = message.text.replace(/\r\n?/g, '\n').trim();
  return crypto.createHash('sha256')
    .update(`${message.timestampLocal}|${sender}|${text}`)
    .digest('hex')
    .slice(0, 40);
}

function countFingerprints(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return counts;
}

function filterIncrementalMessages(existingFingerprints: string[], incoming: ParsedWhatsAppMessage[]) {
  const existingCounts = countFingerprints(existingFingerprints);
  const seenIncoming = new Map<string, number>();
  const newMessages: ParsedWhatsAppMessage[] = [];
  for (const message of incoming) {
    const fingerprint = messageFingerprint(message);
    const occurrence = (seenIncoming.get(fingerprint) || 0) + 1;
    seenIncoming.set(fingerprint, occurrence);
    if (occurrence > (existingCounts.get(fingerprint) || 0)) newMessages.push(message);
  }
  return newMessages;
}

function renderWhatsAppMessages(messages: ParsedWhatsAppMessage[]): string {
  return messages.map(message => {
    const [date, time = '00:00:00'] = message.timestampLocal.split('T');
    const [year, month, day] = date.split('-');
    return `[${day}/${month}/${year}, ${time}] ${message.sender}: ${message.text}`;
  }).join('\n');
}

function earliestDate(...values: unknown[]): string | null {
  const valid = values.filter((value): value is string => typeof value === 'string' && Boolean(value));
  return valid.length ? valid.sort()[0] : null;
}

function latestDate(...values: unknown[]): string | null {
  const valid = values.filter((value): value is string => typeof value === 'string' && Boolean(value));
  return valid.length ? valid.sort().reverse()[0] : null;
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

function participantOverlap(leftValue: unknown, rightValue: unknown): number {
  const left = new Set(uniqueStrings(leftValue).map(normalizeIdentityName).filter(Boolean));
  const right = new Set(uniqueStrings(rightValue).map(normalizeIdentityName).filter(Boolean));
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

function newGroupId(): string {
  return `conv_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

function importRunId(sourceHash: string): string {
  return `run_${sourceHash.slice(0, 28)}`;
}

function chunkFingerprints(values: string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < values.length; i += FINGERPRINT_CHUNK_SIZE) chunks.push(values.slice(i, i + FINGERPRINT_CHUNK_SIZE));
  return chunks;
}

function sortMessages(messages: ParsedWhatsAppMessage[]): ParsedWhatsAppMessage[] {
  return [...messages].sort((a, b) => {
    const timestamp = String(a.timestampLocal).localeCompare(String(b.timestampLocal));
    if (timestamp !== 0) return timestamp;
    const sender = String(a.sender).localeCompare(String(b.sender));
    if (sender !== 0) return sender;
    return Number(a.index || 0) - Number(b.index || 0);
  });
}

function dedupeMessagesAcrossSources(sources: ParsedWhatsAppMessage[][]): ParsedWhatsAppMessage[] {
  const maxCounts = new Map<string, number>();
  const examples = new Map<string, ParsedWhatsAppMessage>();
  for (const source of sources) {
    const sourceCounts = new Map<string, number>();
    for (const message of source) {
      const key = messageFingerprint(message);
      sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1);
      if (!examples.has(key)) examples.set(key, message);
    }
    for (const [key, count] of sourceCounts.entries()) {
      maxCounts.set(key, Math.max(maxCounts.get(key) || 0, count));
    }
  }
  const merged: ParsedWhatsAppMessage[] = [];
  for (const [key, count] of maxCounts.entries()) {
    const example = examples.get(key);
    if (!example) continue;
    for (let i = 0; i < count; i++) merged.push({ ...example, index: merged.length });
  }
  return sortMessages(merged).map((message, index) => ({ ...message, index }));
}

function signalType(person: Record<string, unknown>, type: string): boolean {
  const signals = Array.isArray(person.signals) ? person.signals as Array<Record<string, unknown>> : [];
  return signals.some(signal => signal.type === type);
}

function relationshipState(person: Record<string, unknown>, nowMs: number) {
  const followUpAt = Date.parse(String(person.followUpAt || ''));
  if (Number.isFinite(followUpAt) && followUpAt <= nowMs) {
    return { id: 'follow_up_due', label: 'Follow-up pendente', why: 'Existe um acompanhamento que já chegou na data combinada.' };
  }
  if (person.radarState === 'snoozed') {
    return { id: 'snoozed', label: 'Adiado', why: 'Este relacionamento foi adiado manualmente.' };
  }
  if (signalType(person, 'explicit_product_interest')) {
    return { id: 'warm', label: 'Interesse explícito', why: 'Há uma mensagem com interesse explícito e evidência preservada.' };
  }
  if (person.lastCommercialAction === 'sent_manual') {
    return { id: 'waiting', label: 'Aguardando resposta', why: 'A última ação registrada foi um envio manual.' };
  }
  if (Number(person.messageCount || 0) > 0) {
    return { id: 'active', label: 'Relacionamento ativo', why: 'Há histórico de conversa disponível no Cofre Pessoal.' };
  }
  return { id: 'contact', label: 'Contato disponível', why: 'O contato existe, mas ainda não possui histórico importado.' };
}

export class PersonalSourcesService {
  constructor(
    private readonly contextProvider: CanonicalContextProvider,
    private readonly vault: FirestorePersonalVault,
    private readonly radar: PersonalRadarService,
    private readonly now: () => number = Date.now,
    private readonly logger: PersonalSourcesLogger = console,
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

  private async loadRawMessages(request: RadarRequestContext, uid: string, sourceId: string): Promise<ParsedWhatsAppMessage[]> {
    const chunks = await this.vault.list(request.authToken, uid, ['personalConversations', sourceId, 'messageChunks'], 500);
    const messages: ParsedWhatsAppMessage[] = [];
    for (const chunk of chunks) {
      const raw = Array.isArray(chunk.messages) ? chunk.messages as ParsedWhatsAppMessage[] : [];
      for (const message of raw) {
        if (!message || typeof message !== 'object') continue;
        if (!message.sender || !message.timestampLocal) continue;
        messages.push({ ...message, index: Number(message.index ?? messages.length) });
      }
    }
    return sortMessages(messages);
  }

  private async loadFingerprintIndex(request: RadarRequestContext, uid: string, groupId: string): Promise<string[]> {
    const chunks = await this.vault.list(request.authToken, uid, ['personalConversationGroups', groupId, 'fingerprintChunks'], 120);
    if (!chunks.length) return [];
    return chunks
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .flatMap(chunk => Array.isArray(chunk.fingerprints) ? chunk.fingerprints.filter((item): item is string => typeof item === 'string') : []);
  }

  private async writeFingerprintIndex(
    request: RadarRequestContext,
    uid: string,
    groupId: string,
    fingerprints: string[],
  ) {
    const existing = await this.vault.list(request.authToken, uid, ['personalConversationGroups', groupId, 'fingerprintChunks'], 120);
    const chunks = chunkFingerprints(fingerprints);
    const writes: VaultWrite[] = chunks.map((items, index) => ({
      path: ['personalConversationGroups', groupId, 'fingerprintChunks', String(index).padStart(4, '0')],
      data: { groupId, chunkIndex: index, fingerprints: items },
    }));
    if (writes.length) await this.vault.writeMany(request.authToken, uid, writes);
    const stale = existing
      .map(item => String(item.id))
      .filter(id => Number(id) >= chunks.length)
      .map(id => ['personalConversationGroups', groupId, 'fingerprintChunks', id]);
    if (stale.length) await this.vault.deleteMany(request.authToken, uid, stale);
  }

  private async listGroupContext(request: RadarRequestContext, uid: string) {
    const [groups, conversations] = await Promise.all([
      this.vault.list(request.authToken, uid, ['personalConversationGroups'], MAX_GROUPS),
      this.vault.list(request.authToken, uid, ['personalConversations'], MAX_GROUPS),
    ]);
    const rawToGroup = new Map<string, string>();
    for (const group of groups) {
      for (const rawSourceId of uniqueStrings(group.rawSourceIds)) rawToGroup.set(rawSourceId, String(group.id));
    }
    return { groups: groups as ConversationGroupDocument[], conversations, rawToGroup };
  }

  private groupSummary(
    group: ConversationGroupDocument,
    rawConversations: VaultDocument[],
    peopleCount = 0,
  ): GroupSummary {
    const rawSourceIds = uniqueStrings(group.rawSourceIds);
    const raw = rawConversations.filter(item => rawSourceIds.includes(String(item.sourceId || item.id)));
    const firstRaw = raw[0];
    return {
      id: String(group.id),
      sourceId: String(group.id),
      conversationKey: String(group.conversationKey || firstRaw?.conversationKey || group.id),
      label: String(group.label || firstRaw?.label || firstRaw?.fileName || 'WhatsApp importado'),
      kind: String(group.kind || firstRaw?.kind || 'unknown'),
      fileName: String(firstRaw?.fileName || ''),
      createdAt: String(group.createdAt || firstRaw?.createdAt || ''),
      updatedAt: String(group.updatedAt || group.lastImportedAt || firstRaw?.createdAt || ''),
      lastImportedAt: String(group.lastImportedAt || group.updatedAt || firstRaw?.createdAt || ''),
      firstDateKey: earliestDate(group.firstDateKey, ...raw.map(item => item.firstDateKey)),
      lastDateKey: latestDate(group.lastDateKey, ...raw.map(item => item.lastDateKey)),
      participantCount: uniqueStrings(group.participantNames, ...raw.map(item => item.participantNames)).length,
      messageCount: Number(group.messageCount || 0) || raw.reduce((sum, item) => sum + Number(item.messageCount || 0), 0),
      peopleCount,
      importCount: Math.max(1, Number(group.importCount || rawSourceIds.length || 1)),
      lastAddedMessageCount: Number(group.lastAddedMessageCount || 0),
      rawSourceIds,
      syncMode: 'incremental',
    };
  }

  private virtualSummary(conversation: VaultDocument, peopleCount = 0): GroupSummary {
    const sourceId = String(conversation.sourceId || conversation.id);
    return {
      id: sourceId,
      sourceId,
      conversationKey: String(conversation.conversationKey || sourceId),
      label: String(conversation.label || conversation.fileName || 'WhatsApp importado'),
      kind: String(conversation.kind || 'unknown'),
      fileName: String(conversation.fileName || ''),
      createdAt: String(conversation.createdAt || ''),
      updatedAt: String(conversation.createdAt || ''),
      lastImportedAt: String(conversation.createdAt || ''),
      firstDateKey: typeof conversation.firstDateKey === 'string' ? conversation.firstDateKey : null,
      lastDateKey: typeof conversation.lastDateKey === 'string' ? conversation.lastDateKey : null,
      participantCount: Number(conversation.participantCount || (Array.isArray(conversation.participantNames) ? conversation.participantNames.length : 0)),
      messageCount: Number(conversation.messageCount || 0),
      peopleCount,
      importCount: 1,
      lastAddedMessageCount: Number(conversation.messageCount || 0),
      rawSourceIds: [sourceId],
      syncMode: 'legacy',
    };
  }

  private async resolveGroup(
    request: RadarRequestContext,
    context: CanonicalCoreContext,
    conversation: { label: string; kind: string; conversationKey: string },
    participants: string[],
  ): Promise<ConversationGroupDocument> {
    const { groups, conversations } = await this.listGroupContext(request, context.actorUid);
    const candidates = groups.filter(group =>
      String(group.conversationKey || '') === conversation.conversationKey &&
      String(group.kind || 'unknown') === conversation.kind,
    );
    if (candidates.length) {
      const ranked = candidates
        .map(group => ({ group, overlap: participantOverlap(group.participantNames, participants) }))
        .sort((a, b) => b.overlap - a.overlap);
      const best = ranked[0];
      if (candidates.length === 1 && (best.overlap >= 0.2 || !uniqueStrings(best.group.participantNames).length)) return best.group;
      if (best.overlap >= 0.35) return best.group;
    }

    const legacyMatches = conversations.filter(item =>
      String(item.conversationKey || '') === conversation.conversationKey &&
      String(item.kind || 'unknown') === conversation.kind,
    );
    if (legacyMatches.length) {
      const id = newGroupId();
      return {
        id,
        label: conversation.label,
        kind: conversation.kind,
        conversationKey: conversation.conversationKey,
        rawSourceIds: legacyMatches.map(item => String(item.sourceId || item.id)).filter(Boolean),
        participantNames: uniqueStrings(participants, ...legacyMatches.map(item => item.participantNames)),
        firstDateKey: earliestDate(...legacyMatches.map(item => item.firstDateKey)),
        lastDateKey: latestDate(...legacyMatches.map(item => item.lastDateKey)),
        messageCount: 0,
        importCount: legacyMatches.length,
      };
    }

    return {
      id: newGroupId(),
      label: conversation.label,
      kind: conversation.kind,
      conversationKey: conversation.conversationKey,
      rawSourceIds: [],
      participantNames: participants,
      firstDateKey: null,
      lastDateKey: null,
      messageCount: 0,
      importCount: 0,
    };
  }

  private async bootstrapFingerprints(
    request: RadarRequestContext,
    context: CanonicalCoreContext,
    group: ConversationGroupDocument,
  ): Promise<string[]> {
    const indexed = await this.loadFingerprintIndex(request, context.actorUid, String(group.id));
    if (indexed.length) return indexed;
    const rawSourceIds = uniqueStrings(group.rawSourceIds);
    if (!rawSourceIds.length) return [];
    const sources: ParsedWhatsAppMessage[][] = [];
    for (const sourceId of rawSourceIds) sources.push(await this.loadRawMessages(request, context.actorUid, sourceId));
    const merged = dedupeMessagesAcrossSources(sources);
    const fingerprints = merged.map(messageFingerprint);
    if (fingerprints.length) await this.writeFingerprintIndex(request, context.actorUid, String(group.id), fingerprints);
    return fingerprints;
  }

  async importWhatsApp(
    request: RadarRequestContext,
    input: { fileName: string; contentBase64: string; selfNames?: string[] },
  ) {
    const context = await this.resolveContext(request);
    const fileName = typeof input.fileName === 'string' ? input.fileName.trim().slice(0, 240) : '';
    if (!fileName) throw new Error('IMPORT_FILENAME_REQUIRED');
    const bytes = safeBase64(input.contentBase64);
    const text = extractWhatsAppText(fileName, bytes);
    const sourceHash = sourceHashFromText(text);
    const runId = importRunId(sourceHash);
    const existingRun = await this.vault.get(request.authToken, context.actorUid, ['personalImportRunsV2', runId]);
    if (existingRun) {
      return {
        status: 'deduplicated' as const,
        sourceId: String(existingRun.groupId || existingRun.sourceId || ''),
        conversationId: String(existingRun.groupId || existingRun.sourceId || ''),
        messageCount: 0,
        addedMessageCount: 0,
        totalMessageCount: Number(existingRun.totalMessageCount || existingRun.incomingMessageCount || 0),
        participantCount: Number(existingRun.participantCount || 0),
        radarCount: Number(existingRun.radarCount || 0),
        mergedPeopleCount: 0,
        identityReviewCount: 0,
        conversationLabel: String(existingRun.conversationLabel || ''),
        conversationKind: String(existingRun.conversationKind || 'unknown'),
        conversationKey: String(existingRun.conversationKey || ''),
      };
    }

    const parsed = parseWhatsAppExport(text);
    const selfNames = normalizeSelfNames(input.selfNames);
    const conversation = deriveConversationMetadata(fileName, parsed.participants, selfNames);
    const group = await this.resolveGroup(request, context, conversation, parsed.participants);
    const groupId = String(group.id);
    const existingFingerprints = await this.bootstrapFingerprints(request, context, group);
    const newMessages = filterIncrementalMessages(existingFingerprints, parsed.messages);
    const createdAt = isoNow(this.now);

    let rawSourceId = '';
    let radarCount = 0;
    let mergedPeopleCount = 0;
    let identityReviewCount = 0;
    if (newMessages.length) {
      const deltaText = renderWhatsAppMessages(newMessages);
      const baseResult = await this.radar.importWhatsApp(request, {
        fileName,
        contentBase64: Buffer.from(deltaText, 'utf8').toString('base64'),
        selfNames,
        sourceScope: groupId,
        relatedSourceIds: uniqueStrings(group.rawSourceIds),
      });
      rawSourceId = String(baseResult.sourceId || '');
      radarCount = Number(baseResult.radarCount || 0);
      mergedPeopleCount = Number(baseResult.mergedPeopleCount || 0);
      identityReviewCount = Number(baseResult.identityReviewCount || 0);
    }

    const rawSourceIds = uniqueStrings(group.rawSourceIds, rawSourceId).slice(0, MAX_RAW_SOURCES_PER_GROUP);
    const totalFingerprints = [...existingFingerprints, ...newMessages.map(messageFingerprint)];
    const groupRecord = {
      id: groupId,
      ownerUid: context.actorUid,
      label: conversation.label,
      kind: conversation.kind,
      conversationKey: conversation.conversationKey,
      rawSourceIds,
      participantNames: uniqueStrings(group.participantNames, parsed.participants).slice(0, 500),
      firstDateKey: earliestDate(group.firstDateKey, parsed.firstDateKey),
      lastDateKey: latestDate(group.lastDateKey, parsed.lastDateKey),
      messageCount: totalFingerprints.length,
      importCount: Number(group.importCount || 0) + 1,
      createdAt: String(group.createdAt || createdAt),
      updatedAt: createdAt,
      lastImportedAt: createdAt,
      lastAddedMessageCount: newMessages.length,
      latestFileName: fileName,
      organizationHint: request.organizationId,
      privacyScope: 'owner_only',
      syncMode: 'incremental',
    };

    const writes: VaultWrite[] = [
      { path: ['personalConversationGroups', groupId], data: groupRecord },
      {
        path: ['personalImportRunsV2', runId],
        data: {
          id: runId,
          groupId,
          rawSourceId: rawSourceId || null,
          sourceHash,
          ownerUid: context.actorUid,
          fileName,
          conversationLabel: conversation.label,
          conversationKind: conversation.kind,
          conversationKey: conversation.conversationKey,
          incomingMessageCount: parsed.messages.length,
          addedMessageCount: newMessages.length,
          totalMessageCount: totalFingerprints.length,
          participantCount: parsed.participants.length,
          radarCount,
          mergedPeopleCount,
          identityReviewCount,
          status: newMessages.length ? 'incremental_applied' : 'no_changes',
          createdAt,
          privacyScope: 'owner_only',
        },
      },
    ];
    if (rawSourceId) {
      const rawConversation = await this.vault.get(request.authToken, context.actorUid, ['personalConversations', rawSourceId]);
      if (rawConversation) {
        writes.push({
          path: ['personalConversations', rawSourceId],
          data: { ...rawConversation, conversationGroupId: groupId, canonicalLabel: conversation.label },
        });
      }
      const rawSource = await this.vault.get(request.authToken, context.actorUid, ['personalSources', rawSourceId]);
      if (rawSource) {
        writes.push({
          path: ['personalSources', rawSourceId],
          data: { ...rawSource, conversationGroupId: groupId, canonicalLabel: conversation.label },
        });
      }
    }
    await this.vault.writeMany(request.authToken, context.actorUid, writes);
    await this.writeFingerprintIndex(request, context.actorUid, groupId, totalFingerprints);

    this.logger.info('PERSONAL_SOURCE_INCREMENTAL_IMPORT_COMPLETED', {
      groupId,
      actorUid: `${context.actorUid.slice(0, 4)}***`,
      incomingMessageCount: parsed.messages.length,
      addedMessageCount: newMessages.length,
      totalMessageCount: totalFingerprints.length,
    });

    return {
      status: newMessages.length ? (existingFingerprints.length ? 'incremental' as const : 'imported' as const) : 'deduplicated' as const,
      sourceId: groupId,
      conversationId: groupId,
      rawSourceId: rawSourceId || null,
      messageCount: newMessages.length,
      addedMessageCount: newMessages.length,
      totalMessageCount: totalFingerprints.length,
      participantCount: parsed.participants.length,
      radarCount,
      mergedPeopleCount,
      identityReviewCount,
      conversationLabel: conversation.label,
      conversationKind: conversation.kind,
      conversationKey: conversation.conversationKey,
    };
  }

  private async buildGroupedRadar(request: RadarRequestContext) {
    const context = await this.resolveContext(request);
    const base = await this.radar.getRadar(request);
    const { groups, conversations, rawToGroup } = await this.listGroupContext(request, context.actorUid);
    const summaries = new Map<string, GroupSummary>();

    const peopleByRaw = new Map<string, Set<string>>();
    for (const person of base.people as Array<Record<string, unknown> & { id: string }>) {
      for (const raw of uniqueStrings(person.sourceIds, person.sourceId)) {
        if (!peopleByRaw.has(raw)) peopleByRaw.set(raw, new Set());
        peopleByRaw.get(raw)!.add(String(person.id));
      }
    }

    for (const group of groups) {
      const personIds = new Set<string>();
      for (const raw of uniqueStrings(group.rawSourceIds)) {
        for (const personId of peopleByRaw.get(raw) || []) personIds.add(personId);
      }
      summaries.set(String(group.id), this.groupSummary(group, conversations, personIds.size));
    }
    for (const conversation of conversations) {
      const raw = String(conversation.sourceId || conversation.id);
      if (rawToGroup.has(raw)) continue;
      summaries.set(raw, this.virtualSummary(conversation, peopleByRaw.get(raw)?.size || 0));
    }

    const people: Array<Record<string, unknown> & { id: string }> = (base.people as Array<Record<string, unknown> & { id: string }>).map(person => {
      const rawSourceIds = uniqueStrings(person.sourceIds, person.sourceId);
      const groupedSourceIds = uniqueStrings(rawSourceIds.map(raw => rawToGroup.get(raw) || raw));
      return {
        ...person,
        rawSourceIds,
        sourceIds: groupedSourceIds,
        sourceId: groupedSourceIds[0] || person.sourceId,
        sources: groupedSourceIds.map(id => summaries.get(id)).filter(Boolean),
      };
    });
    const ordered = Array.from(summaries.values()).sort((a, b) => String(b.lastImportedAt || b.updatedAt).localeCompare(String(a.lastImportedAt || a.updatedAt)));
    return { context, people, conversations: ordered, rawToGroup, summaries };
  }

  async getRadar(request: RadarRequestContext) {
    const grouped = await this.buildGroupedRadar(request);
    return { people: grouped.people, count: grouped.people.length, conversations: grouped.conversations };
  }

  async search(request: RadarRequestContext, query: string) {
    const grouped = await this.buildGroupedRadar(request);
    const base = await this.radar.search(request, query);
    const matches = (base.matches as Array<Record<string, unknown>>).map(match => {
      const rawSourceId = String(match.sourceId || '');
      const groupId = grouped.rawToGroup.get(rawSourceId) || rawSourceId;
      const summary = grouped.summaries.get(groupId);
      return {
        ...match,
        rawSourceId,
        sourceId: groupId,
        sourceLabel: summary?.label || match.sourceLabel,
        sourceKind: summary?.kind || match.sourceKind,
      };
    });
    return { query: base.query, matches };
  }

  async listSources(request: RadarRequestContext) {
    const grouped = await this.buildGroupedRadar(request);
    const importRuns = await this.vault.list(request.authToken, grouped.context.actorUid, ['personalImportRunsV2'], MAX_IMPORT_RUNS);
    const peopleIds = new Set(grouped.people.map(person => String(person.id)));
    const totalMessages = grouped.conversations.reduce((sum, source) => sum + Number(source.messageCount || 0), 0);
    return {
      sources: grouped.conversations,
      count: grouped.conversations.length,
      totals: {
        conversations: grouped.conversations.length,
        people: peopleIds.size,
        messages: totalMessages,
        imports: importRuns.length,
      },
      recentImports: importRuns
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .slice(0, 20)
        .map(run => ({
          id: String(run.id),
          groupId: String(run.groupId || ''),
          fileName: String(run.fileName || ''),
          createdAt: String(run.createdAt || ''),
          incomingMessageCount: Number(run.incomingMessageCount || 0),
          addedMessageCount: Number(run.addedMessageCount || 0),
          status: String(run.status || ''),
        })),
    };
  }

  private async resolveRawSourceIds(request: RadarRequestContext, uid: string, sourceId: string) {
    const group = await this.vault.get(request.authToken, uid, ['personalConversationGroups', sourceId]);
    if (group) return { group: group as ConversationGroupDocument, rawSourceIds: uniqueStrings(group.rawSourceIds) };
    const conversation = await this.vault.get(request.authToken, uid, ['personalConversations', sourceId]);
    if (!conversation) throw new Error('SOURCE_NOT_FOUND');
    return { group: null, rawSourceIds: [sourceId] };
  }

  async getSource(request: RadarRequestContext, sourceId: string) {
    const context = await this.resolveContext(request);
    const { group, rawSourceIds } = await this.resolveRawSourceIds(request, context.actorUid, sourceId);
    const rawConversations: VaultDocument[] = [];
    const messageSources: ParsedWhatsAppMessage[][] = [];
    for (const rawId of rawSourceIds) {
      const conversation = await this.vault.get(request.authToken, context.actorUid, ['personalConversations', rawId]);
      if (conversation) rawConversations.push(conversation);
      messageSources.push(await this.loadRawMessages(request, context.actorUid, rawId));
    }
    const messages = dedupeMessagesAcrossSources(messageSources);
    const groupedRadar = await this.buildGroupedRadar(request);
    const summary = group
      ? this.groupSummary(group, rawConversations, groupedRadar.people.filter(person => uniqueStrings(person.sourceIds).includes(sourceId)).length)
      : this.virtualSummary(rawConversations[0] || { id: sourceId }, groupedRadar.people.filter(person => uniqueStrings(person.sourceIds).includes(sourceId)).length);

    const participantCounts = new Map<string, number>();
    for (const message of messages) participantCounts.set(message.sender, (participantCounts.get(message.sender) || 0) + 1);
    const participants = Array.from(participantCounts.entries())
      .map(([name, messageCount]) => ({ name, messageCount }))
      .sort((a, b) => b.messageCount - a.messageCount || a.name.localeCompare(b.name))
      .slice(0, 120);
    const people = groupedRadar.people
      .filter(person => uniqueStrings(person.sourceIds).includes(sourceId))
      .map(person => ({
        id: String(person.id),
        displayName: String(person.probableName || person.displayName || ''),
        originalName: String(person.displayName || ''),
        phone: person.phone || null,
        messageCount: Number(person.messageCount || 0),
        lastDateKey: person.lastDateKey || null,
        favorite: Boolean(person.favorite),
        manualPriority: person.manualPriority || 'normal',
        effectivePotential: person.effectivePotential || person.automaticPotential || 'unknown',
        signal: Array.isArray(person.signals) ? person.signals[0] || null : null,
      }));
    const runs = await this.vault.list(request.authToken, context.actorUid, ['personalImportRunsV2'], MAX_IMPORT_RUNS);
    const imports = runs
      .filter(run => String(run.groupId || '') === sourceId)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, 30)
      .map(run => ({
        id: String(run.id),
        fileName: String(run.fileName || ''),
        createdAt: String(run.createdAt || ''),
        incomingMessageCount: Number(run.incomingMessageCount || 0),
        addedMessageCount: Number(run.addedMessageCount || 0),
        status: String(run.status || ''),
      }));
    return {
      source: summary,
      participants,
      people,
      recentMessages: messages.slice(-80).reverse(),
      imports,
    };
  }

  async getPersonContext(request: RadarRequestContext, personId: string) {
    const context = await this.resolveContext(request);
    const peopleResult = await this.radar.getPeople(request);
    const person = (peopleResult.people as Array<Record<string, unknown> & { id: string }>).find(item => String(item.id) === personId);
    if (!person) throw new Error('PERSON_NOT_FOUND');
    const grouped = await this.buildGroupedRadar(request);
    const groupedPerson = grouped.people.find(item => String(item.id) === personId) || person;
    const rawSourceIds = uniqueStrings(person.sourceIds, person.sourceId);
    const aliases = new Set(uniqueStrings(person.displayName, person.probableName, person.identityAliases)
      .map(normalizeIdentityName)
      .filter(Boolean));
    const phone = normalizePhone(person.phone);
    const sourceMessages: ParsedWhatsAppMessage[][] = [];
    for (const rawSourceId of rawSourceIds) sourceMessages.push(await this.loadRawMessages(request, context.actorUid, rawSourceId));
    const allMessages = dedupeMessagesAcrossSources(sourceMessages);
    const authored = allMessages.filter(message => {
      const senderName = normalizeIdentityName(message.sender);
      if (aliases.has(senderName)) return true;
      const senderPhone = normalizePhone(message.sender);
      return Boolean(phone && senderPhone && phone === senderPhone);
    });
    const state = relationshipState(person, this.now());
    const signals = Array.isArray(person.signals) ? person.signals as Array<Record<string, unknown>> : [];
    const topSignal = signals[0] || null;
    return {
      person: groupedPerson,
      sources: Array.isArray((groupedPerson as any).sources) ? (groupedPerson as any).sources : [],
      relationshipState: state,
      whyNow: String(topSignal?.reason || state.why),
      recommendedAction: String(topSignal?.nextAction || 'Prepare a próxima conversa de forma contextual e manual.'),
      stats: {
        messageCount: authored.length || Number(person.messageCount || 0),
        sourceCount: uniqueStrings((groupedPerson as any).sourceIds).length,
        firstDateKey: earliestDate(person.firstDateKey, authored[0]?.dateKey),
        lastDateKey: latestDate(person.lastDateKey, authored[authored.length - 1]?.dateKey),
      },
      recentMessages: authored.slice(-60).reverse(),
      evidence: Array.isArray(person.identityEvidence) ? person.identityEvidence : [],
      signals,
    };
  }

  async getBrief(request: RadarRequestContext) {
    const grouped = await this.buildGroupedRadar(request);
    const nowMs = this.now();
    const candidates = grouped.people.map(person => {
      const followUpAt = Date.parse(String(person.followUpAt || ''));
      const followUpDue = Number.isFinite(followUpAt) && followUpAt <= nowMs;
      const explicitInterest = signalType(person, 'explicit_product_interest');
      const potential = String(person.manualPotential || person.effectivePotential || person.automaticPotential || 'unknown');
      let rank = 99;
      let reason = '';
      if (followUpDue) { rank = 0; reason = 'Follow-up previsto para agora ou já vencido.'; }
      else if (person.manualPriority === 'priority') { rank = 1; reason = 'Você marcou esta pessoa como prioridade.'; }
      else if (person.favorite) { rank = 2; reason = 'Relacionamento favoritado.'; }
      else if (explicitInterest) { rank = 3; reason = 'Há interesse explícito preservado com evidência.'; }
      else if (potential === 'very_high' || potential === 'high') { rank = 4; reason = 'O Radar encontrou sinais relevantes para uma próxima conversa.'; }
      return { person, rank, reason };
    }).filter(item => item.rank < 99)
      .sort((a, b) => a.rank - b.rank || String(b.person.lastDateKey || '').localeCompare(String(a.person.lastDateKey || '')))
      .slice(0, 8);
    return {
      generatedAt: isoNow(this.now),
      items: candidates.map(item => ({
        personId: String(item.person.id),
        displayName: String(item.person.probableName || item.person.displayName || ''),
        phone: item.person.phone || null,
        reason: item.reason,
        nextAction: String((Array.isArray(item.person.signals) ? item.person.signals[0]?.nextAction : '') || 'Prepare uma próxima conversa curta e contextual.'),
        sources: Array.isArray((item.person as any).sources) ? (item.person as any).sources : [],
        followUpAt: item.person.followUpAt || null,
      })),
      count: candidates.length,
    };
  }

  async prepareSourceOutreach(
    request: RadarRequestContext,
    sourceId: string,
    input: {
      limit?: number;
      tone?: RadarComposerTone;
      style?: ComposerStyle;
      channel?: ComposerChannel;
      objective?: ComposerObjective;
    } = {},
  ) {
    const grouped = await this.buildGroupedRadar(request);
    if (!grouped.summaries.has(sourceId)) throw new Error('SOURCE_NOT_FOUND');
    const limit = Math.min(10, Math.max(1, Number(input.limit || 5)));
    const people = grouped.people
      .filter(person => uniqueStrings(person.sourceIds).includes(sourceId))
      .filter(person => Array.isArray(person.signals) && person.signals.length > 0)
      .filter(person => !person.notRelevant)
      .slice(0, limit);
    const items: Array<Record<string, unknown>> = [];
    for (const person of people) {
      const signal = (person.signals as Array<Record<string, unknown>>)[0];
      const result = await this.radar.compose(
        request,
        String(person.id),
        String(signal.id),
        input.tone || 'curto',
        {
          style: input.style || 'consultivo',
          channel: input.channel || 'texto',
          objective: input.objective,
        },
      );
      items.push({
        personId: String(person.id),
        displayName: String(person.probableName || person.displayName || ''),
        phone: person.phone || null,
        reason: String(signal.reason || ''),
        nextAction: String(signal.nextAction || ''),
        draft: result.draft,
        options: result.options,
        why: result.why,
        automaticSend: false,
      });
    }
    return { sourceId, items, count: items.length, automaticSend: false };
  }

  async deleteSource(request: RadarRequestContext, sourceId: string) {
    const context = await this.resolveContext(request);
    const group = await this.vault.get(request.authToken, context.actorUid, ['personalConversationGroups', sourceId]);
    if (!group) return this.radar.deleteSource(request, sourceId);
    const rawSourceIds = uniqueStrings(group.rawSourceIds);
    for (const rawSourceId of rawSourceIds) await this.radar.deleteSource(request, rawSourceId);
    const fingerprintChunks = await this.vault.list(request.authToken, context.actorUid, ['personalConversationGroups', sourceId, 'fingerprintChunks'], 120);
    const runs = await this.vault.list(request.authToken, context.actorUid, ['personalImportRunsV2'], MAX_IMPORT_RUNS);
    const paths: string[][] = [
      ...fingerprintChunks.map(chunk => ['personalConversationGroups', sourceId, 'fingerprintChunks', String(chunk.id)]),
      ...runs.filter(run => String(run.groupId || '') === sourceId).map(run => ['personalImportRunsV2', String(run.id)]),
      ['personalConversationGroups', sourceId],
    ];
    await this.vault.deleteMany(request.authToken, context.actorUid, paths);
    return { success: true, deleted: true, rawSourcesDeleted: rawSourceIds.length };
  }
}
