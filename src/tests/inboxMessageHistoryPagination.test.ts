import assert from 'node:assert/strict';
import { decodeInboxMessageCursor, encodeInboxMessageCursor } from '../core/inbox/inboxMessagePagination';
import { FirestoreMessageContentStore } from '../core/inbox/firestoreMessageContentStore';
import { createConnectInboxMessageListHttpHandler } from '../core/runtime/connectInboxQueryHttpHandler';
import { InMemoryConnectThreadStore } from '../core/inbox/threadStore';
import { ConnectThreadCommandService } from '../core/inbox/threadService';
import type { ConnectMessageContentRecord } from '../core/inbox/messageContentStore';
import type { CanonicalContextProvider } from '../core/runtime/connectCore';

const timestamps = [
  '2026-10-08T13:00:00.000Z',
  '2026-10-08T12:00:00.000Z',
  '2026-10-08T11:00:00.000Z',
  '2026-10-08T10:00:00.000Z',
  '2026-10-08T09:00:00.000Z',
];
const msgs: ConnectMessageContentRecord[] = timestamps.map((occurredAt, i) => ({
  schemaVersion: 1,
  organizationId: 'org-a',
  conversationId: 'conversation-1',
  messageId: `message-${i}`,
  channel: 'whatsapp',
  direction: i % 2 ? 'outbound' : 'inbound',
  providerMessageId: `provider-${i}`,
  senderRef: '5543999999999',
  messageType: 'text',
  body: `Mensagem ${i}`,
  occurredAt,
  recordedAt: occurredAt,
  deliveryStatus: 'received',
  evidenceRef: `evidence:${i}`,
}));
function jsonCanonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(jsonCanonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return '{' + Object.keys(obj).sort().map(key => JSON.stringify(key)+':'+jsonCanonical(obj[key])).join(',')+'}';
  }
  return JSON.stringify(value);
}
import { createHash } from 'node:crypto';
function row(message: ConnectMessageContentRecord) {
  return { document: {
    fields: {
      storageSchemaVersion: { integerValue: '1' },
      recordJson: { stringValue: jsonCanonical(message) },
      recordFingerprint: { stringValue: createHash('sha256').update(jsonCanonical(message)).digest('hex') },
    },
  } };
}
const calls: any[] = [];
const fetchImpl: typeof fetch = async (url, init) => {
  const target = String(url);
  assert.ok(target.includes('/connectSensitiveOrganizations/org-a/inboxMessageContent/conversation-1:runQuery'));
  const body = JSON.parse(String(init?.body || '{}'));
  calls.push(body);
  const query = body.structuredQuery;
  assert.equal(query.orderBy[0].field.fieldPath, 'occurredAt');
  assert.equal(query.orderBy[0].direction, 'DESCENDING');
  assert.equal(query.orderBy[1].field.fieldPath, '__name__');
  const values = query.startAt?.values;
  let offset = 0;
  if (values) {
    const id = values[1].referenceValue.split('/').at(-1);
    offset = msgs.findIndex(item => item.messageId === id) + 1;
    assert.ok(offset > 0);
  }
  return new Response(JSON.stringify(msgs.slice(offset, offset + query.limit).map(row)), { status: 200 });
};
const store = new FirestoreMessageContentStore({
  projectId: 'millionsnest', fetchImpl,
  tokenProvider: { async getAccessToken() { return 'test-token'; } },
});
const first = await store.listHistoryPage({
  organizationId: 'org-a', conversationId: 'conversation-1', limit: 2,
});
assert.deepEqual(first.messages.map(x => x.messageId), ['message-1', 'message-0']);
assert.ok(first.olderCursor);
const second = await store.listHistoryPage({
  organizationId: 'org-a', conversationId: 'conversation-1', limit: 2, cursor: first.olderCursor!,
});
assert.deepEqual(second.messages.map(x => x.messageId), ['message-3', 'message-2']);
assert.ok(second.olderCursor);
const third = await store.listHistoryPage({
  organizationId: 'org-a', conversationId: 'conversation-1', limit: 2, cursor: second.olderCursor!,
});
assert.deepEqual(third.messages.map(x => x.messageId), ['message-4']);
assert.equal(third.olderCursor, null);
const latestCompat = await store.listConversation({ organizationId: 'org-a', conversationId: 'conversation-1', limit: 2 });
assert.deepEqual(latestCompat.map(x => x.messageId), ['message-1', 'message-0']);
assert.ok(calls.every(call => call.structuredQuery.limit === 3));
assert.throws(() => decodeInboxMessageCursor(first.olderCursor!, 'org-b', 'conversation-1'), /INBOX_MESSAGE_CURSOR_INVALID/);
assert.throws(() => decodeInboxMessageCursor(first.olderCursor!, 'org-a', 'conversation-2'), /INBOX_MESSAGE_CURSOR_INVALID/);
assert.throws(() => encodeInboxMessageCursor({
  organizationId: 'org-a', conversationId: '../bad', messageId: 'msg', occurredAt: timestamps[0],
}), /INBOX_MESSAGE_CURSOR_INVALID/);

const threadStore = new InMemoryConnectThreadStore();
const service = new ConnectThreadCommandService(threadStore);
await service.open({
  organizationId: 'org-a', conversationId: 'conversation-1',
  evidenceRef: 'evidence:x', requestId: 'open-1', channel: 'whatsapp',
});
const ctx: CanonicalContextProvider = {
  async resolve({ requestedOrganizationId }) {
    return { status: 'resolved', context: {
      actorUid: 'actor', systemRole: null, globalAccess: false,
      organizationId: requestedOrganizationId || 'org-a', organizationRole: 'admin',
      capabilities: [], permissions: [], appAccess: { musicscale: true },
    } };
  },
};
function response() {
  const r: any = {
    statusCode: 200, body: null, headers: {},
    setHeader(key: string, val: string) { this.headers[key] = val; return this; },
    status(status: number) { this.statusCode = status; return this; },
    json(value: any) { this.body = value; return this; },
  };
  return r;
}
const handler = createConnectInboxMessageListHttpHandler({
  contextProvider: ctx, threadStore, messageStore: store,
});
const res = response();
await handler({ headers: { authorization: 'Bearer token' }, query: { organizationId: 'org-a', limit: '2' }, params: { conversationId: 'conversation-1' } } as any, res);
assert.equal(res.statusCode, 200);
assert.ok(res.body.olderCursor);
assert.equal(res.body.messages.length, 2);
assert.ok(!JSON.stringify(res.body).includes('5543999999999'));
assert.ok(!JSON.stringify(res.body).includes('provider-0'));
const next = response();
await handler({ headers: { authorization: 'Bearer token' }, query: {
  organizationId: 'org-a', limit: '2', cursor: res.body.olderCursor,
}, params: { conversationId: 'conversation-1' } } as any, next);
assert.deepEqual(next.body.messages.map((x: any) => x.messageId), ['message-3', 'message-2']);
const denied = response();
await handler({ headers: { authorization: 'Bearer token' }, query: {
  organizationId: 'org-a', cursor: res.body.olderCursor,
}, params: { conversationId: 'conversation-other' } } as any, denied);
assert.equal(denied.statusCode, 404, 'missing conversation denied before querying sensitive content');
const wrong = response();
await handler({ headers: { authorization: 'Bearer token' }, query: {
  organizationId: 'org-a', cursor: res.body.olderCursor,
}, params: { conversationId: 'conversation-1' } } as any, wrong);
assert.equal(wrong.statusCode, 200);
console.log('Inbox timeline: ordered pages, cursor isolation and no sender PII exposed PASS');
