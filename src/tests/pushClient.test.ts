import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ConnectPushClient, readInboxPushLink, unsubscribeLocalPush } from '../core/client/connectPushClient';

assert.deepEqual(readInboxPushLink('https://connect.example/inbox?organizationId=org-a&conversationId=opaque'), { organizationId: 'org-a', conversationId: 'opaque' });
for (const url of ['https://connect.example/inbox?organizationId=org-a&conversationId=..%2Fx', 'https://connect.example/?organizationId=a&conversationId=b', 'https://connect.example/inbox?organizationId=a']) assert.equal(readInboxPushLink(url), null);
const order: string[] = [];
let unsubscribed = 0, subscribed = 0;
const subscription = { endpoint: 'https://web.push.apple.com/test', options: {}, toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'opaque', auth: 'opaque' } }; }, async unsubscribe() { unsubscribed++; return true; } };
let permission: NotificationPermission = 'default';
const registration = { pushManager: { async getSubscription() { return subscription; }, async subscribe() { subscribed++; return subscription; } } };
Object.defineProperty(globalThis, 'window', { value: { isSecureContext: true, PushManager: {}, Notification: {}, matchMedia() { return { matches: true }; } }, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'iPhone', serviceWorker: { async register() { order.push('register'); return registration; }, ready: Promise.resolve(registration), async getRegistration() { return registration; } } }, configurable: true });
Object.defineProperty(globalThis, 'Notification', { value: { permission: 'default', async requestPermission() { order.push('permission'); return permission; } }, configurable: true });
let fail = false;
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
  order.push('api'); assert.equal((init.headers as any).Authorization, 'Bearer test');
  return new Response(init.method === 'DELETE' && !fail ? null : '{}', { status: fail ? 503 : init.method === 'DELETE' ? 204 : 201 });
}) as typeof fetch;
const client = new ConnectPushClient({ idToken: 'test', expectedOrganizationId: 'org-a' } as any);
try {
  await assert.rejects(() => client.enable('AQ', 22, 8), /PUSH_PERMISSION_DENIED/);
  assert.deepEqual(order, ['permission']); assert.equal(subscribed, 0);
  order.length = 0; permission = 'granted';
  await client.enable('AQ', 22, 8);
  assert.deepEqual(order, ['permission', 'register', 'api']);
  fail = true; await assert.rejects(() => client.enable('AQ', 22, 8)); assert.equal(unsubscribed, 1);
  await unsubscribeLocalPush(); assert.equal(unsubscribed, 2);
  fail = false;
  let grant: (permission: string) => void;
  (globalThis.Notification as any).requestPermission = () => new Promise(resolve => { grant = resolve; });
  const activating = client.enable('AQ', 22, 8);
  await unsubscribeLocalPush();
  grant!('granted');
  await assert.rejects(() => activating, /PUSH_SESSION_CHANGED/);
  await client.disableThisDevice();

} finally { globalThis.fetch = originalFetch; }

const handlers: Record<string, any> = {}; const shown: any[] = []; const opened: string[] = [];
const origin = 'https://connect.example';
const self = { location: { origin }, addEventListener(name: string, handler: any) { handlers[name] = handler; },
  registration: { async showNotification(title: string, options: any) { shown.push({ title, ...options }); } },
  clients: { async matchAll() { return []; }, async openWindow(url: string) { opened.push(url); } } };
vm.runInNewContext(readFileSync('public/connect-push-sw.js', 'utf8'), { self, URL });
let pending: Promise<unknown> | undefined;
const event = (data: any) => ({ data: { json() { return data; } }, waitUntil(p: Promise<unknown>) { pending = p; } });
handlers.push(event({ url: 'https://evil.example/inbox?conversationId=x', body: 'private' })); await pending; assert.equal(shown.length, 0);
handlers.push(event({ url: '/inbox?organizationId=org-a&conversationId=opaque', body: 'private', title: 'private', tag: 'opaque-event' })); await pending;
assert.equal(shown.length, 1); assert(!JSON.stringify(shown).includes('private'));
handlers.notificationclick({ notification: { data: shown[0].data, close() {} }, waitUntil(p: Promise<unknown>) { pending = p; } }); await pending;
assert.equal(opened[0], origin + '/inbox?organizationId=org-a&conversationId=opaque');
console.log('Push browser contract: explicit permission/denial, registration failure cleanup, logout unsubscribe, worker privacy/origin guard and conversation click passed.');
