import assert from 'node:assert/strict';
import { createNestFinancePendingDocumentsHttpHandler } from '../core/runtime/nestFinancePendingDocumentsHttpHandler';
class Result { code = 200; body: any; headers = {}; status(n: number) { this.code = n; return this; } json(value: unknown) { this.body = value; return this; } setHeader(k: string, v: string) { this.headers[k] = v; } }
const req = { headers: { authorization: 'Bearer synthetic-user-token' }, body: { organizationId: 'synthetic-org', financeEntityId: 'synthetic-entity' } };
let calls = 0, authorized = true, org = 'synthetic-org', granted = true; const audits: unknown[] = [];
const provider = { async resolve(input: any) { assert.deepEqual(input, { authToken: req.headers.authorization, requestedOrganizationId: 'synthetic-org' }); return authorized ? { status: 'resolved', context: { organizationId: org, appAccess: { nestfinance: granted } } } : { status: 'denied' }; } } as any;
let status = 200, payload: unknown = { schemaVersion: 1, summary: { awaitingUpload: 2, needsClassification: 3, pendingReview: 4, secret: 'PRIVATE' }, items: ['PRIVATE'] };
const fetchImpl: typeof fetch = async (url, init) => {
  calls++; assert.equal(url, 'https://nestfinance.millionsnest.com/api/finance-gateway?operation=connect-pending-documents');
  assert.equal(init.redirect, 'error'); assert.equal(init.method, 'POST');
  assert.deepEqual(init.headers, { Authorization: req.headers.authorization, 'x-organization-id': 'synthetic-org', 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(String(init.body)), { financeEntityId: 'synthetic-entity' });
  return new Response(JSON.stringify(payload), { status });
};
const handler = createNestFinancePendingDocumentsHttpHandler({ contextProvider: provider, fetchImpl, audit: event => audits.push(event) });
const invoke = async (request = req) => { const result = new Result(); await handler(request as any, result as any); return result; };
const success = await invoke(); assert.equal(success.code, 200); assert.deepEqual(success.body.summary, { awaitingUpload: 2, needsClassification: 3, pendingReview: 4 }); assert.equal(success.headers['Cache-Control'], 'no-store'); assert(!JSON.stringify(success.body).includes('PRIVATE'));
assert(!JSON.stringify(audits).includes('synthetic-user-token')); assert(!JSON.stringify(audits).includes('synthetic-org')); assert(!JSON.stringify(audits).includes('PRIVATE'));
for (const change of ['deny', 'wrong-org', 'app-denied']) {
  authorized = change !== 'deny'; org = change === 'wrong-org' ? 'other-org' : 'synthetic-org'; granted = change !== 'app-denied'; assert.equal((await invoke()).code, 403);
}
assert.equal(calls, 1); authorized = true; org = 'synthetic-org'; granted = true;
assert.equal((await invoke({ ...req, headers: {} } as any)).code, 401);
for (const body of [{ ...req.body, role: 'owner' }, { ...req.body, uid: 'injected' }, { ...req.body, financeEntityId: '../other' }, { ...req.body, organizationId: '' }]) assert.equal((await invoke({ ...req, body } as any)).code, 400);
assert.equal(calls, 1);
for (const rejected of [401, 403, 404, 409, 500, 503]) { status = rejected; payload = { error: 'PRIVATE' }; const result = await invoke(); assert.equal(result.code, rejected < 500 ? rejected : 503); assert(!JSON.stringify(result.body).includes('PRIVATE')); }
status = 200;
for (const invalid of [null, {}, { schemaVersion: 2, summary: {} }, { schemaVersion: 1, summary: { awaitingUpload: -1, needsClassification: 3, pendingReview: 4 } }]) { payload = invalid; assert.equal((await invoke()).code, 503); }
const transportError = createNestFinancePendingDocumentsHttpHandler({ contextProvider: provider, fetchImpl: async () => { throw new Error('PRIVATE token'); } });
const failed = new Result(); await transportError(req as any, failed as any); assert.equal(failed.code, 503); assert(!JSON.stringify(failed.body).includes('PRIVATE'));
console.log('Finance Core tool: fresh Hub/app/tenant authority, canonical domain scope, injection/status/privacy/audit/transport denial passed');
