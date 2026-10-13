import {
  GoogleMetadataAccessTokenProvider,
  type ConnectRuntimeAccessTokenProvider,
} from './firestoreThreadStore';

/** Only an organization-scoped, Hub-authorized operator may own a thread. */
export type ConnectInboxOperator = Readonly<{
  uid: string;
  displayName: string;
  role: string;
}>;

export interface ConnectInboxOperatorDirectory {
  list(input: { organizationId: string }): Promise<readonly ConnectInboxOperator[]>;
  verify(input: { organizationId: string; uid: string }): Promise<boolean>;
}

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, any>;
};

function safeSegment(value: string): string {
  const clean = value.trim();
  if (!clean || clean.length > 180 || clean === '.' || clean === '..' ||
      clean.includes('/') || clean.includes('\\')) throw new Error('INBOX_DIRECTORY_SCOPE_INVALID');
  return encodeURIComponent(clean);
}

function readStr(fields: Record<string, any> | undefined, name: string): string {
  const value = fields?.[name]?.stringValue;
  return typeof value === 'string' ? value.trim() : '';
}

function inactive(fields: Record<string, any> | undefined): boolean {
  const state = (readStr(fields, 'status') || readStr(fields, 'membershipStatus')).toLowerCase();
  return ['inactive', 'disabled', 'removed', 'revoked', 'archived', 'suspended', 'pending', 'invited', 'requested'].includes(state) ||
    fields?.disabled?.booleanValue === true || fields?.isActive?.booleanValue === false;
}

function grantsManage(fields: Record<string, any> | undefined): boolean {
  const grants = ['connect.inbox.manage', 'connect.manage', '*'];
  const permissions = fields?.permissions;
  const capabilities = fields?.capabilities;
  for (const candidate of [permissions, capabilities]) {
    if (!candidate) continue;
    if (candidate.mapValue?.fields && grants.some(key =>
      candidate.mapValue.fields[key]?.booleanValue === true)) return true;
    if (candidate.arrayValue?.values?.some((item: any) =>
      typeof item?.stringValue === 'string' && grants.includes(item.stringValue.toLowerCase()))) return true;
  }
  return false;
}

/** Treat Hub's canonical organization member document as the source of truth. */
export function isEligibleInboxOperatorMembership(fields: Record<string, any> | undefined): boolean {
  if (!fields || inactive(fields)) return false;
  const role = (readStr(fields, 'organizationRole') || readStr(fields, 'role')).toLowerCase();
  return role === 'owner' || role === 'admin' || grantsManage(fields);
}

function canonicalMemberId(doc: FirestoreDocument): string {
  const raw = doc.name?.split('/').at(-1) || '';
  try {
    return decodeURIComponent(raw);
  } catch { return ''; }
}

function toOperator(doc: FirestoreDocument): ConnectInboxOperator | null {
  if (!isEligibleInboxOperatorMembership(doc.fields)) return null;
  const uid = canonicalMemberId(doc);
  if (!uid || uid.includes('/') || uid.includes('\\') || uid.length > 180) return null;
  const role = readStr(doc.fields, 'organizationRole') || readStr(doc.fields, 'role') || 'member';
  const rawName = readStr(doc.fields, 'displayName') || readStr(doc.fields, 'name');
  const name = rawName.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return { uid, role, displayName: name || 'Atendente' };
}

export interface HubFirestoreInboxOperatorDirectoryOptions {
  projectId?: string;
  fetchImpl?: typeof fetch;
  tokenProvider?: ConnectRuntimeAccessTokenProvider;
}

export class HubFirestoreInboxOperatorDirectory implements ConnectInboxOperatorDirectory {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;
  private readonly tokenProvider: ConnectRuntimeAccessTokenProvider;

  constructor(options: HubFirestoreInboxOperatorDirectoryOptions = {}) {
    const projectId = options.projectId || 'millionsnest';
    if (!/^[a-z0-9][a-z0-9-]{4,62}[a-z0-9]$/.test(projectId)) {
      throw new Error('INVALID_FIRESTORE_PROJECT_ID');
    }
    this.base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.tokenProvider = options.tokenProvider ?? new GoogleMetadataAccessTokenProvider({
      fetchImpl: this.fetchImpl,
    });
  }

  async verify(input: { organizationId: string; uid: string }): Promise<boolean> {
    const organizationId = safeSegment(input.organizationId);
    const uid = safeSegment(input.uid);
    const token = await this.tokenProvider.getAccessToken();
    const response = await this.fetchImpl(
      `${this.base}/organizations/${organizationId}/members/${uid}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
      },
    );
    if (response.status === 404) return false;
    if (!response.ok) throw new Error('INBOX_DIRECTORY_UNAVAILABLE');
    const doc = await response.json() as FirestoreDocument;
    if (!isEligibleInboxOperatorMembership(doc.fields)) return false;
    // Also reject disabled/suspended Hub accounts, not merely memberships.
    const userResponse = await this.fetchImpl(`${this.base}/users/${uid}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (userResponse.status === 404) return false;
    if (!userResponse.ok) throw new Error('INBOX_DIRECTORY_UNAVAILABLE');
    const userDoc = await userResponse.json() as FirestoreDocument;
    return !!userDoc.fields && !inactive(userDoc.fields);
  }

  async list(input: { organizationId: string }): Promise<readonly ConnectInboxOperator[]> {
    const organizationId = safeSegment(input.organizationId);
    const token = await this.tokenProvider.getAccessToken();
    // Bounded per-request cost; larger directories should use a cursor.
    const url = `${this.base}/organizations/${organizationId}/members?pageSize=100`;
    const response = await this.fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.status === 404) return [];
    if (!response.ok) throw new Error('INBOX_DIRECTORY_UNAVAILABLE');
    const payload = await response.json() as { documents?: FirestoreDocument[] };
    return (payload.documents || []).map(toOperator).filter((item): item is ConnectInboxOperator => !!item)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
  }
}
