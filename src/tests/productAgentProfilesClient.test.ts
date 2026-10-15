import assert from 'node:assert/strict';
import { productAgentProfile } from '../core/agents/productAgentProfiles';
import { listProductAgentProfiles, listProductAgentOwners, saveProductAgentSettings } from '../core/client/productAgentProfilesClient';
import { defaultAgentSettings } from '../core/agents/productAgentSettings';
import type { LiveConnectSession } from '../core/client/liveConnectSession';

const session = { idToken: 'synthetic-transient-token', expectedOrganizationId: 'org-a' } as LiveConnectSession;
const payload = () => ({ success: true, organizationId: 'org-a', profiles: (['musicscale', 'nestfinance', 'nestjourney'] as const).map(product => ({ ...productAgentProfile(product), owner: { state: 'unassigned', uid: null }, bearer: 'never-project-this' })) });
const controller = new AbortController();
const profiles = await listProductAgentProfiles(session, controller.signal, async (url, init) => {
  assert.equal(url, '/api/core/agents/product-profiles?organizationId=org-a');
  assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer synthetic-transient-token');
  assert.equal(init?.method, 'GET'); assert.equal(init?.cache, 'no-store'); assert.equal(init?.signal, controller.signal);
  return Response.json(payload());
});
assert.equal(profiles.length, 3); assert.equal(profiles[0].allowedToolRefs.length, 4);
assert.equal(profiles[1].allowedToolRefs.length, 0); assert.equal(profiles[2].overview['es-ES'].startsWith('NestJourney'), true);
assert(!JSON.stringify(profiles).includes('never-project-this')); assert(profiles.every(profile => !Object.hasOwn(profile, 'owner')));
const saveInput = { product: 'musicscale' as const, expectedVersion: 0, requestId: 'synthetic_request_0001', settings: defaultAgentSettings('musicscale'), publicKnowledgeConfirmed: true };
assert.deepEqual(await saveProductAgentSettings(session, saveInput, controller.signal, async (url, init) => {
  assert.equal(url, '/api/core/agents/product-profiles/musicscale?organizationId=org-a');
  assert.equal(init?.method, 'PUT'); assert.equal(init?.cache, 'no-store'); assert.equal(init?.signal, controller.signal);
  assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer synthetic-transient-token');
  assert(!String(init?.body).includes('synthetic-transient-token'));
  assert(!String(init?.body).includes('organizationId'));
  return Response.json({ success: true, organizationId: 'org-a', product: 'musicscale', version: 1, replayed: false });
}), { version: 1, replayed: false });
for (const [status, code] of [[400, 'AGENT_SETTINGS_INVALID'], [401, 'AGENT_SESSION_REQUIRED'], [403, 'AGENT_ACCESS_DENIED'], [409, 'AGENT_SETTINGS_CONFLICT'], [503, 'AGENT_SETTINGS_UNAVAILABLE']] as const) {
  await assert.rejects(() => saveProductAgentSettings(session, saveInput, undefined, async () => new Response('PRIVATE_PROVIDER_BODY', { status })), new RegExp(code));
}
await assert.rejects(() => saveProductAgentSettings(session, saveInput, undefined, async () => Response.json({ success: true, organizationId: 'org-b', product: 'musicscale', version: 1, replayed: false })), /INVALID_AGENT_SETTINGS_RESULT/);
await assert.rejects(() => saveProductAgentSettings(session, { ...saveInput, publicKnowledgeConfirmed: false }, undefined, async () => { throw new Error('must not fetch'); }), /AGENT_SETTINGS_INVALID/);
const ownersPayload = { success: true, organizationId: 'org-a', operators: [{ uid: 'synthetic-owner', displayName: 'Synthetic owner', role: 'admin', ignored: 'PRIVATE_EXTRA' }] };
const owners = await listProductAgentOwners(session, controller.signal, async (_url, init) => {
  assert.equal(init?.signal, controller.signal); assert.equal(init?.cache, 'no-store'); return Response.json(ownersPayload);
});
assert.deepEqual(owners, [{ uid: 'synthetic-owner', displayName: 'Synthetic owner' }]);
await assert.rejects(() => listProductAgentOwners(session, undefined, async () => Response.json({ ...ownersPayload, organizationId: 'org-b' })), /INVALID_AGENT_OWNERS/);
await assert.rejects(() => listProductAgentOwners(session, undefined, async () => Response.json({ ...ownersPayload, operators: [...ownersPayload.operators, ...ownersPayload.operators] })), /INVALID_AGENT_OWNERS/);
for (const [status, code] of [[401, 'AGENT_SESSION_REQUIRED'], [403, 'AGENT_ACCESS_DENIED'], [404, 'AGENT_PROFILES_UNAVAILABLE'], [503, 'AGENT_PROFILES_UNAVAILABLE']] as const) {
  await assert.rejects(() => listProductAgentProfiles(session, undefined, async () => new Response('sensitive provider body', { status })), new RegExp(code));
}
for (const mutate of [
  (p: ReturnType<typeof payload>) => { p.organizationId = 'org-b'; },
  (p: ReturnType<typeof payload>) => { p.profiles[1] = p.profiles[0]; },
  (p: ReturnType<typeof payload>) => { p.profiles[0].knowledge = { ...p.profiles[0].knowledge, url: 'https://evil.example' } as any; },
  (p: ReturnType<typeof payload>) => { p.profiles[0].modelCost = 10; },
  (p: ReturnType<typeof payload>) => { p.profiles[0].owner.state = 'invented'; },
  (p: ReturnType<typeof payload>) => { p.profiles.pop(); },
]) {
  const p = payload(); mutate(p);
  await assert.rejects(() => listProductAgentProfiles(session, undefined, async () => Response.json(p)), /INVALID_AGENT_PROFILES/);
}
await assert.rejects(() => listProductAgentProfiles(session, undefined, async () => new Response('<html>SPA fallback</html>')));
console.log('Product agents client: scoped bearer, cancellation, bounded safe projection, real authority states, cross-tenant and corrupt response rejection passed.');
