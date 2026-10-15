import { GoogleMetadataAccessTokenProvider, type ConnectRuntimeAccessTokenProvider } from '../inbox/firestoreThreadStore';
import { parseAgentSettingsRecord, reviseAgentSettings, validAgentProduct, validAgentScope,
  type ProductAgentSettingsStore, type ProductAgentSettingsWrite } from './productAgentSettings';

/** Only server runtime credentials; no browser SDK, collection scans or process-local persistence. */
export class FirestoreProductAgentSettingsStore implements ProductAgentSettingsStore {
  private readonly base: string;
  private readonly token: ConnectRuntimeAccessTokenProvider;
  constructor(projectId: string, private readonly fetchImpl: typeof fetch = fetch,
    token?: ConnectRuntimeAccessTokenProvider, private readonly now: () => Date = () => new Date()) {
    if (!/^[a-z0-9][a-z0-9-]{4,62}[a-z0-9]$/.test(projectId)) throw new Error('INVALID_FIRESTORE_PROJECT_ID');
    this.base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    this.token = token ?? new GoogleMetadataAccessTokenProvider({ fetchImpl });
  }
  private url(scope: Parameters<ProductAgentSettingsStore['read']>[0]) {
    if (!validAgentScope(scope.organizationId) || !validAgentProduct(scope.product)) throw new Error('AGENT_SETTINGS_INVALID');
    return `${this.base}/organizations/${encodeURIComponent(scope.organizationId)}/connectAgentProfiles/${scope.product}`;
  }
  private async snapshot(scope: Parameters<ProductAgentSettingsStore['read']>[0], headers: Record<string, string>) {
    const response = await this.fetchImpl(this.url(scope), { method: 'GET', headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('AGENT_SETTINGS_UNAVAILABLE');
    const doc = await response.json();
    if (typeof doc?.updateTime !== 'string' || !Number.isFinite(Date.parse(doc.updateTime)) ||
        doc.fields?.organizationId?.stringValue !== scope.organizationId || doc.fields?.product?.stringValue !== scope.product ||
        typeof doc.fields?.recordJson?.stringValue !== 'string' || doc.fields.recordJson.stringValue.length > 20000) throw new Error('AGENT_SETTINGS_STORAGE_INVALID');
    return { updateTime: doc.updateTime as string, record: parseAgentSettingsRecord(JSON.parse(doc.fields.recordJson.stringValue), scope) };
  }
  async read(scope: Parameters<ProductAgentSettingsStore['read']>[0]) {
    this.url(scope);
    const headers = { Authorization: `Bearer ${await this.token.getAccessToken()}` };
    return (await this.snapshot(scope, headers))?.record ?? null;
  }
  async save(input: ProductAgentSettingsWrite) {
    const url = this.url(input);
    // Validate before any provider request; no unbounded/invalid input reaches storage.
    reviseAgentSettings(null, { ...input, expectedVersion: 0 }, this.now());
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 || input.expectedVersion >= Number.MAX_SAFE_INTEGER) throw new Error('AGENT_SETTINGS_INVALID');
    const headers = { Authorization: `Bearer ${await this.token.getAccessToken()}`, 'Content-Type': 'application/json' };
    const current = await this.snapshot(input, headers);
    const next = reviseAgentSettings(current?.record ?? null, input, this.now());
    if (next.replayed) return next;
    const condition = current ? `currentDocument.updateTime=${encodeURIComponent(current.updateTime)}` : 'currentDocument.exists=false';
    const response = await this.fetchImpl(`${url}?${condition}`, { method: 'PATCH', headers, redirect: 'error', signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ fields: { organizationId: { stringValue: input.organizationId }, product: { stringValue: input.product }, recordJson: { stringValue: JSON.stringify(next.record) } } }) });
    if ([409, 412].includes(response.status)) throw new Error('AGENT_SETTINGS_CONFLICT');
    if (!response.ok) throw new Error('AGENT_SETTINGS_UNAVAILABLE');
    return next;
  }
}
