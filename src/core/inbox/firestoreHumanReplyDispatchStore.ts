import type {
  BeginHumanReplyDispatchResult,
  HumanReplyDispatchRecord,
  HumanReplyDispatchStore,
  HumanReplyDispatchStatus,
} from './humanReplyDispatchStore';
import { createHumanReplyDispatchId } from './humanReplyDispatchStore';
import {
  GoogleMetadataAccessTokenProvider,
  type ConnectRuntimeAccessTokenProvider,
} from './firestoreThreadStore';

const DEFAULT_PROJECT_ID = 'millionsnest';
const STORAGE_SCHEMA_VERSION = 1;

type FirestoreDocument = {
  fields?: Record<string, any>;
  updateTime?: string;
};

export interface FirestoreHumanReplyDispatchStoreOptions {
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

function safeSegment(value: string, maxLength = 300): string {
  const clean = value.trim();
  if (!clean || clean.length > maxLength || clean.includes('/') || clean.includes('\\')) {
    throw new Error('INVALID_DOCUMENT_SEGMENT');
  }
  return clean;
}

function encodedPath(parts: string[]): string {
  return parts.map((part) => encodeURIComponent(safeSegment(part, 900))).join('/');
}

function stringValue(value: string) {
  return { stringValue: value };
}

function integerValue(value: number) {
  return { integerValue: String(value) };
}

function readString(document: FirestoreDocument, field: string): string | null {
  const value = document.fields?.[field]?.stringValue;
  return typeof value === 'string' ? value : null;
}

function pathOf(record: Pick<HumanReplyDispatchRecord, 'organizationId' | 'dispatchId'>): string[] {
  return [
    'connectSensitiveOrganizations',
    safeSegment(record.organizationId, 180),
    'humanReplyDispatches',
    safeSegment(record.dispatchId, 300),
  ];
}

function fieldsOf(record: HumanReplyDispatchRecord): Record<string, unknown> {
  return {
    storageSchemaVersion: integerValue(STORAGE_SCHEMA_VERSION),
    organizationId: stringValue(record.organizationId),
    conversationId: stringValue(record.conversationId),
    dispatchId: stringValue(record.dispatchId),
    requestId: stringValue(record.requestId),
    bodyFingerprint: stringValue(record.bodyFingerprint),
    status: stringValue(record.status),
    createdAt: stringValue(record.createdAt),
    updatedAt: stringValue(record.updatedAt),
    ...(record.providerMessageId ? { providerMessageId: stringValue(record.providerMessageId) } : {}),
    ...(record.errorCode ? { errorCode: stringValue(record.errorCode) } : {}),
  };
}

function parse(document: FirestoreDocument): HumanReplyDispatchRecord {
  if (Number(document.fields?.storageSchemaVersion?.integerValue) !== STORAGE_SCHEMA_VERSION) {
    throw new Error('HUMAN_REPLY_DISPATCH_INVALID');
  }
  const organizationId = readString(document, 'organizationId');
  const conversationId = readString(document, 'conversationId');
  const dispatchId = readString(document, 'dispatchId');
  const requestId = readString(document, 'requestId');
  const bodyFingerprint = readString(document, 'bodyFingerprint');
  const status = readString(document, 'status') as HumanReplyDispatchStatus | null;
  const createdAt = readString(document, 'createdAt');
  const updatedAt = readString(document, 'updatedAt');

  if (
    !organizationId ||
    !conversationId ||
    !dispatchId ||
    !requestId ||
    !bodyFingerprint ||
    !status ||
    !['dispatching', 'sent', 'failed', 'ambiguous_after_provider_accept'].includes(status) ||
    !createdAt ||
    !updatedAt
  ) {
    throw new Error('HUMAN_REPLY_DISPATCH_INVALID');
  }

  return {
    schemaVersion: 1,
    organizationId,
    conversationId,
    dispatchId,
    requestId,
    bodyFingerprint,
    status,
    createdAt,
    updatedAt,
    providerMessageId: readString(document, 'providerMessageId') || undefined,
    errorCode: readString(document, 'errorCode') || undefined,
  };
}

export class FirestoreHumanReplyDispatchStore implements HumanReplyDispatchStore {
  private readonly projectId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly tokenProvider: ConnectRuntimeAccessTokenProvider;
  private readonly documentsBase: string;
  private readonly commitUrl: string;

  constructor(options: FirestoreHumanReplyDispatchStoreOptions = {}) {
    this.projectId = safeProjectId(options.projectId);
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.tokenProvider = options.tokenProvider ?? new GoogleMetadataAccessTokenProvider({
      fetchImpl: this.fetchImpl,
    });
    const database = `projects/${this.projectId}/databases/(default)`;
    this.documentsBase = `https://firestore.googleapis.com/v1/${database}/documents`;
    this.commitUrl = `https://firestore.googleapis.com/v1/${database}/documents:commit`;
  }

  async begin(input: {
    organizationId: string;
    conversationId: string;
    requestId: string;
    bodyFingerprint: string;
    now: string;
  }): Promise<BeginHumanReplyDispatchResult> {
    const dispatchId = createHumanReplyDispatchId(input);
    const record: HumanReplyDispatchRecord = {
      schemaVersion: 1,
      organizationId: safeSegment(input.organizationId, 180),
      conversationId: safeSegment(input.conversationId, 180),
      dispatchId,
      requestId: safeSegment(input.requestId, 180),
      bodyFingerprint: safeSegment(input.bodyFingerprint, 128),
      status: 'dispatching',
      createdAt: new Date(input.now).toISOString(),
      updatedAt: new Date(input.now).toISOString(),
    };

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
            name: this.fullName(pathOf(record)),
            fields: fieldsOf(record),
          },
          currentDocument: { exists: false },
        }],
      }),
      cache: 'no-store',
    });

    if (response.ok) return { kind: 'created', record };

    const existing = await this.get(record.organizationId, dispatchId);
    if (!existing) throw new Error(`HUMAN_REPLY_DISPATCH_BEGIN_${response.status}`);
    if (
      existing.conversationId !== record.conversationId ||
      existing.requestId !== record.requestId ||
      existing.bodyFingerprint !== record.bodyFingerprint
    ) {
      throw new Error('HUMAN_REPLY_IDEMPOTENCY_COLLISION');
    }
    return { kind: 'existing', record: existing };
  }

  async markSent(input: {
    record: HumanReplyDispatchRecord;
    providerMessageId: string;
    now: string;
  }) {
    return this.update({
      ...input.record,
      status: 'sent',
      providerMessageId: safeSegment(input.providerMessageId, 300),
      errorCode: undefined,
      updatedAt: new Date(input.now).toISOString(),
    });
  }

  async markFailed(input: {
    record: HumanReplyDispatchRecord;
    errorCode: string;
    now: string;
  }) {
    return this.update({
      ...input.record,
      status: 'failed',
      errorCode: safeSegment(input.errorCode, 180),
      updatedAt: new Date(input.now).toISOString(),
    });
  }

  async markAmbiguous(input: {
    record: HumanReplyDispatchRecord;
    providerMessageId: string;
    errorCode: string;
    now: string;
  }) {
    return this.update({
      ...input.record,
      status: 'ambiguous_after_provider_accept',
      providerMessageId: safeSegment(input.providerMessageId, 300),
      errorCode: safeSegment(input.errorCode, 180),
      updatedAt: new Date(input.now).toISOString(),
    });
  }

  private async update(record: HumanReplyDispatchRecord): Promise<HumanReplyDispatchRecord> {
    const path = pathOf(record);
    const current = await this.getDocument(path);
    if (!current?.updateTime) throw new Error('HUMAN_REPLY_DISPATCH_MISSING');

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
            name: this.fullName(path),
            fields: fieldsOf(record),
          },
          currentDocument: { updateTime: current.updateTime },
        }],
      }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`HUMAN_REPLY_DISPATCH_UPDATE_${response.status}`);
    return record;
  }

  private async get(organizationId: string, dispatchId: string) {
    const document = await this.getDocument(pathOf({ organizationId, dispatchId }));
    return document ? parse(document) : null;
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
    if (!response.ok) throw new Error(`HUMAN_REPLY_DISPATCH_GET_${response.status}`);
    return await response.json() as FirestoreDocument;
  }

  private fullName(path: string[]): string {
    return `projects/${this.projectId}/databases/(default)/documents/${path.join('/')}`;
  }
}
