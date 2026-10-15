import assert from 'node:assert/strict';
import { productAgentProfile } from '../core/agents/productAgentProfiles';
import { listProductAgentProfiles } from '../core/client/productAgentProfilesClient';
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
