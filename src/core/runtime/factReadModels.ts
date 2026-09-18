import type { CanonicalFactEvent, CoreFactPort } from './canonicalFacts';

export interface ToolActivityCounters {
  requested: number;
  completed: number;
  success: number;
  denied: number;
  failed: number;
  conflict: number;
}

export interface ToolActivityToolSummary extends ToolActivityCounters {
  toolId: string;
}

export interface ConnectToolActivityReadModel {
  schemaVersion: 1;
  organizationId: string;
  sourceEventCount: number;
  projectedThrough?: string;
  lastEventId?: string;
  lastOccurredAt?: string;
  lastEvidenceRef?: string;
  totals: ToolActivityCounters;
  tools: ToolActivityToolSummary[];
}

type MutableToolActivityState = {
  organizationId: string;
  sourceEventCount: number;
  projectedThrough?: string;
  lastEventId?: string;
  lastOccurredAt?: string;
  lastEvidenceRef?: string;
  totals: ToolActivityCounters;
  tools: Map<string, ToolActivityCounters>;
};

function emptyCounters(): ToolActivityCounters {
  return {
    requested: 0,
    completed: 0,
    success: 0,
    denied: 0,
    failed: 0,
    conflict: 0,
  };
}

function increment(counters: ToolActivityCounters, event: CanonicalFactEvent): void {
  if (event.eventType === 'TOOL_ACTION_REQUESTED') {
    counters.requested++;
    return;
  }

  counters.completed++;
  switch (event.payload.result) {
    case 'success':
      counters.success++;
      break;
    case 'denied':
      counters.denied++;
      break;
    case 'failed':
      counters.failed++;
      break;
    case 'conflict':
      counters.conflict++;
      break;
    default:
      break;
  }
}

function isLaterEvent(
  currentOccurredAt: string | undefined,
  currentEventId: string | undefined,
  candidate: CanonicalFactEvent,
): boolean {
  if (!currentOccurredAt) return true;
  if (candidate.occurredAt > currentOccurredAt) return true;
  if (candidate.occurredAt < currentOccurredAt) return false;
  return candidate.eventId > (currentEventId ?? '');
}

function cloneCounters(value: ToolActivityCounters): ToolActivityCounters {
  return { ...value };
}

/**
 * Minimal P1 read model for Connect-owned tool activity.
 *
 * This projection is intentionally deterministic, tenant-scoped and AI-free.
 * It can be rebuilt from canonical facts in any order because counters are
 * event-id idempotent and "last event" selection uses occurredAt + eventId.
 *
 * Persistence is deliberately not claimed here. The first implementation is
 * process-memory only; a durable fact/read-model store can replace it later
 * without changing the canonical fact schema or projection contract.
 */
export class InMemoryToolActivityReadModel implements CoreFactPort {
  private readonly seenEventIds = new Set<string>();
  private readonly states = new Map<string, MutableToolActivityState>();

  async record(event: CanonicalFactEvent): Promise<void> {
    this.apply(event);
  }

  apply(event: CanonicalFactEvent): boolean {
    if (this.seenEventIds.has(event.eventId)) return false;
    this.seenEventIds.add(event.eventId);

    const state = this.states.get(event.organizationId) ?? {
      organizationId: event.organizationId,
      sourceEventCount: 0,
      totals: emptyCounters(),
      tools: new Map<string, ToolActivityCounters>(),
    };

    state.sourceEventCount++;
    increment(state.totals, event);

    const toolCounters = state.tools.get(event.payload.toolId) ?? emptyCounters();
    increment(toolCounters, event);
    state.tools.set(event.payload.toolId, toolCounters);

    if (!state.projectedThrough || event.recordedAt > state.projectedThrough) {
      state.projectedThrough = event.recordedAt;
    }

    if (isLaterEvent(state.lastOccurredAt, state.lastEventId, event)) {
      state.lastEventId = event.eventId;
      state.lastOccurredAt = event.occurredAt;
      state.lastEvidenceRef = event.evidenceRef;
    }

    this.states.set(event.organizationId, state);
    return true;
  }

  get(organizationId: string): ConnectToolActivityReadModel {
    const key = organizationId.trim();
    const state = this.states.get(key);
    if (!state) {
      return {
        schemaVersion: 1,
        organizationId: key,
        sourceEventCount: 0,
        totals: emptyCounters(),
        tools: [],
      };
    }

    return {
      schemaVersion: 1,
      organizationId: state.organizationId,
      sourceEventCount: state.sourceEventCount,
      projectedThrough: state.projectedThrough,
      lastEventId: state.lastEventId,
      lastOccurredAt: state.lastOccurredAt,
      lastEvidenceRef: state.lastEvidenceRef,
      totals: cloneCounters(state.totals),
      tools: [...state.tools.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([toolId, counters]) => ({
          toolId,
          ...cloneCounters(counters),
        })),
    };
  }

  rebuild(events: Iterable<CanonicalFactEvent>): void {
    this.reset();
    for (const event of events) this.apply(event);
  }

  reset(): void {
    this.seenEventIds.clear();
    this.states.clear();
  }
}
