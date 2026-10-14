import { GoogleMetadataAccessTokenProvider, type ConnectRuntimeAccessTokenProvider } from '../inbox/firestoreThreadStore';
import { pushId, type PushDevice } from './pushPolicy';
export type PushReadMarker = { eventId: string; recordedAt: string };
export type PushReadMarkers = Record<string, PushReadMarker>;

export interface PushStore {
  readMarkers(organizationId: string, actorUid: string): Promise<PushReadMarkers>;
  markRead(organizationId: string, actorUid: string, conversationId: string, eventId: string): Promise<void>;
  save(device: PushDevice): Promise<void>;
  get(deviceId: string): Promise<PushDevice | null>;
  list(organizationId: string): Promise<PushDevice[]>;
  remove(organizationId: string, actorUid: string, deviceId: string): Promise<void>;
  deliveryStatus(id: string): Promise<string | null>;
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
  private async markerDocument(organizationId: string, actorUid: string) {
    const path = `/connectPushReadStates/${pushId(organizationId, actorUid)}`;
    const r = await this.request(path);
    if (r.status === 404) return { path, markers: {} as PushReadMarkers, updateTime: null };
    if (!r.ok) throw new Error('PUSH_STORAGE_UNAVAILABLE');
    const doc = await r.json() as { updateTime: string; fields: { organizationId: { stringValue: string }; actorUid: { stringValue: string }; recordJson: { stringValue: string } } };
    if (doc.fields.organizationId.stringValue !== organizationId || doc.fields.actorUid.stringValue !== actorUid) throw new Error('PUSH_READ_SCOPE_DENIED');
    return { path, markers: JSON.parse(doc.fields.recordJson.stringValue) as PushReadMarkers, updateTime: doc.updateTime };
  }
  async readMarkers(organizationId: string, actorUid: string): Promise<PushReadMarkers> {
    return (await this.markerDocument(organizationId, actorUid)).markers;
  }
  async markRead(organizationId: string, actorUid: string, conversationId: string, eventId: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { path, markers, updateTime } = await this.markerDocument(organizationId, actorUid);
      Object.defineProperty(markers, conversationId, { value: { eventId, recordedAt: new Date().toISOString() }, enumerable: true, configurable: true, writable: true });
      const bounded = Object.fromEntries(Object.entries(markers).sort((a, b) => b[1].recordedAt.localeCompare(a[1].recordedAt)).slice(0, 250));
      const condition = updateTime ? `currentDocument.updateTime=${encodeURIComponent(updateTime)}` : 'currentDocument.exists=false';
      const r = await this.request(`${path}?${condition}`, { method: 'PATCH', body: JSON.stringify({ fields: {
        organizationId: { stringValue: organizationId }, actorUid: { stringValue: actorUid }, recordJson: { stringValue: JSON.stringify(bounded) },
        expiresAt: { timestampValue: new Date(Date.now() + 90 * 86400000).toISOString() },
      } }) });
      if ([409, 412].includes(r.status)) continue;
      if (!r.ok) throw new Error('PUSH_STORAGE_UNAVAILABLE');
      return;
    }
    throw new Error('PUSH_READ_CONCURRENT_UPDATE');
  }
  async get(deviceId: string): Promise<PushDevice | null> {
    if (!/^[a-f0-9]{64}$/.test(deviceId)) throw new Error('INVALID_DEVICE_ID');
    const r = await this.request(`/connectPushDevices/${deviceId}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('PUSH_STORAGE_UNAVAILABLE');
    const doc = await r.json() as { fields: { recordJson: { stringValue: string } } };
    return JSON.parse(doc.fields.recordJson.stringValue) as PushDevice;
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
  async deliveryStatus(id: string): Promise<string | null> {
    const r = await this.request(`/connectPushDeliveries/${id}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('PUSH_STORAGE_UNAVAILABLE');
    const doc = await r.json() as { fields: { status?: { stringValue?: string } } };
    return doc.fields.status?.stringValue ?? null;
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
