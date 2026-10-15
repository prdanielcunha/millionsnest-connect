import assert from 'node:assert/strict';
import { CONNECT_PRODUCTS, type ConnectProduct } from '../core/routing/productRouting';
import { PRODUCT_AGENT_PROFILES, productAgentProfile, publicProductSupportReply } from '../core/agents/productAgentProfiles';
import { createProductAgentProfilesHandler } from '../core/agents/productAgentProfilesHttp';
import type { CanonicalContextProvider } from '../core/runtime/connectCore';
const products = Object.keys(CONNECT_PRODUCTS) as ConnectProduct[];
for (const product of products) {
  const profile = productAgentProfile(product);
  assert.equal(profile.executionMode, 'deterministic_public_knowledge'); assert.equal(profile.modelCost, 0);
  assert.deepEqual(profile.allowedToolRefs, [...CONNECT_PRODUCTS[product].tools]);
  assert.equal(profile.humanFallback, true);
  for (const locale of ['pt-BR', 'en-US', 'es-ES'] as const) {
    assert(PRODUCT_AGENT_PROFILES[product].overview[locale]); assert(PRODUCT_AGENT_PROFILES[product].intake[locale]);
  }
  assert(publicProductSupportReply(product, `Preciso de suporte sobre o ${CONNECT_PRODUCTS[product].label}.`, 'pt-BR'));
  assert(publicProductSupportReply(product, `I need support with ${CONNECT_PRODUCTS[product].label}.`, 'pt-BR')!.includes('Welcome'));
  assert(publicProductSupportReply(product, `Necesito ayuda con ${CONNECT_PRODUCTS[product].label}.`, 'pt-BR')!.includes('Bienvenido'));
  assert(publicProductSupportReply(product, `O que é o ${CONNECT_PRODUCTS[product].label}?`, 'pt-BR')!.includes(PRODUCT_AGENT_PROFILES[product].url));
  assert(publicProductSupportReply(product, `How do I open ${CONNECT_PRODUCTS[product].label}?`, 'pt-BR')!.includes('Open the official app'));
  assert(publicProductSupportReply(product, `Como acceder ${CONNECT_PRODUCTS[product].label}?`, 'pt-BR')!.includes('Abre la aplicación'));
  for (const input of ['Quero falar com atendente', 'What is my balance?', 'Qual é meu saldo?', 'Como acessar documentos privados?', 'Necesito una persona', 'pastoral', 'x'.repeat(2049)]) {
    assert.equal(publicProductSupportReply(product, input, 'pt-BR'), null);
  }
}
assert.equal(new Set(products.map(p => PRODUCT_AGENT_PROFILES[p].style)).size, 3);
assert.equal(publicProductSupportReply('musicscale', 'Qual é minha próxima escala?', 'pt-BR'), null, 'private facts stay with canonical tools, not public knowledge');

let allowed = true, org = 'synthetic-org', unavailable = false, ownerAvailable = true, ownerVerified = true, verificationCalls = 0;
const contextProvider = { async resolve(input: any) {
  assert.equal(input.requestedOrganizationId, 'synthetic-org'); assert.equal(input.authToken, 'Bearer synthetic-identity');
  if (unavailable) throw new Error('PRIVATE provider details');
  return { status: 'resolved', context: { actorUid: 'synthetic-manager', organizationId: org, globalAccess: false, organizationRole: allowed ? 'admin' : 'member', permissions: [], capabilities: [], appAccess: {} } };
} } as CanonicalContextProvider;
const handler = createProductAgentProfilesHandler({ contextProvider, owners: { musicscale: 'synthetic-owner' },
  directory: { async list() { return []; }, async verify(input) { verificationCalls++; assert.equal(input.organizationId, 'synthetic-org'); if (!ownerAvailable) throw new Error('PRIVATE directory details'); return ownerVerified; } },
});
async function invoke(request: any = { headers: { authorization: 'Bearer synthetic-identity' }, query: { organizationId: 'synthetic-org' } }) {
  let status = 200, payload: any;
  const response: any = { setHeader(k: string, v: string) { assert.equal(k, 'Cache-Control'); assert.equal(v, 'no-store'); },
    status(value: number) { status = value; return response; }, json(value: any) { payload = value; return response; } };
  await handler(request, response); return { status, payload };
}
const valid = await invoke(); assert.equal(valid.status, 200); assert.equal(valid.payload.profiles.length, 3);
assert.deepEqual(valid.payload.profiles[0].owner, { state: 'verified', uid: 'synthetic-owner' });
assert.deepEqual(valid.payload.profiles[1].owner, { state: 'unassigned', uid: null });
assert.equal(verificationCalls, 1);
assert(!JSON.stringify(valid.payload).includes('synthetic-identity'));
assert.equal((await invoke({ headers: {}, query: { organizationId: 'synthetic-org' } })).status, 401);
assert.equal((await invoke({ headers: { authorization: 'Bearer synthetic-identity' }, query: { organizationId: '../foreign' } })).status, 400);
allowed = false; assert.equal((await invoke()).status, 403); assert.equal(verificationCalls, 1);
allowed = true; org = 'another-org'; assert.equal((await invoke()).status, 403); assert.equal(verificationCalls, 1);
org = 'synthetic-org'; ownerVerified = false;
const foreignOwner = await invoke(); assert.deepEqual(foreignOwner.payload.profiles[0].owner, { state: 'unassigned', uid: null });
assert(!JSON.stringify(foreignOwner.payload).includes('synthetic-owner'));
ownerAvailable = false;
const directoryDown = await invoke(); assert.equal(directoryDown.status, 200); assert.deepEqual(directoryDown.payload.profiles[0].owner, { state: 'unassigned', uid: null });
assert(!JSON.stringify(directoryDown.payload).includes('synthetic-owner'));
unavailable = true; const down = await invoke(); assert.equal(down.status, 503); assert(!JSON.stringify(down.payload).includes('PRIVATE'));
console.log('Product agent profiles: three distinct localized public profiles, canonical tool limits, no model spend, private/human fallback, fresh tenant/manage/owner checks and sanitized failure passed');
