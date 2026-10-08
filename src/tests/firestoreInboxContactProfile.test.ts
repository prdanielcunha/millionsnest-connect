import assert from 'node:assert/strict';
import { FirestoreInboxContactProfileStore } from '../core/inbox/firestoreInboxContactProfileStore';

const calls: Array<{ url: string; method: string; body: any }> = [];
const fetched: typeof fetch = async (url, init) => {
  const target = String(url);
  const method = init?.method || 'GET';
  const body = JSON.parse(String(init?.body || '{}'));
  calls.push({ url: target, method, body });
  if (method === 'PATCH') return new Response('{}', { status: 200 });
  if (method === 'POST' && target.endsWith(':batchGet')) {
    const requested = body.documents[0];
    return new Response(JSON.stringify([{
      found: {
        name: requested,
        fields: {
          organizationId: { stringValue: 'org-a' },
          conversationId: { stringValue: 'conversation-1' },
          displayName: { stringValue: 'Ana Maria' },
          source: { stringValue: 'whatsapp_profile' },
          observedAt: { stringValue: '2026-10-08T12:00:00.000Z' },
          expiresAt: { timestampValue: '2027-01-06T12:00:00.000Z' },
        },
      },
    }, {
      found: {
        name: 'projects/millionsnest/databases/(default)/documents/foreign',
        fields: {
          organizationId: { stringValue: 'org-b' },
          conversationId: { stringValue: 'conversation-1' },
          displayName: { stringValue: 'Foreign tenant' },
          source: { stringValue: 'whatsapp_profile' },
          observedAt: { stringValue: '2026-10-08T12:00:00.000Z' },
          expiresAt: { timestampValue: '2027-01-06T12:00:00.000Z' },
        },
      },
    }]), { status: 200 });
  }
  throw new Error('UNEXPECTED_FETCH');
};
const store = new FirestoreInboxContactProfileStore({
  projectId: 'millionsnest',
  fetchImpl: fetched,
  tokenProvider: { async getAccessToken() { return 'test-token'; } },
  now: () => new Date('2026-10-08T13:00:00.000Z'),
});
await store.upsert({
  organizationId: 'org-a', conversationId: 'conversation-1',
  displayName: 'Ana Maria', observedAt: '2026-10-08T12:00:00.000Z',
});
const write = calls[0];
assert.equal(write.method, 'PATCH');
assert.ok(write.url.includes('/connectSensitiveOrganizations/org-a/inboxContactProfiles/conversation-1'));
assert.equal(write.body.fields.displayName.stringValue, 'Ana Maria');
assert.ok(write.body.fields.expiresAt.timestampValue, 'Firestore TTL timestamp must be typed');
assert.ok(!JSON.stringify(write.body).includes('5543999999999'));
const profiles = await store.list({ organizationId: 'org-a', conversationIds: ['conversation-1'] });
assert.equal(calls[1].method, 'POST');
assert.ok(calls[1].url.endsWith('documents:batchGet'));
assert.deepEqual(calls[1].body.documents, [
  'projects/millionsnest/databases/(default)/documents/connectSensitiveOrganizations/org-a/inboxContactProfiles/conversation-1',
]);
assert.equal(profiles.length, 1, 'foreign tenant never returned');
assert.equal(profiles[0].displayName, 'Ana Maria');
assert.equal((await store.list({ organizationId: 'org-a', conversationIds: [] })).length, 0);
assert.equal(calls.length, 2, 'empty list does not contact database');
assert.throws(() => new FirestoreInboxContactProfileStore({ projectId: '../bad' }), /INVALID_FIRESTORE_PROJECT_ID/);
await assert.rejects(
  () => store.list({ organizationId: 'org-a', conversationIds: ['../other'] }),
  /INBOX_CONTACT_SCOPE_INVALID/,
);
console.log('Firestore contact identity: scoped path, typed TTL, batchGet and tenant isolation PASS');
