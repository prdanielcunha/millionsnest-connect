import assert from 'node:assert/strict';
import { createNestFinanceEntitiesHttpHandler } from '../core/runtime/nestFinancePendingDocumentsHttpHandler';
import { listFinanceEntities, readFinancePendingDocuments } from '../core/client/liveFinanceReadClient';
import type { LiveConnectSession } from '../core/client/liveConnectSession';
import { bootstrapLiveConnectSession } from '../core/client/liveConnectSession';

class Result { code = 200; body: any; headers: Record<string, string> = {}; status(code: number) { this.code = code; return this; } json(body: unknown) { this.body = body; return this; } setHeader(key: string, value: string) { this.headers[key] = value; } }
const req = { headers: { authorization: 'Bearer synthetic-user-token' }, body: { organizationId: 'synthetic-org' } };
const audit: unknown[] = []; let upstream = 0, granted = true, active = 'synthetic-org';
let payload: any = { schemaVersion: 1, organizationId: 'synthetic-org', limited: false, entities: [{ id: 'synthetic-entity', displayName: 'Synthetic entity', taxId: 'PRIVATE' }], credential: 'PRIVATE' };
const handler = createNestFinanceEntitiesHttpHandler({
  contextProvider: { async resolve(input) { assert.equal(input.requestedOrganizationId, 'synthetic-org'); return { status: 'resolved', context: { organizationId: active, appAccess: { nestfinance: granted } } } as any; } },
  fetchImpl: async (url, init) => { upstream++; assert.equal(url, 'https://nestfinance.millionsnest.com/api/finance-gateway?operation=connect-entities'); assert.equal(init?.redirect, 'error'); assert.equal(init?.method, 'POST'); assert.equal(init?.body, '{}'); assert.equal((init?.headers as any)['X-Connect-User-Authorization'], req.headers.authorization); assert.equal((init?.headers as any)['x-organization-id'], 'synthetic-org'); return Response.json(payload); },
  audit: event => audit.push(event),
});
const invoke = async (request: any = req) => { const r = new Result(); await handler(request, r as any); return r; };
const success = await invoke(); assert.equal(success.code, 200); assert.equal(success.body.entities.length, 1); assert(!JSON.stringify(success.body).includes('PRIVATE')); assert.equal(success.headers['Cache-Control'], 'no-store');
assert(!JSON.stringify(audit).includes('synthetic-user-token')); assert(!JSON.stringify(audit).includes('synthetic-org'));
granted = false; assert.equal((await invoke()).code, 403); granted = true; active = 'other'; assert.equal((await invoke()).code, 403); active = 'synthetic-org'; assert.equal(upstream, 1);
for (const body of [{ ...req.body, financeEntityId: 'injected' }, { ...req.body, role: 'owner' }, { organizationId: '../other' }, { organizationId: ' synthetic-org ' }]) assert.equal((await invoke({ ...req, body })).code, 400);
assert.equal((await invoke({ ...req, headers: {} })).code, 401); assert.equal(upstream, 1);
for (const invalid of [null, {}, { ...payload, organizationId: 'other' }, { ...payload, limited: 'false' }, { ...payload, entities: [payload.entities[0], payload.entities[0]] }, { ...payload, entities: [{ id: '../other', displayName: 'Other' }] }]) { payload = invalid; assert.equal((await invoke()).code, 503); }

const session = { idToken: 'synthetic-user-token', expectedOrganizationId: 'synthetic-org' } as LiveConnectSession;
const signal = new AbortController().signal;
let calls = 0;
const fetchImpl: typeof fetch = async (url, init) => {
  calls++; assert.equal(init?.method, 'POST'); assert.equal(init?.cache, 'no-store'); assert.equal(init?.signal, signal); assert.equal((init?.headers as any).Authorization, req.headers.authorization);
  if (String(url).endsWith('/entities')) { assert.deepEqual(JSON.parse(String(init.body)), req.body); return Response.json({ schemaVersion: 1, organizationId: 'synthetic-org', limited: true, entities: [{ id: 'synthetic-entity', displayName: 'Synthetic entity', secret: 'PRIVATE' }] }); }
  assert.deepEqual(JSON.parse(String(init.body)), { organizationId: 'synthetic-org', financeEntityId: 'synthetic-entity' });
  return Response.json({ schemaVersion: 1, summary: { awaitingUpload: 1, needsClassification: 2, pendingReview: 3, extra: 'PRIVATE' } });
};
assert.deepEqual(await listFinanceEntities(session, signal, fetchImpl), { limited: true, entities: [{ id: 'synthetic-entity', displayName: 'Synthetic entity' }] });
assert.deepEqual(await readFinancePendingDocuments(session, 'synthetic-entity', signal, fetchImpl), { awaitingUpload: 1, needsClassification: 2, pendingReview: 3 });
assert.equal(calls, 2);
for (const status of [401, 403, 404, 503]) await assert.rejects(() => listFinanceEntities(session, signal, async () => new Response('PRIVATE provider body', { status })), new RegExp(status === 401 ? 'FINANCE_SESSION_REQUIRED' : status === 403 ? 'FINANCE_ACCESS_DENIED' : 'FINANCE_READ_UNAVAILABLE'));
await assert.rejects(() => listFinanceEntities(session, signal, async () => Response.json({ schemaVersion: 1, organizationId: 'other', limited: false, entities: [] })), /INVALID_FINANCE_RESPONSE/);
await assert.rejects(() => readFinancePendingDocuments(session, 'synthetic-entity', signal, async () => Response.json({ schemaVersion: 1, summary: { awaitingUpload: -1, needsClassification: 2, pendingReview: 3 } })), /INVALID_FINANCE_RESPONSE/);
await assert.rejects(() => readFinancePendingDocuments(session, '../other', signal, fetchImpl), /INVALID_FINANCE_SCOPE/); assert.equal(calls, 2);
const now = 1700000000000;
const encoded = Buffer.from(JSON.stringify({ appId: 'connect', protocolVersion: '1.0.0', orgId: 'synthetic-org', userId: 'synthetic-uid', customToken: 'synthetic-custom', expiresAt: now + 60000, supportMode: false })).toString('base64');
const grant = { appId: 'nestfinance', organizationId: 'synthetic-org', accessible: true, decisionState: 'granted' };
for (const [access, expected] of [[grant, true], [{ ...grant, organizationId: 'other' }, false], [{ ...grant, appId: 'musicscale' }, false], [{ ...grant, decisionState: 'denied' }, false], [undefined, false]] as const) {
  const restored = await bootstrapLiveConnectSession({ locationHref: `https://connect.example/?ecosystem_ctx=${encodeURIComponent(encoded)}`, replaceUrl() {}, now: () => now, configuredApiKey: 'synthetic-public-key',
    fetchFn: async url => String(url).startsWith('https://identitytoolkit.googleapis.com/') ? Response.json({ idToken: 'synthetic-id', localId: 'synthetic-uid' }) : Response.json({ success: true, protocolVersion: '1.0.0', user: { uid: 'synthetic-uid' }, activeOrganizationId: 'synthetic-org', activeOrganization: { id: 'synthetic-org', name: 'Synthetic', permissions: [], capabilities: [] }, appAccess: { musicscale: { accessible: false }, nestfinance: access } }),
  });
  assert.equal(restored.context.appAccess.find(item => item.appId === 'nestfinance')?.access, expected);
}
console.log('Live Finance selector/client: fresh Hub grant, tenant boundary, bounded minimal DTO, explicit entity scope, status/privacy/invalid-response and cancellation transport passed.');
