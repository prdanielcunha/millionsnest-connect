import assert from 'node:assert/strict';
import { createSupportOriginHttpHandler } from '../core/routing/supportOriginHttpHandler';
import { verifyProductOrigin } from '../core/routing/productRouting';
const now = 1800000000000, secret = 'test-only-support-origin-secret-at-least-32';
let org = 'org-a', finance = true;
const handler = createSupportOriginHttpHandler({ async resolve() { return { status: 'resolved', context: { actorUid: 'synthetic-user', organizationId: org, systemRole: null, globalAccess: false, organizationRole: 'member', capabilities: [], permissions: [], appAccess: { musicscale: true, nestfinance: finance, nestjourney: false } } }; } }, secret, () => now);
function response() { return { statusCode: 200, payload: {} as any, setHeader() {}, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.payload = body; return this; } }; }
const req = { headers: { authorization: 'Bearer transient-token' }, body: { organizationId: 'org-a', product: 'nestfinance' } };
let res = response(); await handler(req as any, res as any); assert.equal(res.statusCode, 200); assert.equal(verifyProductOrigin(res.payload.originHint, secret, now), 'nestfinance');
assert(!JSON.stringify(res.payload).includes('synthetic-user')); assert(!JSON.stringify(res.payload).includes('org-a')); assert(!JSON.stringify(res.payload).includes(secret));
finance = false; res = response(); await handler(req as any, res as any); assert.equal(res.statusCode, 403);
finance = true; org = 'org-b'; res = response(); await handler(req as any, res as any); assert.equal(res.statusCode, 403);
res = response(); await handler({ ...req, headers: {} } as any, res as any); assert.equal(res.statusCode, 401);
res = response(); await handler({ ...req, body: { ...req.body, actorUid: 'forged' } } as any, res as any); assert.equal(res.statusCode, 400);
console.log('Support origin: canonical per-app/tenant authority, signed hint, no identity/token/secret payload and injected authority denial passed.');
