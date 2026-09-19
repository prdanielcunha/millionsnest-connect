import { createHash } from 'node:crypto';
import {
  ConnectThreadEvent,
  ConnectThreadProjection,
  projectConnectThread,
} from './threadDomain';
import type {
  ConnectThreadAppendResult,
  ConnectThreadScope,
  ConnectThreadStore,
} from './threadStore';

const DEFAULT_PROJECT_ID = 'millionsnest';
const DEFAULT_METADATA_TOKEN_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
const STORAGE_SCHEMA_VERSION = 1;
const PAGE_SIZE = 300;

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, any>;
  updateTime?: string;
};

export interface ConnectRuntimeAccessTokenProvider {
  getAccessToken(): Promise<string>;
}

export interface GoogleMetadataAccessTokenProviderOptions {
  fetchImpl?: typeof fetch;
  metadataTokenUrl?: string;
}

export class GoogleMetadataAccessTokenProvider
implements ConnectRuntimeAccessTokenProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly metadataTokenUrl: string;

  constructor(options: GoogleMetadataAccessTokenProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.metadataTokenUrl =
      options.metadataTokenUrl?.trim() || DEFAULT_METADATA_TOKEN_URL;
  }

  async getAccessToken(): Promise<string> {
    const response = await this.fetchImpl(this.metadataTokenUrl, {
      method: 'GET',
      headers: {
        'Metadata-Flavor': 'Google',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('CONNECT_RUNTIME_TOKEN_UNAVAILABLE');

    const payload = await response.json() as { access_token?: unknown };
    if (typeof payload.access_token !== 'string' || !payload.access_token.trim()) {
      throw new Error('CONNECT_RUNTIME_TOKEN_INVALID');
    }
    return payload.access_token.trim();
  }
}

export interface FirestoreConnectThreadStoreOptions {
  projectId?: string;
  fetchImpl?: typeof fetch;
  tokenProvider?: ConnectRuntimeAccessTokenProvider;
}

type SnapshotRecord = {
  projection: ConnectThreadProjection;
  updateTime: string;
};

function safeProjectId(raw: string | undefined): string {
  const value = raw?.trim() || DEFAULT_PROJECT_ID;
  if (!/^[a-z0-9][a-z0-9-]{4,62}[a-z0-9]$/.test(value)) {
    throw new Error('INVALID_FIRESTORE_PROJECT_ID');
  }
  return value;
}

function safeSegment(raw: string, maxLength = 180): string {
  const value = raw.trim();
  if (
    !value ||
    value === '.' ||
    value === '..' ||
    value.length > maxLength ||
    value.includes('/') ||
    value.includes('\\')
  ) {
    throw new Error('INVALID_DOCUMENT_SEGMENT');
  }
  return value;
}

function encodedPath(segments: string[]): string {
  return segments.map((segment) => encodeURIComponent(safeSegment(segment, 900))).join('/');
}

function threadPath(scope: ConnectThreadScope): string[] {
  return [
    'connectOrganizations',
    safeSegment(scope.organizationId),
    'inboxThreads',
    safeSegment(scope.conversationId),
  ];
}

function eventPath(event: ConnectThreadEvent): string[] {
  return [
    ...threadPath(event),
    'events',
    safeSegment(event.eventId, 900),
  ];
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const target: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      target[key] = canonicalize(source[key]);
    }
    return target;
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function stringValue(value: string): Record<string, unknown> {
  return { stringValue: value };
}

function integerValue(value: number): Record<string, unknown> {
  return { integerValue: String(value) };
}

function readStringField(
  document: FirestoreDocument,
  fieldName: string,
): string | null {
  const value = document.fields?.[fieldName]?.stringValue;
  return typeof value === 'string' ? value : null;
}

function readIntegerField(
  document: FirestoreDocument,
  fieldName: string,
): number | null {
  const raw = document.fields?.[fieldName]?.integerValue;
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

function parseProjection(
  document: FirestoreDocument,
  scope: ConnectThreadScope,
): ConnectThreadProjection {
  const schemaVersion = readIntegerField(document, 'storageSchemaVersion');
  const organizationId = readStringField(document, 'organizationId');
  const conversationId = readStringField(document, 'conversationId');
  const projectionJson = readStringField(document, 'projectionJson');
  const explicitEventCount = readIntegerField(document, 'sourceEventCount');

  if (
    schemaVersion !== STORAGE_SCHEMA_VERSION ||
    organizationId !== scope.organizationId ||
    conversationId !== scope.conversationId ||
    !projectionJson
  ) {
    throw new Error('THREAD_SNAPSHOT_INVALID');
  }

  let projection: ConnectThreadProjection;
  try {
    projection = JSON.parse(projectionJson) as ConnectThreadProjection;
  } catch {
    throw new Error('THREAD_SNAPSHOT_INVALID');
  }

  if (
    projection.schemaVersion !== 1 ||
    projection.organizationId !== scope.organizationId ||
    projection.conversationId !== scope.conversationId ||
    !Number.isSafeInteger(projection.sourceEventCount) ||
    projection.sourceEventCount < 1 ||
    explicitEventCount !== projection.sourceEventCount
  ) {
    throw new Error('THREAD_SNAPSHOT_INVALID');
  }

  return projection;
}

function parseEvent(
  document: FirestoreDocument,
  scope: ConnectThreadScope,
): ConnectThreadEvent {
  const schemaVersion = readIntegerField(document, 'storageSchemaVersion');
  const organizationId = readStringField(document, 'organizationId');
  const conversationId = readStringField(document, 'conversationId');
  const eventId = readStringField(document, 'eventId');
  const eventJson = readStringField(document, 'eventJson');
  const storedFingerprint = readStringField(document, 'eventFingerprint');

  if (
    schemaVersion !== STORAGE_SCHEMA_VERSION ||
    organizationId !== scope.organizationId ||
    conversationId !== scope.conversationId ||
    !eventId ||
    !eventJson ||
    !storedFingerprint
  ) {
    throw new Error('THREAD_EVENT_INVALID');
  }

  let event: ConnectThreadEvent;
  try {
    event = JSON.parse(eventJson) as ConnectThreadEvent;
  } catch {
    throw new Error('THREAD_EVENT_INVALID');
  }

  if (
    event.version !== 1 ||
    event.sourceApp !== 'connect' ||
    event.organizationId !== scope.organizationId ||
    event.conversationId !== scope.conversationId ||
    event.eventId !== eventId ||
    fingerprint(event) !== storedFingerprint
  ) {
    throw new Error('THREAD_EVENT_INVALID');
  }

  return event;
}

function snapshotFields(
  projection: ConnectThreadProjection,
): Record<string, unknown> {
  return {
    storageSchemaVersion: integerValue(STORAGE_SCHEMA_VERSION),
    organizationId: stringValue(projection.organizationId),
    conversationId: stringValue(projection.conversationId),
    sourceEventCount: integerValue(projection.sourceEventCount),
    lastEventId: stringValue(projection.lastEventId),
    updatedAt: stringValue(projection.updatedAt),
    projectionJson: stringValue(canonicalJson(projection)),
  };
}

function eventFields(event: ConnectThreadEvent): Record<string, unknown> {
  return {
    storageSchemaVersion: integerValue(STORAGE_SCHEMA_VERSION),
    organizationId: stringValue(event.organizationId),
    conversationId: stringValue(event.conversationId),
    eventId: stringValue(event.eventId),
    eventType: stringValue(event.eventType),
    occurredAt: stringValue(event.occurredAt),
    recordedAt: stringValue(event.recordedAt),
    eventFingerprint: stringValue(fingerprint(event)),
    eventJson: stringValue(canonicalJson(event)),
  };
}

function isSameProjection(
  a: ConnectThreadProjection,
  b: ConnectThreadProjection,
): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

async function safeErrorStatus(response: Response): Promise<string> {
  try {
    const payload = await response.json() as {
      error?: {
        status?: unknown;
      };
    };
    return typeof payload.error?.status === 'string'
      ? payload.error.status
      : '';
  } catch {
    return '';
  }
}

/**
 * Durable Connect-owned Firestore adapter for canonical Inbox thread state.
 *
 * Storage layout:
 * connectOrganizations/{organizationId}/inboxThreads/{conversationId}
 * connectOrganizations/{organizationId}/inboxThreads/{conversationId}/events/{eventId}
 *
 * The adapter uses only the Cloud Run runtime identity. User bearers are never
 * accepted here. Event + snapshot writes are committed atomically with
 * optimistic Firestore preconditions.
 */
export class FirestoreConnectThreadStore implements ConnectThreadStore {
  private readonly projectId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly tokenProvider: ConnectRuntimeAccessTokenProvider;
  private readonly documentsBase: string;
  private readonly commitUrl: string;

  constructor(options: FirestoreConnectThreadStoreOptions = {}) {
    this.projectId = safeProjectId(options.projectId);
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.tokenProvider = options.tokenProvider ?? new GoogleMetadataAccessTokenProvider({
      fetchImpl: this.fetchImpl,
    });
    const database = `projects/${this.projectId}/databases/(default)`;
    this.documentsBase =
      `https://firestore.googleapis.com/v1/${database}/documents`;
    this.commitUrl =
      `https://firestore.googleapis.com/v1/${database}/documents:commit`;
  }

  async load(scope: ConnectThreadScope): Promise<ConnectThreadProjection | null> {
    return (await this.loadSnapshotRecord(scope))?.projection ?? null;
  }

  async readEvents(
    scope: ConnectThreadScope,
  ): Promise<readonly ConnectThreadEvent[]> {
    const collection = [...threadPath(scope), 'events'];
    const result: ConnectThreadEvent[] = [];
    let pageToken = '';

    do {
      const token = await this.tokenProvider.getAccessToken();
      const url = new URL(
        `${this.documentsBase}/${encodedPath(collection)}`,
      );
      url.searchParams.set('pageSize', String(PAGE_SIZE));
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      if (response.status === 404) return result;
      if (!response.ok) {
        throw new Error(`FIRESTORE_LIST_EVENTS_${response.status}`);
      }

      const payload = await response.json() as {
        documents?: FirestoreDocument[];
        nextPageToken?: unknown;
      };

      for (const document of payload.documents ?? []) {
        result.push(parseEvent(document, scope));
      }
      pageToken = typeof payload.nextPageToken === 'string'
        ? payload.nextPageToken
        : '';
    } while (pageToken);

    return result;
  }

  async append(
    event: ConnectThreadEvent,
    expectedVersion: number,
  ): Promise<ConnectThreadAppendResult> {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
      throw new Error('INVALID_EXPECTED_VERSION');
    }

    const scope = {
      organizationId: event.organizationId,
      conversationId: event.conversationId,
    };
    const snapshot = await this.loadSnapshotRecord(scope);
    const currentVersion = snapshot?.projection.sourceEventCount ?? 0;
    if (currentVersion !== expectedVersion) {
      throw new Error('THREAD_VERSION_CONFLICT');
    }

    const events = [...await this.readEvents(scope)];
    const rebuilt = projectConnectThread(events);

    if (
      (!snapshot && rebuilt) ||
      (snapshot && !rebuilt) ||
      (snapshot && rebuilt && !isSameProjection(snapshot.projection, rebuilt))
    ) {
      throw new Error('THREAD_SNAPSHOT_DRIFT');
    }

    const existing = events.find((candidate) => candidate.eventId === event.eventId);
    if (existing) {
      if (fingerprint(existing) !== fingerprint(event)) {
        throw new Error('EVENT_ID_COLLISION');
      }
      if (!rebuilt) throw new Error('THREAD_PROJECTION_MISSING');
      return { kind: 'duplicate', projection: rebuilt };
    }

    const nextProjection = projectConnectThread([...events, event]);
    if (!nextProjection) throw new Error('THREAD_PROJECTION_MISSING');

    const eventName = this.fullDocumentName(eventPath(event));
    const snapshotName = this.fullDocumentName(threadPath(scope));

    const writes = [
      {
        update: {
          name: eventName,
          fields: eventFields(event),
        },
        currentDocument: {
          exists: false,
        },
      },
      {
        update: {
          name: snapshotName,
          fields: snapshotFields(nextProjection),
        },
        currentDocument: snapshot
          ? { updateTime: snapshot.updateTime }
          : { exists: false },
      },
    ];

    try {
      const token = await this.tokenProvider.getAccessToken();
      const response = await this.fetchImpl(this.commitUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ writes }),
        cache: 'no-store',
      });

      if (response.ok) {
        return { kind: 'appended', projection: nextProjection };
      }

      const status = response.status;
      const errorStatus = await safeErrorStatus(response);
      return await this.recoverFailedAppend(
        event,
        status,
        errorStatus,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        (
          error.message === 'EVENT_ID_COLLISION' ||
          error.message === 'THREAD_VERSION_CONFLICT'
        )
      ) {
        throw error;
      }

      const recovered = await this.recoverDuplicateAfterAmbiguousFailure(event);
      if (recovered) return recovered;
      throw new Error('FIRESTORE_COMMIT_UNAVAILABLE');
    }
  }

  private fullDocumentName(relativePath: string[]): string {
    return `projects/${this.projectId}/databases/(default)/documents/${relativePath
      .map((segment) => safeSegment(segment, 900))
      .join('/')}`;
  }

  private async loadSnapshotRecord(
    scope: ConnectThreadScope,
  ): Promise<SnapshotRecord | null> {
    const document = await this.getDocument(threadPath(scope));
    if (!document) return null;
    const updateTime =
      typeof document.updateTime === 'string' ? document.updateTime : '';
    if (!updateTime) throw new Error('THREAD_SNAPSHOT_INVALID');
    return {
      projection: parseProjection(document, scope),
      updateTime,
    };
  }

  private async getEvent(
    event: ConnectThreadEvent,
  ): Promise<ConnectThreadEvent | null> {
    const document = await this.getDocument(eventPath(event));
    return document
      ? parseEvent(document, {
          organizationId: event.organizationId,
          conversationId: event.conversationId,
        })
      : null;
  }

  private async getDocument(
    relativePath: string[],
  ): Promise<FirestoreDocument | null> {
    const token = await this.tokenProvider.getAccessToken();
    const response = await this.fetchImpl(
      `${this.documentsBase}/${encodedPath(relativePath)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      },
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`FIRESTORE_GET_${response.status}`);
    }
    return await response.json() as FirestoreDocument;
  }

  private async recoverDuplicateAfterAmbiguousFailure(
    event: ConnectThreadEvent,
  ): Promise<ConnectThreadAppendResult | null> {
    try {
      const existing = await this.getEvent(event);
      if (!existing) return null;
      if (fingerprint(existing) !== fingerprint(event)) {
        throw new Error('EVENT_ID_COLLISION');
      }
      const projection = await this.load({
        organizationId: event.organizationId,
        conversationId: event.conversationId,
      });
      if (!projection) throw new Error('THREAD_PROJECTION_MISSING');
      return { kind: 'duplicate', projection };
    } catch (error) {
      if (
        error instanceof Error &&
        (
          error.message === 'EVENT_ID_COLLISION' ||
          error.message === 'THREAD_PROJECTION_MISSING'
        )
      ) {
        throw error;
      }
      return null;
    }
  }

  private async recoverFailedAppend(
    event: ConnectThreadEvent,
    httpStatus: number,
    errorStatus: string,
  ): Promise<ConnectThreadAppendResult> {
    const duplicate = await this.recoverDuplicateAfterAmbiguousFailure(event);
    if (duplicate) return duplicate;

    if (
      httpStatus === 409 ||
      httpStatus === 412 ||
      errorStatus === 'ABORTED' ||
      errorStatus === 'ALREADY_EXISTS' ||
      errorStatus === 'FAILED_PRECONDITION'
    ) {
      throw new Error('THREAD_VERSION_CONFLICT');
    }

    throw new Error(`FIRESTORE_COMMIT_${httpStatus}`);
  }
}
