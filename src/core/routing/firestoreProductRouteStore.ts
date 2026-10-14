import { GoogleMetadataAccessTokenProvider, type ConnectRuntimeAccessTokenProvider } from '../inbox/firestoreThreadStore';
import { applyProductRoute, routingId, type ProductRouteStore, type ProductRoutingState } from './productRouting';
export class FirestoreProductRouteStore implements ProductRouteStore {
  private readonly base: string;
  private readonly token: ConnectRuntimeAccessTokenProvider;
  constructor(projectId: string, private readonly fetchImpl: typeof fetch = fetch, token?: ConnectRuntimeAccessTokenProvider) {
    if (!/^[a-z0-9][a-z0-9-]{4,62}[a-z0-9]$/.test(projectId)) throw new Error('INVALID_FIRESTORE_PROJECT_ID');
    this.base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/connectProductRoutes/`;
    this.token = token ?? new GoogleMetadataAccessTokenProvider({ fetchImpl });
  }
  async decide(input: Parameters<ProductRouteStore['decide']>[0], nowMs: number, originSecret?: string) {
    for (const scope of [input.organizationId, input.conversationId, input.eventId]) {
      if (!scope || scope.length > 180 || /[\\/]/.test(scope)) throw new Error('INVALID_PRODUCT_ROUTING_SCOPE');
    }
    const url = this.base + routingId(input.organizationId, input.conversationId);
    const headers = { Authorization: `Bearer ${await this.token.getAccessToken()}`, 'Content-Type': 'application/json' };
    for (let attempt = 0; attempt < 3; attempt++) {
      const read = await this.fetchImpl(url, { headers, signal: AbortSignal.timeout(8000) });
      if (!read.ok && read.status !== 404) throw new Error('PRODUCT_ROUTING_STORAGE_UNAVAILABLE');
      const doc = read.ok ? await read.json() as { updateTime: string; fields: { recordJson: { stringValue: string } } } : null;
      const state = doc ? JSON.parse(doc.fields.recordJson.stringValue) as ProductRoutingState : null;
      const applied = applyProductRoute(state, input, nowMs, originSecret);
      if (applied.duplicate) return applied.decision;
      const condition = doc ? `currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}` : 'currentDocument.exists=false';
      const write = await this.fetchImpl(`${url}?${condition}`, { method: 'PATCH', headers, signal: AbortSignal.timeout(8000), body: JSON.stringify({ fields: {
        organizationId: { stringValue: input.organizationId }, conversationId: { stringValue: input.conversationId },
        recordJson: { stringValue: JSON.stringify(applied.state) }, expiresAt: { timestampValue: new Date(nowMs + 90 * 86400000).toISOString() },
      } }) });
      if ([409, 412].includes(write.status)) continue;
      if (!write.ok) throw new Error('PRODUCT_ROUTING_STORAGE_UNAVAILABLE');
      return applied.decision;
    }
    throw new Error('PRODUCT_ROUTING_CONCURRENT_UPDATE');
  }
}
