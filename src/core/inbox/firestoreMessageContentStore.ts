import { createHash } from 'node:crypto';
import {
  createProviderMessageIndexId,
  normalizeMessageContentRecord,
  type ConnectMessageContentRecord,
  type ConnectMessageContentStore,
  type ConnectMessageContentWriteResult,
  type ConnectMessageDeliveryStatus,
} from './messageContentStore';
import {
  GoogleMetadataAccessTokenProvider,
  type ConnectRuntimeAccessTokenProvider,
} from './firestoreThreadStore';

const DEFAULT_PROJECT_ID = 'millionsnest';
const STORAGE_SCHEMA_VERSION = 1;

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, any>;
  updateTime?: string;
};

export interface FirestoreMessageContentStoreOptions {
  projectId?: string;
  fetchImpl?: typeof fetch;
  tokenProvider?: ConnectRuntimeAccessTokenProvider;
}

function safeProjectId(raw: string | undefined): string {
  const value = raw?.trim() || DEFAULT_PROJECT_ID;
  if (!/^[a-z0-9][a-z0-9-]{4,62}[a-z0-9]$/.test(value)) {
    throw new Error('INVALID_FIRESTORE_PROJECT_ID');
  }
  return value;
}

function safeSegment(raw: string, maxLength = 300): string {
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

function readString(document: FirestoreDocument, field: string): string | null {
  const value = document.fields?.[field]?.stringValue;
  return typeof value === 'string' ? value : null;
}

function contentPath(record: Pick<ConnectMessageContentRecord, 'organizationId' | 'conversationId' | 'messageId'>): string[] {
  return [
    'connectSensitiveOrganizations',
    safeSegment(record.organizationId, 180),
    'inboxMessageContent',
    safeSegment(record.conversationId, 180),
    'messages',
    safeSegment(record.messageId, 300),
  ];
}

function providerIndexPath(channel: string, providerMessageId: string): string[] {
  return [
    'connectProviderMessageIndex',
    createProviderMessageIndexId(channel, providerMessageId),
  ];
}

function recordFields(record: ConnectMessageContentRecord): Record<string, unknown> {
  return {
    storageSchemaVersion: integerValue(STORAGE_SCHEMA_VERSION),
    organizationId: stringValue(record.organizationId),
    conversationId: stringValue(record.conversationId),
    messageId: stringValue(record.messageId),
    channel: stringValue(record.channel),
    providerMessageId: stringValue(record.providerMessageId),
    deliveryStatus: stringValue(record.deliveryStatus),
    occurredAt: stringValue(record.occurredAt),
    recordedAt: stringValue(record.recordedAt),
    recordFingerprint: stringValue(fingerprint(record)),
    recordJson: stringValue(canonicalJson(record)),
  };
}

function providerIndexFields(record: ConnectMessageContentRecord): Record<string, unknown> {
  return {
    storageSchemaVersion: integerValue(STORAGE_SCHEMA_VERSION),
    providerIndexId: stringValue(createProviderMessageIndexId(record.channel, record.providerMessageId)),
    organizationId: stringValue(record.organizationId),
    conversationId: stringValue(record.conversationId),
    messageId: stringValue(record.messageId),
    channel: stringValue(record.channel),
    contentPath: stringValue(contentPath(record).join('/')),
  };
}

function parseRecord(document: FirestoreDocument): ConnectMessageContentRecord {
  if (
    Number(document.fields?.storageSchemaVersion?.integerValue) !== STORAGE_SCHEMA_VERSION ||
    !readString(document, 'recordJson')
  ) {
    throw new Error('MESSAGE_CONTENT_INVALID');
  }

  let parsed: ConnectMessageContentRecord;
  try {
    parsed = JSON.parse(readString(document, 'recordJson')!) as ConnectMessageContentRecord;
  } catch {
    throw new Error('MESSAGE_CONTENT_INVALID');
  }

  const normalized = normalizeMessageContentRecord(parsed);
  if (readString(document, 'recordFingerprint') !== fingerprint(normalized)) {
    throw new Error('MESSAGE_CONTENT_FINGERPRINT_MISMATCH');
  }
  return normalized;
}

async function errorStatus(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: { status?: unknown } };
    return typeof body.error?.status === 'string' ? body.error.status : '';
  } catch {
    return '';
  }
}

export class FirestoreMessageContentStore implements ConnectMessageContentStore {
  private readonly projectId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly tokenProvider: ConnectRuntimeAccessTokenProvider;
  private readonly documentsBase: string;
  private readonly commitUrl: string;

  constructor(options: FirestoreMessageContentStoreOptions = {}) {
    this.projectId = safeProjectId(options.projectId);
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.tokenProvider = options.tokenProvider ?? new GoogleMetadataAccessTokenProvider({
      fetchImpl: this.fetchImpl,
    });
    const database = `projects/${this.projectId}/databases/(default)`;
    this.documentsBase = `https://firestore.googleapis.com/v1/${database}/documents`;
    this.commitUrl = `https://firestore.googleapis.com/v1/${database}/documents:commit`;
  }

  async put(input: ConnectMessageContentRecord): Promise<ConnectMessageContentWriteResult> {
    const record = normalizeMessageContentRecord(input);
    const contentName = this.fullDocumentName(contentPath(record));
    const indexName = this.fullDocumentName(providerIndexPath(record.channel, record.providerMessageId));

    const writes = [
      {
        update: { name: contentName, fields: recordFields(record) },
        currentDocument: { exists: false },
      },
      {
        update: { name: indexName, fields: providerIndexFields(record) },
        currentDocument: { exists: false },
      },
    ];

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

    if (response.ok) return { kind: 'created', record };

    const providerExisting = await this.getByProviderMessageId({
      channel: record.channel,
      providerMessageId: record.providerMessageId,
    }).catch(() => null);

    if (providerExisting) {
      if (fingerprint(providerExisting) !== fingerprint(record)) {
        throw new Error('PROVIDER_MESSAGE_ID_COLLISION');
      }
      return { kind: 'duplicate', record: providerExisting };
    }

    const directExisting = await this.get(record).catch(() => null);
    if (directExisting) {
      if (fingerprint(directExisting) !== fingerprint(record)) {
        throw new Error('MESSAGE_ID_COLLISION');
      }
      return { kind: 'duplicate', record: directExisting };
    }

    const status = await errorStatus(response);
    if (response.status === 409 || response.status === 412 || status === 'ALREADY_EXISTS') {
      throw new Error('MESSAGE_CONTENT_WRITE_CONFLICT');
    }
    throw new Error(`MESSAGE_CONTENT_COMMIT_${response.status}`);
  }

  async get(input: {
    organizationId: string;
    conversationId: string;
    messageId: string;
  }): Promise<ConnectMessageContentRecord | null> {
    const document = await this.getDocument(contentPath(input));
    return document ? parseRecord(document) : null;
  }

  async getByProviderMessageId(input: {
    channel: string;
    providerMessageId: string;
  }): Promise<ConnectMessageContentRecord | null> {
    const index = await this.getDocument(providerIndexPath(input.channel, input.providerMessageId));
    if (!index) return null;

    const organizationId = readString(index, 'organizationId');
    const conversationId = readString(index, 'conversationId');
    const messageId = readString(index, 'messageId');
    if (!organizationId || !conversationId || !messageId) {
      throw new Error('MESSAGE_PROVIDER_INDEX_INVALID');
    }

    return this.get({ organizationId, conversationId, messageId });
  }

  async updateDeliveryStatus(input: {
    organizationId: string;
    conversationId: string;
    messageId: string;
    deliveryStatus: ConnectMessageDeliveryStatus;
    occurredAt: string;
  }): Promise<ConnectMessageContentRecord | null> {
    const path = contentPath(input);
    const existingDocument = await this.getDocument(path);
    if (!existingDocument) return null;

    const existing = parseRecord(existingDocument);
    const next = normalizeMessageContentRecord({
      ...existing,
      deliveryStatus: input.deliveryStatus,
      occurredAt: new Date(input.occurredAt).toISOString(),
      recordedAt: new Date().toISOString(),
    });

    const updateTime = typeof existingDocument.updateTime === 'string'
      ? existingDocument.updateTime
      : '';
    if (!updateTime) throw new Error('MESSAGE_CONTENT_UPDATE_TIME_MISSING');

    const token = await this.tokenProvider.getAccessToken();
    const response = await this.fetchImpl(this.commitUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        writes: [{
          update: {
            name: this.fullDocumentName(path),
            fields: recordFields(next),
          },
          currentDocument: { updateTime },
        }],
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const status = await errorStatus(response);
      if (response.status === 409 || response.status === 412 || status === 'FAILED_PRECONDITION') {
        throw new Error('MESSAGE_CONTENT_VERSION_CONFLICT');
      }
      throw new Error(`MESSAGE_CONTENT_UPDATE_${response.status}`);
    }

    return next;
  }

  private fullDocumentName(path: string[]): string {
    return `projects/${this.projectId}/databases/(default)/documents/${path.join('/')}`;
  }

  private async getDocument(path: string[]): Promise<FirestoreDocument | null> {
    const token = await this.tokenProvider.getAccessToken();
    const response = await this.fetchImpl(
      `${this.documentsBase}/${encodedPath(path)}`,
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
    if (!response.ok) throw new Error(`MESSAGE_CONTENT_GET_${response.status}`);
    return await response.json() as FirestoreDocument;
  }
}
