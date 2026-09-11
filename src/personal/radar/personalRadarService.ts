import crypto from 'node:crypto';
import { CanonicalContextProvider, CanonicalCoreContext } from '../../core/runtime/connectCore';
import { FirestorePersonalVault, VaultWrite } from '../storage/firestorePersonalVault';
import { extractWhatsAppText, parseWhatsAppExport, ParsedWhatsAppMessage } from '../whatsapp/whatsappExport';
import { deriveRadarPeople, RadarPerson, RadarSignal } from './radarSignals';
import { buildComposerPlan, ComposerChannel, ComposerObjective, ComposerStyle } from './composerPlaybook';

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
    const existing = await this.vault.get(request.authToken, context.actorUid, ['personalSources', sourceId]);
    if (existing) {
      return {
        status: 'deduplicated' as const,
        sourceId,
        messageCount: Number(existing.messageCount || 0),
        participantCount: Number(existing.participantCount || 0),
        radarCount: Number(existing.radarCount || 0),
      };
    }

    const parsed = parseWhatsAppExport(text);
    const selfNames = normalizeSelfNames(input.selfNames);
    const people = deriveRadarPeople({ messages: parsed.messages, selfNames }).slice(0, 250);
    const createdAt = isoNow(this.now);
    const chunks = chunkMessages(parsed.messages);

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
        data: {
          sourceId,
          chunkIndex: index,
          messages,
        },
      })),
      ...people.map(person => ({
        path: ['personalPeople', `${sourceId}_${person.id}`],
        data: {
          ...person,
          id: `${sourceId}_${person.id}`,
          sourceId,
          ownerUid: context.actorUid,
          importedAt: createdAt,
          radarState: 'active',
          snoozedUntil: null,
          priority: personPriority(person),
        },
      })),
    ];

    await this.vault.writeMany(request.authToken, context.actorUid, writes);
    this.logger.info('RADAR_WHATSAPP_IMPORT_COMPLETED', {
      sourceId,
      actorUid: context.actorUid.slice(0, 4) + '***',
      messageCount: parsed.messages.length,
      participantCount: parsed.participants.length,
      radarCount: people.length,
    });

    return {
      status: 'imported' as const,
      sourceId,
      messageCount: parsed.messages.length,
      participantCount: parsed.participants.length,
      radarCount: people.length,
    };
  }

  async getRadar(request: RadarRequestContext) {
    const context = await this.resolvePilotContext(request);
    const people = await this.vault.list(request.authToken, context.actorUid, ['personalPeople'], 1_000);
    const nowMs = this.now();
    const active = people
      .filter(person => person.radarState !== 'ignored' && !isActivelySnoozed(person, nowMs))
      .sort((a, b) => {
        const rank = Number(a.priority ?? 99) - Number(b.priority ?? 99);
        if (rank !== 0) return rank;
        return String(b.lastDateKey || '').localeCompare(String(a.lastDateKey || ''));
      });
    return { people: active, count: active.length };
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
    },
  ) {
    const context = await this.resolvePilotContext(request);
    const person = await this.vault.get(request.authToken, context.actorUid, ['personalPeople', personDocumentId]);
    if (!person) throw new Error('PERSON_NOT_FOUND');
    const digits = typeof input.phone === 'string' ? input.phone.replace(/\D/g, '') : '';
    if (digits && (digits.length < 10 || digits.length > 15)) throw new Error('PHONE_INVALID');
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

    await this.vault.writeMany(request.authToken, context.actorUid, [{
      path: ['personalPeople', personDocumentId],
      data: {
        ...person,
        id: personDocumentId,
        phone: digits || person.phone || null,
        radarState,
        snoozedUntil,
        updatedAt: isoNow(this.now),
      },
    }]);
    return { success: true, radarState, snoozedUntil };
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
    const paths: string[][] = [
      ...chunks.map(chunk => ['personalConversations', sourceId, 'messageChunks', chunk.id]),
      ...people.filter(person => person.sourceId === sourceId).map(person => ['personalPeople', person.id]),
      ...opportunityDocs.filter(item => item.sourceId === sourceId).map(item => ['relationshipOpportunities', item.id]),
      ['personalConversations', sourceId],
      ['importRuns', sourceId],
      ['personalSources', sourceId],
    ];
    await this.vault.deleteMany(request.authToken, context.actorUid, paths);
    return { success: true, deleted: true };
  }
}
