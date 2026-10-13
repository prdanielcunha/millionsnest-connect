import type { InboxContactProfile, InboxContactProfileStore } from './inboxContactProfileStore';
import { filterAuthorizedInboxContactProfiles, inboxContactMatchesSearch, inboxContactSearchKeys, inboxContactSearchTerm, makeInboxContactProfile } from './inboxContactProfileStore';
import {
  GoogleMetadataAccessTokenProvider,
  type ConnectRuntimeAccessTokenProvider,
} from './firestoreThreadStore';

export interface FirestoreInboxContactProfileStoreOptions {
  projectId?: string;
  fetchImpl?: typeof fetch;
  tokenProvider?: ConnectRuntimeAccessTokenProvider;
  retentionDays?: number;
  now?: () => Date;
}

function safePathSegment(raw: string): string {
  const value = raw.trim();
  if (!value || value.length > 180 || value === '.' || value === '..' ||
      value.includes('/') || value.includes('\\')) {
    throw new Error('INBOX_CONTACT_SCOPE_INVALID');
  }
  return encodeURIComponent(value);
}

function fieldString(value: string) { return { stringValue: value }; }

function readField(doc: any, key: string): string {
  const value = doc?.fields?.[key]?.stringValue;
  return typeof value === 'string' ? value : '';
}

/**
 * Deliberately NOT part of the canonical Inbox event store or the personal
 * Radar vault. Requires operator-enabled Firestore TTL policy for expiresAt.
 * Service-account credentials never reach the browser.
 */
export class FirestoreInboxContactProfileStore implements InboxContactProfileStore {
  private readonly fetchImpl: typeof fetch;
  private readonly tokenProvider: ConnectRuntimeAccessTokenProvider;
  private readonly base: string;
  private readonly retentionDays: number;
  private readonly now: () => Date;

  constructor(options: FirestoreInboxContactProfileStoreOptions = {}) {
    const projectId = options.projectId || 'millionsnest';
    if (!/^[a-z0-9][a-z0-9-]{4,62}[a-z0-9]$/.test(projectId)) {
      throw new Error('INVALID_FIRESTORE_PROJECT_ID');
    }
    this.base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.tokenProvider = options.tokenProvider ?? new GoogleMetadataAccessTokenProvider({
      fetchImpl: this.fetchImpl,
    });
    this.retentionDays = options.retentionDays ?? 90;
    this.now = options.now ?? (() => new Date());
  }

  private documentPath(organizationId: string, conversationId: string): string {
    return `connectSensitiveOrganizations/${safePathSegment(organizationId)}/inboxContactProfiles/${safePathSegment(conversationId)}`;
  }

  async upsert(input: {
    organizationId: string;
    conversationId: string;
    displayName: string;
    observedAt: string;
  }): Promise<void> {
    const record = makeInboxContactProfile(input, this.retentionDays);
    const token = await this.tokenProvider.getAccessToken();
    const response = await this.fetchImpl(
      `${this.base}/${this.documentPath(record.organizationId, record.conversationId)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          fields: {
            organizationId: fieldString(record.organizationId),
            conversationId: fieldString(record.conversationId),
            displayName: fieldString(record.displayName),
            source: fieldString(record.source),
            observedAt: fieldString(record.observedAt),
            expiresAt: { timestampValue: record.expiresAt },
            searchKeys: { arrayValue: { values: inboxContactSearchKeys(record.displayName).map(fieldString) } },
          },
        }),
        cache: 'no-store',
      },
    );
    if (!response.ok) throw new Error('INBOX_CONTACT_PROFILE_WRITE_UNAVAILABLE');
  }

  async list(input: {
    organizationId: string;
    conversationIds: readonly string[];
  }): Promise<readonly InboxContactProfile[]> {
    const ids = [...new Set(input.conversationIds)].slice(0, 100);
    if (!ids.length) return [];
    const token = await this.tokenProvider.getAccessToken();
    const documents = ids.map(id =>
      `projects/${this.base.split('/projects/')[1].split('/documents')[0]}/documents/${this.documentPath(input.organizationId, id)}`);
    const response = await this.fetchImpl(`${this.base}:batchGet`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ documents }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('INBOX_CONTACT_PROFILE_READ_UNAVAILABLE');
    const raw = await response.text();
    let results: any[];
    try {
      const parsed = JSON.parse(raw);
      results = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      try { results = raw.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)); }
      catch { throw new Error('INBOX_CONTACT_PROFILE_READ_INVALID'); }
    }

    const records: InboxContactProfile[] = [];
    for (const item of results) {
      const doc = item?.found;
      if (!doc) continue;
      const record: InboxContactProfile = {
        organizationId: readField(doc, 'organizationId'),
        conversationId: readField(doc, 'conversationId'),
        displayName: readField(doc, 'displayName'),
        source: readField(doc, 'source') as 'whatsapp_profile',
        observedAt: readField(doc, 'observedAt'),
        expiresAt: typeof doc.fields?.expiresAt?.timestampValue === 'string'
          ? doc.fields.expiresAt.timestampValue : '',
      };
      records.push(record);
    }
    return filterAuthorizedInboxContactProfiles(records, input.organizationId, ids, this.now());
  }
  async search(input: {
    organizationId: string;
    term: string;
    limit?: number;
  }): Promise<readonly InboxContactProfile[]> {
    const term = inboxContactSearchTerm(input.term);
    if (!term) return [];
    const safeOrg = safePathSegment(input.organizationId);
    const limit = Math.max(1, Math.min(input.limit ?? 20, 30));
    const token = await this.tokenProvider.getAccessToken();
    const response = await this.fetchImpl(
      `${this.base}/connectSensitiveOrganizations/${safeOrg}:runQuery`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'inboxContactProfiles' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'searchKeys' },
                op: 'ARRAY_CONTAINS',
                value: fieldString(term),
              },
            },
            limit,
          },
        }),
        cache: 'no-store',
      },
    );
    if (!response.ok) throw new Error('INBOX_CONTACT_SEARCH_UNAVAILABLE');
    const raw = await response.text();
    if (!raw.trim()) return [];
    let values: any[];
    try {
      const parsed = JSON.parse(raw);
      values = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      try { values = raw.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)); }
      catch { throw new Error('INBOX_CONTACT_SEARCH_INVALID'); }
    }
    const profiles: InboxContactProfile[] = [];
    for (const item of values) {
      const doc = item?.document;
      if (!doc) continue;
      profiles.push({
        organizationId: readField(doc, 'organizationId'),
        conversationId: readField(doc, 'conversationId'),
        displayName: readField(doc, 'displayName'),
        source: readField(doc, 'source') as 'whatsapp_profile',
        observedAt: readField(doc, 'observedAt'),
        expiresAt: typeof doc.fields?.expiresAt?.timestampValue === 'string'
          ? doc.fields.expiresAt.timestampValue : '',
      });
    }
    const candidates = profiles.filter(record => record.organizationId === input.organizationId &&
      inboxContactMatchesSearch(record.displayName, input.term));
    return filterAuthorizedInboxContactProfiles(
      candidates, input.organizationId, candidates.map(record => record.conversationId), this.now(),
    ).slice(0, limit);
  }

}
