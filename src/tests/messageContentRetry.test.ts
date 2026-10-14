import assert from 'node:assert/strict';
import { FirestoreMessageContentStore } from '../core/inbox/firestoreMessageContentStore';
import { normalizeMessageContentRecord } from '../core/inbox/messageContentStore';
const original = normalizeMessageContentRecord({ schemaVersion: 1, organizationId: 'org-a', conversationId: 'thread',
  messageId: 'message', channel: 'whatsapp', direction: 'inbound', providerMessageId: 'wamid.test', senderRef: 'private-sender',
  recipientRef: 'server-bound-number', messageType: 'text', body: 'private-text', occurredAt: '2026-10-14T12:00:00Z',
  recordedAt: '2026-10-14T12:00:01Z', deliveryStatus: 'received', evidenceRef: 'opaque-evidence' });
let reads = 0;
const store = new FirestoreMessageContentStore({ projectId: 'millionsnest',
  tokenProvider: { async getAccessToken() { return 'runtime-token'; } },
  fetchImpl: async () => new Response(JSON.stringify({ error: { status: 'ALREADY_EXISTS' } }), { status: 409 }),
});
store.getByProviderMessageId = async () => { reads++; return original; };
for (let retry = 0; retry < 20; retry++) {
  const result = await store.put({ ...original, recordedAt: new Date(Date.parse(original.recordedAt) + retry * 10000).toISOString() });
  assert.equal(result.kind, 'duplicate'); assert.equal(result.record.recordedAt, original.recordedAt);
}
assert.equal(reads, 20);
store.getByProviderMessageId = async () => ({ ...original, deliveryStatus: 'read', deliveryUpdatedAt: '2026-10-14T12:05:00Z' });
const evolved = await store.put({ ...original, recordedAt: '2026-10-14T12:10:00Z' });
assert.equal(evolved.kind, 'duplicate'); assert.equal(evolved.record.deliveryStatus, 'read');
for (const field of [{ body: 'changed' }, { organizationId: 'org-b' }, { senderRef: 'changed' }, { recipientRef: 'changed' }]) {
  await assert.rejects(() => store.put({ ...original, ...field }), /PROVIDER_MESSAGE_ID_COLLISION/);
}
console.log('Durable message retry: 20 delayed duplicates preserve original message; delivery evolution accepted; content/sender/recipient/tenant collisions denied.');
