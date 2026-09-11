type FirestoreValue = Record<string, unknown>;

type PersonalVaultRecord = Record<string, unknown>;

const DEFAULT_PROJECT_ID = 'millionsnest';
const DEFAULT_BATCH_SIZE = 80;

function encodeValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { nullValue: null };
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      fields[key] = encodeValue(nested);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function decodeValue(value: any): unknown {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue?.fields || {});
  return null;
}

function encodeFields(record: PersonalVaultRecord): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [key, value] of Object.entries(record)) fields[key] = encodeValue(value);
  return fields;
}

function decodeFields(fields: Record<string, any>): PersonalVaultRecord {
  const record: PersonalVaultRecord = {};
  for (const [key, value] of Object.entries(fields || {})) record[key] = decodeValue(value);
  return record;
}

function cleanBearer(raw: string): string {
  const value = raw.trim();
  if (!value) throw new Error('AUTH_REQUIRED');
  return /^Bearer\s+/i.test(value) ? value : `Bearer ${value}`;
}

function safeSegment(raw: string): string {
  const value = raw.trim();
  if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    throw new Error('INVALID_DOCUMENT_SEGMENT');
  }
  return value;
}

function encodedPath(segments: string[]): string {
  return segments.map(segment => encodeURIComponent(safeSegment(segment))).join('/');
}

export type VaultWrite = {
  path: string[];
  data: PersonalVaultRecord;
};

export type VaultDocument = PersonalVaultRecord & { id: string };

export class FirestorePersonalVault {
  private readonly projectId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly documentsBase: string;
  private readonly commitUrl: string;

  constructor(options: { projectId?: string; fetchImpl?: typeof fetch } = {}) {
    this.projectId = options.projectId?.trim() || DEFAULT_PROJECT_ID;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const database = `projects/${this.projectId}/databases/(default)`;
    this.documentsBase = `https://firestore.googleapis.com/v1/${database}/documents`;
    this.commitUrl = `https://firestore.googleapis.com/v1/${database}/documents:commit`;
  }

  private ownerRoot(uid: string): string[] {
    return ['users', safeSegment(uid), 'connect', 'state'];
  }

  private fullDocumentName(uid: string, relativePath: string[]): string {
    const all = [...this.ownerRoot(uid), ...relativePath.map(safeSegment)];
    return `projects/${this.projectId}/databases/(default)/documents/${all.join('/')}`;
  }

  async get(
    authToken: string,
    uid: string,
    relativePath: string[],
  ): Promise<VaultDocument | null> {
    const path = encodedPath([...this.ownerRoot(uid), ...relativePath]);
    const response = await this.fetchImpl(`${this.documentsBase}/${path}`, {
      method: 'GET',
      headers: { Authorization: cleanBearer(authToken), Accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`FIRESTORE_GET_${response.status}`);
    const body = await response.json() as any;
    return {
      id: String(body.name || '').split('/').pop() || '',
      ...decodeFields(body.fields || {}),
    };
  }

  async list(
    authToken: string,
    uid: string,
    relativeCollectionPath: string[],
    maxDocuments = 1_500,
  ): Promise<VaultDocument[]> {
    const path = encodedPath([...this.ownerRoot(uid), ...relativeCollectionPath]);
    const result: VaultDocument[] = [];
    let pageToken = '';

    do {
      const url = new URL(`${this.documentsBase}/${path}`);
      url.searchParams.set('pageSize', '300');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: { Authorization: cleanBearer(authToken), Accept: 'application/json' },
        cache: 'no-store',
      });
      if (response.status === 404) return result;
      if (!response.ok) throw new Error(`FIRESTORE_LIST_${response.status}`);
      const body = await response.json() as any;
      for (const document of body.documents || []) {
        result.push({
          id: String(document.name || '').split('/').pop() || '',
          ...decodeFields(document.fields || {}),
        });
        if (result.length >= maxDocuments) return result;
      }
      pageToken = typeof body.nextPageToken === 'string' ? body.nextPageToken : '';
    } while (pageToken);

    return result;
  }

  async writeMany(authToken: string, uid: string, writes: VaultWrite[]): Promise<void> {
    for (let offset = 0; offset < writes.length; offset += DEFAULT_BATCH_SIZE) {
      const batch = writes.slice(offset, offset + DEFAULT_BATCH_SIZE);
      const response = await this.fetchImpl(this.commitUrl, {
        method: 'POST',
        headers: {
          Authorization: cleanBearer(authToken),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          writes: batch.map(write => ({
            update: {
              name: this.fullDocumentName(uid, write.path),
              fields: encodeFields(write.data),
            },
          })),
        }),
      });
      if (!response.ok) throw new Error(`FIRESTORE_COMMIT_${response.status}`);
    }
  }

  async deleteMany(authToken: string, uid: string, paths: string[][]): Promise<void> {
    for (let offset = 0; offset < paths.length; offset += DEFAULT_BATCH_SIZE) {
      const batch = paths.slice(offset, offset + DEFAULT_BATCH_SIZE);
      const response = await this.fetchImpl(this.commitUrl, {
        method: 'POST',
        headers: {
          Authorization: cleanBearer(authToken),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          writes: batch.map(path => ({ delete: this.fullDocumentName(uid, path) })),
        }),
      });
      if (!response.ok) throw new Error(`FIRESTORE_DELETE_${response.status}`);
    }
  }
}
