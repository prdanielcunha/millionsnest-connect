import type {
  ConnectThreadAppendResult,
  ConnectThreadScope,
  ConnectThreadStore,
} from './threadStore';
import type { ConnectThreadEvent, ConnectThreadProjection } from './threadDomain';
import type { ConnectRuntimeFirestoreReadiness } from '../runtime/firestoreRuntimeReadiness';

export type ConnectInboxStorageReadinessProbe =
  () => Promise<ConnectRuntimeFirestoreReadiness>;

export interface ReadinessGatedConnectThreadStoreOptions {
  cacheTtlMs?: number;
  now?: () => number;
}

/**
 * Fail-closed gate between the durable Inbox HTTP surface and Firestore.
 *
 * The underlying store is never touched until the Cloud Run runtime identity
 * has proven all required Firestore data-plane permissions. The result is
 * cached briefly to avoid metadata/IAM probes on every request.
 */
export class ReadinessGatedConnectThreadStore implements ConnectThreadStore {
  private readonly cacheTtlMs: number;
  private readonly now: () => number;
  private cached:
    | { checkedAt: number; readiness: ConnectRuntimeFirestoreReadiness }
    | null = null;

  constructor(
    private readonly inner: ConnectThreadStore,
    private readonly probe: ConnectInboxStorageReadinessProbe,
    options: ReadinessGatedConnectThreadStoreOptions = {},
  ) {
    this.cacheTtlMs = Math.max(
      0,
      Math.min(options.cacheTtlMs ?? 30_000, 300_000),
    );
    this.now = options.now ?? Date.now;
  }

  async load(scope: ConnectThreadScope): Promise<ConnectThreadProjection | null> {
    await this.assertReady();
    return this.inner.load(scope);
  }

  async listByOrganization(input: {
    organizationId: string;
    limit?: number;
  }): Promise<readonly ConnectThreadProjection[]> {
    await this.assertReady();
    return this.inner.listByOrganization(input);
  }

  async readEvents(
    scope: ConnectThreadScope,
  ): Promise<readonly ConnectThreadEvent[]> {
    await this.assertReady();
    return this.inner.readEvents(scope);
  }

  async append(
    event: ConnectThreadEvent,
    expectedVersion: number,
  ): Promise<ConnectThreadAppendResult> {
    await this.assertReady();
    return this.inner.append(event, expectedVersion);
  }

  clearReadinessCache(): void {
    this.cached = null;
  }

  private async assertReady(): Promise<void> {
    const now = this.now();
    let readiness = this.cached?.readiness ?? null;

    if (
      !this.cached ||
      this.cacheTtlMs === 0 ||
      now - this.cached.checkedAt >= this.cacheTtlMs
    ) {
      try {
        readiness = await this.probe();
      } catch {
        readiness = null;
      }

      if (readiness) {
        this.cached = { checkedAt: now, readiness };
      } else {
        this.cached = null;
      }
    }

    if (!readiness || readiness.state !== 'read_write_confirmed') {
      throw new Error('INBOX_STORAGE_NOT_READY');
    }
  }
}
