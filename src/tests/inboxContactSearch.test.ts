import assert from 'node:assert/strict';
import { createConnectInboxContactSearchHttpHandler } from '../core/runtime/connectInboxQueryHttpHandler';
import { InMemoryConnectThreadStore } from '../core/inbox/threadStore';
import { ConnectThreadCommandService } from '../core/inbox/threadService';
import type { InboxContactProfileStore, InboxContactProfile } from '../core/inbox/inboxContactProfileStore';
import type { CanonicalContextProvider } from '../core/runtime/connectCore';
import type { ConnectMessageContentStore } from '../core/inbox/messageContentStore';

const store = new InMemoryConnectThreadStore();
const service = new ConnectThreadCommandService(store, () => new Date('2026-10-08T12:00:00.000Z'));
await service.open({
  requestId: 'open-a', organizationId: 'org-a', conversationId: 'thread-a',
  evidenceRef: 'evidence:a', channel: 'whatsapp',
});
await service.open({
  requestId: 'open-b', organizationId: 'org-b', conversationId: 'thread-b',
  evidenceRef: 'evidence:b', channel: 'whatsapp',
});
const good: InboxContactProfile = {
  organizationId: 'org-a',
  conversationId: 'thread-a',
  displayName: 'Ana Maria',
  source: 'whatsapp_profile',
  observedAt: '2026-10-08T12:00:00.000Z',
  expiresAt: '2027-01-01T00:00:00.000Z',
};
const profiles: InboxContactProfileStore = {
  async upsert() {},
  async list() { return []; },
  async search() {
    // Deliberately try to smuggle records for a foreign tenant, an orphan
    // conversation, a malicious source, and an expired profile into results.
    return [
      good,
      { ...good, organizationId: 'org-b', conversationId: 'thread-b', displayName: 'Foreign name' },
      { ...good, conversationId: 'not-real', displayName: 'Ghost' },
      { ...good, source: 'untrusted' as any, displayName: 'Untrusted name' },
      { ...good, expiresAt: '2020-01-01T00:00:00Z', displayName: 'Expired name' },
    ];
  },
};
const messages = {} as ConnectMessageContentStore;
function provider(role: string): CanonicalContextProvider {
  return {
    async resolve({ requestedOrganizationId }) {
      return { status: 'resolved', context: {
        actorUid: 'actor-1', systemRole: null, globalAccess: false,
        organizationId: requestedOrganizationId || 'org-a',
        organizationRole: role, permissions: [], capabilities: [],
        appAccess: { musicscale: true },
      } };
    },
  };
}
function response() {
  const r: any = {
    statusCode: 200, body: null, headers: {},
    setHeader(k: string, v: string) { this.headers[k] = v; return this; },
    status(c: number) { this.statusCode = c; return this; },
    json(body: any) { this.body = body; return this; },
  };
  return r;
}
const admin = createConnectInboxContactSearchHttpHandler({
  contextProvider: provider('admin'), threadStore: store,
  messageStore: messages, contactProfileStore: profiles,
});
const result = response();
await admin({ headers: { authorization: 'Bearer token' },
  query: { organizationId: 'org-a', q: 'Ana' } } as any, result);
assert.equal(result.statusCode, 200);
assert.equal(result.body.enabled, true);
assert.equal(result.body.conversations.length, 1, 'only live authorized thread returned');
assert.equal(result.body.conversations[0].contact.displayName, 'Ana Maria');
assert.equal(JSON.stringify(result.body).includes('Foreign name'), false);
assert.equal(JSON.stringify(result.body).includes('Ghost'), false);
assert.equal(result.headers['Cache-Control'], 'no-store');

const member = createConnectInboxContactSearchHttpHandler({
  contextProvider: provider('member'), threadStore: store,
  messageStore: messages, contactProfileStore: profiles,
});
const denied = response();
await member({ headers: { authorization: 'Bearer token' },
  query: { organizationId: 'org-a', q: 'Ana' } } as any, denied);
assert.equal(denied.statusCode, 403, 'read authority is required before running search');
const unauth = response();
await admin({ headers: {},
  query: { organizationId: 'org-a', q: 'Ana' } } as any, unauth);
assert.equal(unauth.statusCode, 401);
const invalid = response();
await admin({ headers: { authorization: 'Bearer token' },
  query: { organizationId: 'org-a', q: 'a' } } as any, invalid);
assert.equal(invalid.statusCode, 400);
const unavailable = createConnectInboxContactSearchHttpHandler({
  contextProvider: provider('admin'), threadStore: store, messageStore: messages,
});
const disabled = response();
await unavailable({ headers: { authorization: 'Bearer token' },
  query: { organizationId: 'org-a', q: 'Ana' } } as any, disabled);
assert.equal(disabled.statusCode, 200);
assert.equal(disabled.body.enabled, false);
assert.deepEqual(disabled.body.conversations, []);
console.log('Inbox remote search: RBAC, tenant isolation, expiration, disabled mode PASS');
