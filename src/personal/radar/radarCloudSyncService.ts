import { CanonicalContextProvider, CanonicalCoreContext } from '../../core/runtime/connectCore';
import { FirestorePersonalVault, VaultWrite } from '../storage/firestorePersonalVault';
import { ParsedWhatsAppMessage } from '../whatsapp/whatsappExport';
import { deriveRadarPeople, RadarSignal } from './radarSignals';
import {
  compareIdentity,
  normalizeIdentityName,
  normalizePhone,
  safeEffectivePotential,
  uniqueStrings,
} from './identityResolution';

export const RADAR_CLOUD_LOGIC_VERSION = '2026-09-13.evidence-first.v1';

export type RadarCloudSyncRequest = {
  authToken: string;
  organizationId: string;
};

export interface RadarCloudSyncLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn?(message: string, meta?: Record<string, unknown>): void;
  error?(message: string, meta?: Record<string, unknown>): void;
}

type ConversationSnapshot = {
  id: string;
  sourceId: string;
  selfNames: string[];
  raw: Record<string, unknown>;
  messages: ParsedWhatsAppMessage[];
  derived: ReturnType<typeof deriveRadarPeople>;
};

function isoNow(now: () => number): string {
  return new Date(now()).toISOString();
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

function automaticPotentialFromEvidence(signals: RadarSignal[]) {
  return safeEffectivePotential({ signals, manualPotential: null });
}

function exactAliases(person: Record<string, unknown>): Set<string> {
  return new Set(
    uniqueStrings(
      person.displayName,
      person.normalizedName,
      person.identityConfirmedAliases,
    )
      .map(normalizeIdentityName)
      .filter(Boolean),
  );
}

function messageBelongsToPerson(message: ParsedWhatsAppMessage, person: Record<string, unknown>): boolean {
  const aliases = exactAliases(person);
  const sender = normalizeIdentityName(message.sender);
  if (sender && aliases.has(sender)) return true;
  const personPhone = normalizePhone(person.phone);
  const senderPhone = normalizePhone(message.sender);
  return Boolean(personPhone && senderPhone && personPhone === senderPhone);
}

function candidateBelongsToPerson(
  candidate: ReturnType<typeof deriveRadarPeople>[number],
  person: Record<string, unknown>,
): boolean {
  const aliases = exactAliases(person);
  const candidateName = normalizeIdentityName(candidate.normalizedName || candidate.displayName);
  if (candidateName && aliases.has(candidateName)) return true;

  const personPhone = normalizePhone(person.phone);
  const candidatePhone = normalizePhone(candidate.phone);
  if (personPhone && candidatePhone && personPhone === candidatePhone) return true;

  return compareIdentity(candidate, person).kind === 'strong';
}

function uniqueSignals(sourceId: string, signals: RadarSignal[], target: Map<string, RadarSignal>) {
  for (const signal of signals) {
    const evidenceKey = (signal.evidence || [])
      .map(item => `${item.dateKey}:${item.sender}:${item.snippet}`)
      .join('|');
    const key = `${sourceId}:${signal.type}:${evidenceKey}`;
    if (target.has(key)) continue;
    target.set(key, {
      ...signal,
      id: `${sourceId}:${signal.id}`.slice(0, 175),
    });
  }
}

function earliestDate(messages: ParsedWhatsAppMessage[]): string | null {
  const values = messages.map(item => item.dateKey).filter(Boolean).sort();
  return values[0] || null;
}

function latestDate(messages: ParsedWhatsAppMessage[]): string | null {
  const values = messages.map(item => item.dateKey).filter(Boolean).sort();
  return values[values.length - 1] || null;
}

export class RadarCloudSyncService {
  constructor(
    private readonly contextProvider: CanonicalContextProvider,
    private readonly vault: FirestorePersonalVault,
    private readonly now: () => number = Date.now,
    private readonly logger: RadarCloudSyncLogger = console,
  ) {}

  private async resolveContext(input: RadarCloudSyncRequest): Promise<CanonicalCoreContext> {
    const resolution = await this.contextProvider.resolve({
      authToken: input.authToken,
      requestedOrganizationId: input.organizationId,
    });
    if (resolution.status !== 'resolved') throw new Error('RADAR_CONTEXT_DENIED');
    if (!resolution.context.globalAccess) throw new Error('RADAR_PILOT_FORBIDDEN');
    if (resolution.context.organizationId !== input.organizationId) throw new Error('RADAR_TENANT_MISMATCH');
    return resolution.context;
  }

  async ensureCurrent(request: RadarCloudSyncRequest, force = false) {
    const context = await this.resolveContext(request);
    const meta = await this.vault.get(
      request.authToken,
      context.actorUid,
      ['radarMeta', 'classification'],
    );

    if (!force && meta?.logicVersion === RADAR_CLOUD_LOGIC_VERSION && meta?.status === 'current') {
      return {
        status: 'current' as const,
        logicVersion: RADAR_CLOUD_LOGIC_VERSION,
        reprocessedPeople: Number(meta.reprocessedPeople || 0),
        reprocessedSources: Number(meta.reprocessedSources || 0),
        updatedAt: String(meta.updatedAt || ''),
      };
    }

    return this.reprocess(request, context);
  }

  private async reprocess(request: RadarCloudSyncRequest, context: CanonicalCoreContext) {
    const startedAt = isoNow(this.now);
    const [people, conversations, sources, importRuns] = await Promise.all([
      this.vault.list(request.authToken, context.actorUid, ['personalPeople'], 1_500),
      this.vault.list(request.authToken, context.actorUid, ['personalConversations'], 300),
      this.vault.list(request.authToken, context.actorUid, ['personalSources'], 300),
      this.vault.list(request.authToken, context.actorUid, ['importRuns'], 300),
    ]);

    const sourceById = new Map(sources.map(item => [String(item.sourceId || item.id || ''), item]));
    const runById = new Map(importRuns.map(item => [String(item.sourceId || item.id || ''), item]));
    const snapshots = new Map<string, ConversationSnapshot>();
    const sourceWrites: VaultWrite[] = [];

    for (const conversation of conversations) {
      const sourceId = String(conversation.sourceId || conversation.id || '');
      if (!sourceId) continue;
      const chunks = await this.vault.list(
        request.authToken,
        context.actorUid,
        ['personalConversations', sourceId, 'messageChunks'],
        400,
      );
      const messages = chunks
        .sort((a, b) => Number(a.chunkIndex || 0) - Number(b.chunkIndex || 0))
        .flatMap(chunk => Array.isArray(chunk.messages) ? chunk.messages as ParsedWhatsAppMessage[] : []);
      const selfNames = Array.isArray(conversation.selfNames)
        ? conversation.selfNames.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
        : [];
      const derived = deriveRadarPeople({ messages, selfNames });

      snapshots.set(sourceId, {
        id: String(conversation.id || sourceId),
        sourceId,
        selfNames,
        raw: conversation,
        messages,
        derived,
      });

      const source = sourceById.get(sourceId);
      if (source) {
        sourceWrites.push({
          path: ['personalSources', String(source.id || sourceId)],
          data: {
            ...source,
            messageCount: messages.length || Number(source.messageCount || 0),
            radarCount: derived.length,
            reprocessedAt: startedAt,
            radarLogicVersion: RADAR_CLOUD_LOGIC_VERSION,
            cloudCanonical: true,
          },
        });
      }

      const run = runById.get(sourceId);
      if (run) {
        sourceWrites.push({
          path: ['importRuns', String(run.id || sourceId)],
          data: {
            ...run,
            radarCount: derived.length,
            reprocessedAt: startedAt,
            radarLogicVersion: RADAR_CLOUD_LOGIC_VERSION,
            cloudCanonical: true,
          },
        });
      }

      sourceWrites.push({
        path: ['personalConversations', String(conversation.id || sourceId)],
        data: {
          ...conversation,
          messageCount: messages.length || Number(conversation.messageCount || 0),
          reprocessedAt: startedAt,
          radarLogicVersion: RADAR_CLOUD_LOGIC_VERSION,
          cloudCanonical: true,
        },
      });
    }

    const peopleWrites: VaultWrite[] = [];
    for (const person of people) {
      const sourceIds = uniqueStrings(person.sourceIds, person.sourceId);
      const matchedMessages: ParsedWhatsAppMessage[] = [];
      const signalMap = new Map<string, RadarSignal>();

      for (const sourceId of sourceIds) {
        const snapshot = snapshots.get(sourceId);
        if (!snapshot) continue;
        matchedMessages.push(...snapshot.messages.filter(message => messageBelongsToPerson(message, person)));
        for (const candidate of snapshot.derived) {
          if (!candidateBelongsToPerson(candidate, person)) continue;
          uniqueSignals(sourceId, candidate.signals, signalMap);
        }
      }

      const signals = Array.from(signalMap.values());
      const priority = signals.length ? Math.min(...signals.map(signalPriority)) : 99;
      const automaticPotential = automaticPotentialFromEvidence(signals);
      const next = {
        ...person,
        signals,
        priority,
        automaticPotential,
        messageCount: matchedMessages.length || Number(person.messageCount || 0),
        firstDateKey: earliestDate(matchedMessages) || person.firstDateKey || null,
        lastDateKey: latestDate(matchedMessages) || person.lastDateKey || null,
        radarLogicVersion: RADAR_CLOUD_LOGIC_VERSION,
        reprocessedAt: startedAt,
        cloudCanonical: true,
        updatedAt: startedAt,
      };
      peopleWrites.push({ path: ['personalPeople', String(person.id)], data: next });
    }

    const completedAt = isoNow(this.now);
    await this.vault.writeMany(request.authToken, context.actorUid, [
      ...sourceWrites,
      ...peopleWrites,
      {
        path: ['radarMeta', 'classification'],
        data: {
          id: 'classification',
          ownerUid: context.actorUid,
          organizationId: request.organizationId,
          status: 'current',
          logicVersion: RADAR_CLOUD_LOGIC_VERSION,
          startedAt,
          updatedAt: completedAt,
          reprocessedPeople: peopleWrites.length,
          reprocessedSources: snapshots.size,
          cloudCanonical: true,
        },
      },
    ]);

    this.logger.info('RADAR_CLOUD_REPROCESS_COMPLETED', {
      actorUid: `${context.actorUid.slice(0, 4)}***`,
      logicVersion: RADAR_CLOUD_LOGIC_VERSION,
      people: peopleWrites.length,
      sources: snapshots.size,
    });

    return {
      status: 'reprocessed' as const,
      logicVersion: RADAR_CLOUD_LOGIC_VERSION,
      reprocessedPeople: peopleWrites.length,
      reprocessedSources: snapshots.size,
      updatedAt: completedAt,
    };
  }
}
