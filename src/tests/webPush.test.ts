import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import webPush from 'web-push';
import { pushId, validateSubscription, privatePushPayload, isQuiet, type PushDevice } from '../core/push/pushPolicy';
import { createPushRouter } from '../core/push/pushHttpRouter';
import type { PushStore } from '../core/push/firestorePushStore';
import { FirestorePushStore } from '../core/push/firestorePushStore';
import { InboxPushService, createWebPushSender } from '../core/push/inboxPushService';
import { WhatsAppConnectionRegistry } from '../core/channels/whatsappConnectionRegistry';
import { createConversationIdFromChannelIdentity, createMessageEvidenceRef } from '../core/inbox/messageContentStore';
import { InMemoryConnectThreadStore } from '../core/inbox/threadStore';
import { ConnectThreadCommandService } from '../core/inbox/threadService';
import type { CanonicalCoreContext } from '../core/runtime/connectCore';

const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'jwk' });
const p256dh = Buffer.concat([Buffer.from([4]), Buffer.from(key.x!, 'base64url'), Buffer.from(key.y!, 'base64url')]).toString('base64url');
const subscription = { endpoint: 'https://web.push.apple.com/test', keys: { p256dh, auth: Buffer.alloc(16).toString('base64url') } };
assert.deepEqual(validateSubscription(subscription), subscription);
for (const endpoint of ['http://web.push.apple.com/x', 'https://localhost/x', 'https://web.push.apple.com.evil.test/x', 'https://web.push.apple.com:444/x', 'https://user:pass@web.push.apple.com/x', 'https://127.0.0.1/x']) {
  assert.throws(() => validateSubscription({ ...subscription, endpoint }));
}
assert.throws(() => validateSubscription({ ...subscription, keys: { ...subscription.keys, auth: 'short' } }));
const vapid = webPush.generateVAPIDKeys();
assert.equal(typeof createWebPushSender(vapid.publicKey, vapid.privateKey, 'mailto:ops@example.test'), 'function');
const store: PushStore & { devices: PushDevice[]; claims: Set<string>; statuses: string[] } = {
  devices: [], claims: new Set(), statuses: [],
  async save(d) { this.devices = [...this.devices.filter(old => old.id !== d.id), d]; },
  async list(org) { return this.devices.filter(d => d.organizationId === org); },
  async remove(org, uid, id) {
    const found = this.devices.find(d => d.id === id);
    if (found && (found.organizationId !== org || found.actorUid !== uid)) throw new Error('PUSH_DEVICE_SCOPE_DENIED');
    this.devices = this.devices.filter(d => d.id !== id);
  },
  async claim(id) { if (this.claims.has(id)) return false; this.claims.add(id); return true; },
  async result(_id, status) { this.statuses.push(status); },
};
let context: CanonicalCoreContext = { actorUid: 'operator', organizationId: 'org-a', globalAccess: false,
  systemRole: null, organizationRole: 'admin', permissions: [], capabilities: [], appAccess: { musicscale: false } };
const router = createPushRouter({ async resolve() { return { status: 'resolved', context }; } }, store, vapid.publicKey);
async function request(method: string, body?: unknown, suffix = '', authenticated = true) {
  const query = Object.fromEntries(new URLSearchParams(suffix.split('?')[1] || ''));
  const req = { method, body, query, params: { deviceId: suffix.replace('/', '') }, headers: authenticated ? { authorization: 'Bearer transient' } : {} };
  const res = { locals: {} as Record<string, any>, statusCode: 200, body: undefined as any,
    setHeader() {}, status(code: number) { this.statusCode = code; return this; },
    json(value: any) { this.body = value; return this; }, end() { return this; } };
  let allowed = false;
  await (router as any).stack[0].handle(req, res, () => { allowed = true; });
  if (allowed) {
    const layer = (router as any).stack.find((l: any) => l.route?.methods[method.toLowerCase()]);
    await layer.route.stack[0].handle(req, res);
  }
  return { status: res.statusCode, text: async () => JSON.stringify(res.body) };
}
assert.equal((await request('GET', undefined, '?organizationId=org-a', false)).status, 401);
assert.equal((await request('GET', undefined, '?organizationId=org-b')).status, 403);
const body = { organizationId: 'org-a', subscription, enabled: true, quietStart: 22, quietEnd: 8, timeZone: 'UTC' };
assert.equal((await request('POST', { ...body, actorUid: 'injected' })).status, 400);
assert.equal((await request('POST', body)).status, 201);
const response = await (await request('GET', undefined, '?organizationId=org-a')).text();
assert(!response.includes(subscription.endpoint)); assert(!response.includes(p256dh));
context = { ...context, actorUid: 'other' };
assert.equal((await request('DELETE', { organizationId: 'org-a' }, '/' + pushId(subscription.endpoint))).status, 403);
context = { ...context, actorUid: 'operator', organizationRole: 'member' };
assert.equal((await request('POST', body)).status, 403);
context = { ...context, organizationRole: 'admin' };
assert.equal((await request('DELETE', { organizationId: 'org-a' }, '/' + pushId(subscription.endpoint))).status, 204);

const now = new Date('2026-10-14T12:00:00Z');
const device: PushDevice = { id: pushId(subscription.endpoint), organizationId: 'org-a', actorUid: 'operator', subscription,
  enabled: true, quietStart: 22, quietEnd: 8, timeZone: 'UTC', expiresAt: '2026-11-01T00:00:00Z' };
assert(isQuiet(device, new Date('2026-10-14T23:00:00Z'))); assert(!isQuiet(device, now));
const registry = new WhatsAppConnectionRegistry([{ phoneNumberId: 'phone-id', organizationId: 'org-a', connectionRef: 'connection', enabled: true }]);
const threads = new InMemoryConnectThreadStore();
const commands = new ConnectThreadCommandService(threads, () => now);
const scope = { organizationId: 'org-a', conversationId: createConversationIdFromChannelIdentity({ organizationId: 'org-a', channel: 'whatsapp', connectionRef: 'connection', channelUserId: 'sensitive-phone' }) };
await commands.open({ ...scope, requestId: 'wa-00-open', evidenceRef: 'open', channel: 'whatsapp' });
await commands.recordPersonReply({ ...scope, requestId: 'wa-10-message', evidenceRef: createMessageEvidenceRef('whatsapp', 'message-id') });
store.devices = [device, { ...device, id: 'other-org-device', organizationId: 'org-b' }];
let sends = 0, eligible = true;
const directory = { async list() { return []; }, async verify() { return eligible; } };
const events = [{ kind: 'message' as const, phoneNumberId: 'phone-id', providerMessageId: 'message-id', from: 'sensitive-phone', text: 'sensitive-content', timestamp: '1791979200', messageType: 'text' as const }];
const push = new InboxPushService(store, threads, directory, async (_device, payload) => {
  sends++; assert(!payload.includes('sensitive')); assert(!payload.includes('message-id')); assert(payload.includes('/inbox?'));
}, registry, () => now);
await Promise.all(Array.from({ length: 20 }, () => push.afterIngest(events)));
assert.equal(sends, 1); assert.equal(store.statuses[0], 'accepted_by_push_service');
store.claims.clear(); eligible = false; await push.afterIngest(events); assert.equal(sends, 1);
eligible = true; store.devices = [{ ...device, quietStart: 11, quietEnd: 13 }]; await push.afterIngest(events); assert.equal(sends, 1);
store.devices = [device];
const failed = new InboxPushService(store, threads, directory, async () => { throw { statusCode: 410 }; }, registry, () => now);
await failed.afterIngest(events); assert.equal(store.devices.length, 0); assert.equal(store.statuses.at(-1), 'expired');
assert(!privatePushPayload({ ...scope, messageId: 'opaque' }).includes('sensitive'));
const fs = new FirestorePushStore('millionsnest', async () => new Response('{}', { status: 409 }), { async getAccessToken() { return 'runtime-token'; } });
assert.equal(await fs.claim('duplicate', now.toISOString()), false);
await assert.rejects(() => new FirestorePushStore('millionsnest', async () => new Response('{}', { status: 403 }), { async getAccessToken() { return 'runtime-token'; } }).claim('id', now.toISOString()));
console.log('Web Push: provider SSRF guard, Hub authority, tenant/device isolation, 20 duplicates, quiet hours, revoked operators, privacy and expiry passed.');
