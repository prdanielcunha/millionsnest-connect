import { GoogleMetadataAccessTokenProvider, type ConnectRuntimeAccessTokenProvider } from '../inbox/firestoreThreadStore';
import type { PushDevice } from './pushPolicy';

export interface PushStore {
  save(device: PushDevice): Promise<void>;
  list(organizationId: string): Promise<PushDevice[]>;
  remove(organizationId: string, actorUid: string, deviceId: string): Promise<void>;
  claim(id: string, expiresAt: string): Promise<boolean>;
  result(id: string, status: string): Promise<void>;
}
/** Connect-owned sensitive storage, accessed by runtime IAM only; never browser Firestore. */
export class FirestorePushStore implements PushStore {
  private readonly base: string;
  private readonly token: ConnectRuntimeAccessTokenProvider;
  constructor(projectId: string, private readonly fetchImpl: typeof fetch = fetch,
    token?: ConnectRuntimeAccessTokenProvider) {
    if (!/^[a-z0-9][a-z0-9-]{4,62}[a-z0-9]$/.test(projectId)) throw new Error('INVALID_FIRESTORE_PROJECT_ID');
    this.base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    this.token = token ?? new GoogleMetadataAccessTokenProvider({ fetchImpl });
  }
  private async request(path: string, init: RequestInit = {}) {
    return this.fetchImpl(`${this.base}${path}`, { ...init, signal: AbortSignal.timeout(8000), headers: {
      Authorization: `Bearer ${await this.token.getAccessToken()}`, 'Content-Type': 'application/json',
    } });
  }
  async save(device: PushDevice) {
    const r = await this.request(`/connectPushDevices/${device.id}`, { method: 'PATCH', body: JSON.stringify({ fields: {
      organizationId: { stringValue: device.organizationId }, actorUid: { stringValue: device.actorUid },
      recordJson: { stringValue: JSON.stringify(device) }, expiresAt: { timestampValue: device.expiresAt },
    } }) });
    if (!r.ok) throw new Error('PUSH_STORAGE_UNAVAILABLE');
  }
  async list(organizationId: string): Promise<PushDevice[]> {
    const r = await this.request(':runQuery', { method: 'POST', body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'connectPushDevices' }],
      where: { fieldFilter: { field: { fieldPath: 'organizationId' }, op: 'EQUAL', value: { stringValue: organizationId } } },
      limit: 101,
    } }) });
    if (!r.ok) throw new Error('PUSH_STORAGE_UNAVAILABLE');
    const rows = await r.json() as Array<{ document?: { fields?: { recordJson?: { stringValue?: string } } } }>;
    const devices = rows.flatMap(row => row.document?.fields?.recordJson?.stringValue
      ? [JSON.parse(row.document.fields.recordJson.stringValue) as PushDevice] : []);
    if (devices.length > 100) throw new Error('PUSH_DEVICE_LIMIT');
    return devices.filter(d => d.organizationId === organizationId);
  }
  async remove(organizationId: string, actorUid: string, deviceId: string) {
    if (!/^[a-f0-9]{64}$/.test(deviceId)) throw new Error('INVALID_DEVICE_ID');
    const path = `/connectPushDevices/${deviceId}`;
    const r = await this.request(path);
    if (r.status === 404) return;
    if (!r.ok) throw new Error('PUSH_STORAGE_UNAVAILABLE');
    const doc = await r.json() as { updateTime: string; fields: { recordJson: { stringValue: string } } };
    const d = JSON.parse(doc.fields.recordJson.stringValue) as PushDevice;
    if (d.organizationId !== organizationId || d.actorUid !== actorUid) throw new Error('PUSH_DEVICE_SCOPE_DENIED');
    const deleted = await this.request(`${path}?currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`, { method: 'DELETE' });
    if (!deleted.ok && deleted.status !== 404) throw new Error('PUSH_STORAGE_UNAVAILABLE');
  }
  async claim(id: string, expiresAt: string) {
    const r = await this.request(`/connectPushDeliveries/${id}?currentDocument.exists=false`, { method: 'PATCH', body: JSON.stringify({ fields: {
      status: { stringValue: 'reserved' }, expiresAt: { timestampValue: expiresAt },
    } }) });
    if ([409, 412].includes(r.status)) return false;
    if (!r.ok) throw new Error('PUSH_STORAGE_UNAVAILABLE');
    return true;
  }
  async result(id: string, status: string) {
    const r = await this.request(`/connectPushDeliveries/${id}?updateMask.fieldPaths=status&currentDocument.exists=true`, {
      method: 'PATCH', body: JSON.stringify({ fields: { status: { stringValue: status } } }),
    });
    if (!r.ok) throw new Error('PUSH_STORAGE_UNAVAILABLE');
  }
}
