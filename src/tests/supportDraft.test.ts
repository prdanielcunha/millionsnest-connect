import assert from 'node:assert/strict';
import { createSupportDraftHttpHandler } from '../core/routing/supportDraftHttpHandler';
import { verifyProductOrigin } from '../core/routing/productRouting';
import { MetaWhatsAppProvider } from '../core/channels/metaWhatsAppProvider';
const secret = 'synthetic-support-origin-secret-long-enough', now = 1800000000000;
let allowed = true, organizationId = 'synthetic-customer-org', calls = 0;
const contextProvider: any = { async resolve() { return { status: 'resolved', context: { organizationId, appAccess: { musicscale: allowed, nestfinance: allowed, nestjourney: allowed } } }; } };
const bindings = [{ organizationId: 'synthetic-central-support-org', phoneNumberId: '123456789', connectionRef: 'synthetic-official', enabled: true }];
let upstream: any = { id: '123456789', display_phone_number: '+1 (650) 555-0100' }, status = 200;
const provider = new MetaWhatsAppProvider({ accessToken: 'synthetic-meta-secret', graphApiVersion: 'v25.0', fetchImpl: async (url, init) => {
  calls++; assert.equal(String(url), 'https://graph.facebook.com/v25.0/123456789?fields=display_phone_number');
  assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error');
  assert.equal((init.headers as any).Authorization, 'Bearer synthetic-meta-secret');
  return new Response(JSON.stringify(upstream), { status });
} });
const handler = createSupportDraftHttpHandler({ contextProvider, secret, bindings, provider, now: () => now });
const request: any = { headers: { authorization: 'Bearer synthetic-caller' }, body: { organizationId, product: 'musicscale', locale: 'pt-BR' } };
function result() { return { code: 200, body: undefined as any, setHeader() {}, status(code: number) { this.code = code; return this; }, json(body: unknown) { this.body = body; return this; } }; }
async function invoke(req = request, route = handler) { const res = result(); await route(req, res as any); return res; }
for (const [product, locale, phrase] of [['musicscale', 'pt-BR', 'Preciso de suporte'], ['nestfinance', 'en-US', 'I need support'], ['nestjourney', 'es-ES', 'Necesito ayuda']]) {
  const res = await invoke({ ...request, body: { ...request.body, product, locale } }); assert.equal(res.code, 200);
  const url = new URL(res.body.draftUrl); assert.equal(url.origin, 'https://wa.me'); assert.equal(url.pathname, '/16505550100');
  assert(url.searchParams.get('text')!.includes(phrase)); assert.equal(verifyProductOrigin(url.searchParams.get('text')!, secret, now), product);
  assert.equal(res.body.automaticSend, false);
  for (const forbidden of ['synthetic-caller', 'synthetic-central-support-org', 'synthetic-customer-org', 'synthetic-meta-secret', '123456789']) assert(!JSON.stringify(res.body).includes(forbidden));
}
const successfulCalls = calls;
assert.equal((await invoke({ ...request, headers: {} })).code, 401);
allowed = false; assert.equal((await invoke()).code, 403); allowed = true;
organizationId = 'synthetic-other-org'; assert.equal((await invoke()).code, 403); organizationId = request.body.organizationId;
for (const body of [[], { ...request.body, number: 'forged' }, { ...request.body, role: 'owner' }, { ...request.body, locale: 'unsupported' }, { ...request.body, product: 'unknown' }]) assert.equal((await invoke({ ...request, body })).code, 400);
assert.equal(calls, successfulCalls);
for (const configured of [[], [...bindings, { ...bindings[0], phoneNumberId: '987654321' }]]) {
  const route = createSupportDraftHttpHandler({ contextProvider, secret, bindings: configured, provider });
  assert.equal((await invoke(request, route)).code, 409);
}
assert.equal(calls, successfulCalls);
for (const value of [{ id: '987654321', display_phone_number: '+16505550100' }, { id: '123456789', display_phone_number: 'https://evil.test' }, { id: '123456789', display_phone_number: '+012345678' }]) {
  upstream = value; const res = await invoke(); assert.equal(res.code, 503); assert(!JSON.stringify(res.body).includes('evil'));
}
status = 403; upstream = { error: 'PRIVATE provider response' }; const failed = await invoke(); assert.equal(failed.code, 503); assert(!JSON.stringify(failed.body).includes('PRIVATE'));
const uncertain = new MetaWhatsAppProvider({ accessToken: 'synthetic', graphApiVersion: 'v25.0', fetchImpl: async () => { throw new Error('PRIVATE transport'); } });
await assert.rejects(uncertain.getDisplayPhoneNumber('123456789'), /WHATSAPP_SUPPORT_NUMBER_UNAVAILABLE/);
console.log('Support drafts: fresh per-app/tenant grants, read-only exact Meta number, manual signed draft, ambiguity/injection/privacy/failure gates passed');
