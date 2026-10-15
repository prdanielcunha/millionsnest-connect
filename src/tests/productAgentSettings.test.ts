import assert from 'node:assert/strict';
import { defaultAgentSettings, parseAgentSettings, parseAgentSettingsRecord, reviseAgentSettings, type ProductAgentSettingsRecord, type ProductAgentSettingsStore } from '../core/agents/productAgentSettings';
import { FirestoreProductAgentSettingsStore } from '../core/agents/firestoreProductAgentSettingsStore';
import { createProductAgentProfilesHandler, createProductAgentSettingsHandler } from '../core/agents/productAgentProfilesHttp';
import type { CanonicalContextProvider } from '../core/runtime/connectCore';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { listProductAgentProfiles, saveProductAgentSettings } from '../core/client/productAgentProfilesClient';
import type { LiveConnectSession } from '../core/client/liveConnectSession';

const now = new Date('2026-10-15T13:00:00Z');
const input = { organizationId: 'org-a', product: 'musicscale' as const, actorUid: 'synthetic-manager', requestId: 'synthetic_request_0001', expectedVersion: 0, settings: defaultAgentSettings('musicscale') };
const first = reviseAgentSettings(null, input, now);
assert.equal(first.record.version, 1);
assert(!JSON.stringify(first.record).includes('synthetic-manager'), 'audit masks the actor');
assert(!Object.hasOwn(first.record, 'actorUid'));
assert.equal(reviseAgentSettings(first.record, input, now).replayed, true);
for (const change of [{ actorUid: 'other-manager' }, { settings: { ...input.settings, enabled: false } }, { requestId: 'synthetic_request_0002' }]) {
  assert.throws(() => reviseAgentSettings(first.record, { ...input, ...change }, now), /CONFLICT/);
}
for (const settings of [
  { ...input.settings, permissions: ['*'] }, { ...input.settings, tools: ['finance.write'] },
  { ...input.settings, enabled: 'true' }, { ...input.settings, ownerUid: '../org-b' },
  { ...input.settings, overview: { ...input.settings.overview, 'pt-BR': 'https://unapproved.invalid' } },
  { ...input.settings, intake: { ...input.settings.intake, 'en-US': 'x'.repeat(1201) } },
  { ...input.settings, overview: { 'pt-BR': 'Missing translations' } },
]) assert.throws(() => parseAgentSettings(settings), /INVALID/);
assert.throws(() => parseAgentSettingsRecord(first.record, { organizationId: 'org-b', product: 'musicscale' }), /STORAGE_INVALID/);
let record = first.record;
for (let n = 2; n <= 30; n++) record = reviseAgentSettings(record, { ...input, expectedVersion: n - 1, requestId: `synthetic_request_${String(n).padStart(4, '0')}` }, now).record;
assert.equal(record.version, 30); assert.equal(record.revisions.length, 20); assert.equal(record.revisions[0].version, 11);
assert.throws(() => reviseAgentSettings(record, { ...input, expectedVersion: 28, requestId: 'synthetic_request_0029' }, now), /CONFLICT/, 'replaying an older revision cannot claim newer content was saved');
assert.throws(() => reviseAgentSettings(record, input, now), /CONFLICT/, 'expired dedup cannot overwrite newer configuration');

// Actual REST adapter: path isolation, atomic create/update, bounded DTOs,
// idempotent retry after a response was lost and concurrent writer rejection.
let doc: any = null, patches = 0, conflict = false, providerDown = false;
const calls: { url: string; method: string }[] = [];
const store = new FirestoreProductAgentSettingsStore('millionsnest', async (raw, init) => {
  const url = String(raw); calls.push({ url, method: init?.method ?? '' });
  assert(url.startsWith('https://firestore.googleapis.com/v1/projects/millionsnest/databases/(default)/documents/organizations/org-a/connectAgentProfiles/musicscale'));
  assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer runtime-only');
  assert.equal(init?.redirect, 'error'); assert(init?.signal);
  if (providerDown) return new Response('PRIVATE_PROVIDER_BODY', { status: 503 });
  if (init?.method === 'GET') return doc ? Response.json(doc) : new Response('{}', { status: 404 });
  patches++;
  assert.equal(init?.method, 'PATCH');
  assert(url.includes(doc ? 'currentDocument.updateTime=' : 'currentDocument.exists=false'));
  if (conflict) return new Response('{}', { status: 412 });
  const body = JSON.parse(String(init?.body));
  assert.deepEqual(Object.keys(body.fields).sort(), ['integrityMac', 'organizationId', 'product', 'recordJson']);
  assert(!JSON.stringify(body).includes('runtime-only')); assert(!JSON.stringify(body).includes('synthetic-manager'));
  doc = { ...body, updateTime: now.toISOString() };
  return Response.json(doc);
}, { async getAccessToken() { return 'runtime-only'; } }, () => now, 'synthetic-settings-signing-key-at-least-32-characters');
assert.equal(await store.read(input), null);
assert.equal((await store.save(input)).record.version, 1);
assert.equal((await store.save(input)).replayed, true); assert.equal(patches, 1);
assert.equal((await store.read(input))?.version, 1);
const second = { ...input, expectedVersion: 1, requestId: 'synthetic_request_0002', settings: { ...input.settings, enabled: false } };
conflict = true; await assert.rejects(() => store.save(second), /CONFLICT/);
conflict = false; assert.equal((await store.save(second)).record.version, 2);
doc.fields.organizationId.stringValue = 'org-b'; await assert.rejects(() => store.read(input), /STORAGE_INVALID/);
doc.fields.organizationId.stringValue = 'org-a';
const signature = doc.fields.integrityMac; delete doc.fields.integrityMac;
await assert.rejects(() => store.read(input), /STORAGE_INVALID/, 'unsigned pre-existing records cannot become server-owned authority');
doc.fields.integrityMac = signature;
const originalJson = doc.fields.recordJson.stringValue; doc.fields.recordJson.stringValue = originalJson.replace('MusicScale', 'ForgedScale');
await assert.rejects(() => store.read(input), /STORAGE_INVALID/, 'stored knowledge cannot be modified without runtime integrity proof');
doc.fields.recordJson.stringValue = originalJson;
providerDown = true; await assert.rejects(() => store.read(input), /UNAVAILABLE/);
const beforeInvalid = calls.length;
await assert.rejects(() => store.read({ organizationId: '../org-b', product: 'musicscale' }));
assert.equal(calls.length, beforeInvalid);

// Canonical manager check on every API call, no client-assigned authority.
let allowed = true, resolvedOrg = 'org-a', verifyOwner = true, directoryDown = false, storageDown = false, saves = 0, resolves = 0;
let saved: ProductAgentSettingsRecord | null = null;
const settingsStore: ProductAgentSettingsStore = { async read(scope) {
  if (storageDown) throw new Error('PRIVATE_STORAGE');
  return scope.product === 'musicscale' ? saved : null;
}, async save(write) { saves++; const result = reviseAgentSettings(saved, write, now); saved = result.record; return result; } };
const options = { settingsStore, owners: {}, contextProvider: { async resolve() { resolves++; return { status: 'resolved', context: { actorUid: input.actorUid, organizationId: resolvedOrg, globalAccess: false, systemRole: null, organizationRole: allowed ? 'admin' : 'member', capabilities: [], permissions: [], appAccess: { musicscale: false } } }; } } satisfies CanonicalContextProvider,
  directory: { async list() { return []; }, async verify(scope: { organizationId: string; uid: string }) { assert.equal(scope.organizationId, 'org-a'); if (directoryDown) throw new Error('PRIVATE_DIRECTORY'); return verifyOwner; } } };
const put = createProductAgentSettingsHandler(options), get = createProductAgentProfilesHandler(options);
const body = () => ({ requestId: input.requestId, expectedVersion: 0, publicKnowledgeConfirmed: true, settings: input.settings });
async function invoke(handler = put, overrides: any = {}) {
  let status = 200, payload: any;
  const res: any = { setHeader(k: string, v: string) { assert.equal(k, 'Cache-Control'); assert.equal(v, 'no-store'); }, status(n: number) { status = n; return res; }, json(value: any) { payload = value; return res; } };
  await handler({ headers: { authorization: 'Bearer transient-only' }, query: { organizationId: 'org-a' }, params: { product: 'musicscale' }, body: body(), ...overrides } as any, res);
  assert(!JSON.stringify(payload).includes('PRIVATE')); assert(!JSON.stringify(payload).includes('transient-only'));
  return { status, payload };
}
assert.equal((await invoke()).status, 200); assert.equal(saves, 1);
assert.equal((await invoke()).payload.replayed, true);
let result = await invoke(get); assert.equal(result.status, 200); assert.equal(result.payload.profiles[0].version, 1); assert.equal(result.payload.profiles[0].settingsEditable, true);
for (const malformed of [{ ...body(), publicKnowledgeConfirmed: false }, { ...body(), organizationId: 'org-b' }, { ...body(), actorUid: 'forged' }, { ...body(), expectedVersion: -1 }, { ...body(), settings: { ...input.settings, allowedToolRefs: ['*'] } }]) assert.equal((await invoke(put, { body: malformed })).status, 400);
assert.equal((await invoke(put, { headers: {} })).status, 401);
allowed = false; const beforeDenied = saves; assert.equal((await invoke()).status, 403); assert.equal(saves, beforeDenied);
allowed = true; resolvedOrg = 'org-b'; assert.equal((await invoke()).status, 403); resolvedOrg = 'org-a';
verifyOwner = false; const ownerBody = { ...body(), settings: { ...input.settings, ownerUid: 'other-tenant-owner' } };
assert.equal((await invoke(put, { body: ownerBody })).status, 403);
directoryDown = true; assert.equal((await invoke(put, { body: ownerBody })).status, 503); directoryDown = false;
assert.equal((await invoke(put, { body: { ...body(), requestId: 'synthetic_request_conflict' } })).status, 409);
storageDown = true; assert.equal((await invoke(get)).status, 503); storageDown = false;
assert.equal((await invoke(createProductAgentSettingsHandler({ ...options, settingsStore: undefined }))).status, 404);
assert.equal((await invoke(createProductAgentSettingsHandler({ ...options, settingsEditable: false }))).status, 404);
assert.equal((await invoke(createProductAgentProfilesHandler({ ...options, settingsEditable: false }))).payload.profiles[0].settingsEditable, false);
assert(resolves > 10);
// Real HTTP round trip with the actual client and handlers, synthetic Hub and
// tenant storage. This does not claim a positive real-account integration.
const app = express(); app.use(express.json({ limit: '32kb' }));
app.get('/api/core/agents/product-profiles', get);
app.put('/api/core/agents/product-profiles/:product', put);
const server = app.listen(0, '127.0.0.1');
try {
  await new Promise<void>(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const transport: typeof fetch = (url, init) => fetch(new URL(String(url), origin), init);
  const session = { expectedOrganizationId: 'org-a', idToken: 'synthetic-transient-only' } as LiveConnectSession;
  const before = await listProductAgentProfiles(session, undefined, transport);
  assert.equal(before[0].version, 1); assert.equal(before[0].settingsEditable, true);
  const update = { product: 'musicscale' as const, expectedVersion: before[0].version, requestId: 'synthetic_http_request_001', publicKnowledgeConfirmed: true,
    settings: { ...input.settings, enabled: false, overview: { ...input.settings.overview, 'pt-BR': 'Orientação pública aprovada via HTTP.' } } };
  const result = await saveProductAgentSettings(session, update, undefined, transport);
  assert.equal(result.version, 2);
  assert.equal((await saveProductAgentSettings(session, update, undefined, transport)).replayed, true);
  const after = await listProductAgentProfiles(session, undefined, transport);
  assert.equal(after[0].enabled, false); assert.equal(after[0].version, 2);
  assert.equal(after[0].overview['pt-BR'], 'Orientação pública aprovada via HTTP.');
  assert.deepEqual(after[0].allowedToolRefs, before[0].allowedToolRefs);
  await assert.rejects(() => saveProductAgentSettings(session, { ...update, requestId: 'synthetic_http_request_002' }, undefined, transport), /AGENT_SETTINGS_CONFLICT/);
  const beforeForeign = saves;
  await assert.rejects(() => saveProductAgentSettings({ ...session, expectedOrganizationId: 'org-b' }, update, undefined, transport), /AGENT_ACCESS_DENIED/);
  assert.equal(saves, beforeForeign);
} finally { await new Promise<void>(resolve => server.close(() => resolve())); }
console.log('Agent settings: strict public multilingual fields, immutable domain authority, scoped CAS REST persistence, revision audit, retries/conflicts, fresh Hub manager/owner checks and sanitized failures passed');
