import {
  ConnectThreadEvent,
  ConnectThreadProjection,
  projectConnectThread,
} from './threadDomain';

export interface ConnectThreadScope {
  organizationId: string;
  conversationId: string;
}

export type ConnectThreadAppendResult = {
  kind: 'appended' | 'duplicate';
  projection: ConnectThreadProjection;
};

export interface ConnectThreadStore {
  load(scope: ConnectThreadScope): Promise<ConnectThreadProjection | null>;
  readEvents(scope: ConnectThreadScope): Promise<readonly ConnectThreadEvent[]>;
  append(
    event: ConnectThreadEvent,
    expectedVersion: number,
  ): Promise<ConnectThreadAppendResult>;
}

function assertScope(scope: ConnectThreadScope): void {
  for (const [name, value] of Object.entries(scope)) {
    const normalized = value.trim();
    if (
      !normalized ||
      normalized.length > 180 ||
      normalized.includes('/') ||
      normalized.includes('\\')
    ) {
      throw new Error(`INVALID_${name.toUpperCase()}`);
    }
  }
}

function keyOf(scope: ConnectThreadScope): string {
  assertScope(scope);
  return `${scope.organizationId}\u001f${scope.conversationId}`;
}

function eventFingerprint(event: ConnectThreadEvent): string {
  return JSON.stringify(event);
}

/**
 * Reference implementation for the Connect-owned Inbox event-store contract.
 *
 * This class is intentionally process-memory only. It exists to freeze
 * idempotency, optimistic-concurrency and tenant/thread isolation semantics
 * before a durable Firestore adapter is enabled in the production runtime.
 */
export class InMemoryConnectThreadStore implements ConnectThreadStore {
  private readonly streams = new Map<string, ConnectThreadEvent[]>();

  async load(scope: ConnectThreadScope): Promise<ConnectThreadProjection | null> {
    const events = this.streams.get(keyOf(scope)) ?? [];
    return projectConnectThread(events);
  }

  async readEvents(scope: ConnectThreadScope): Promise<readonly ConnectThreadEvent[]> {
    const events = this.streams.get(keyOf(scope)) ?? [];
    return events.map((event) => ({
      ...event,
      payload: { ...event.payload },
    }));
  }

  async append(
    event: ConnectThreadEvent,
    expectedVersion: number,
  ): Promise<ConnectThreadAppendResult> {
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
      throw new Error('INVALID_EXPECTED_VERSION');
    }

    const scope = {
      organizationId: event.organizationId,
      conversationId: event.conversationId,
    };
    const key = keyOf(scope);
    const current = this.streams.get(key) ?? [];
    const duplicate = current.find((candidate) => candidate.eventId === event.eventId);

    if (duplicate) {
      if (eventFingerprint(duplicate) !== eventFingerprint(event)) {
        throw new Error('EVENT_ID_COLLISION');
      }
      const projection = projectConnectThread(current);
      if (!projection) throw new Error('THREAD_PROJECTION_MISSING');
      return { kind: 'duplicate', projection };
    }

    const currentProjection = projectConnectThread(current);
    const currentVersion = currentProjection?.sourceEventCount ?? 0;
    if (currentVersion !== expectedVersion) {
      throw new Error('THREAD_VERSION_CONFLICT');
    }

    const next = [...current, event];
    const projection = projectConnectThread(next);
    if (!projection) throw new Error('THREAD_PROJECTION_MISSING');

    this.streams.set(key, next);
    return { kind: 'appended', projection };
  }

  reset(): void {
    this.streams.clear();
  }
}
