import assert from 'node:assert/strict';
import { encodeInboxPageCursor, decodeInboxPageCursor } from '../core/inbox/inboxThreadPagination';
import { createConnectThreadEvent, projectConnectThread } from '../core/inbox/threadDomain';
import { FirestoreConnectThreadStore } from '../core/inbox/firestoreThreadStore';
import { createConnectInboxConversationListHttpHandler } from '../core/runtime/connectInboxQueryHttpHandler';
import type { CanonicalContextProvider } from '../core/runtime/connectCore';
import type { ConnectMessageContentStore } from '../core/inbox/messageContentStore';
import { InMemoryConnectThreadStore } from '../core/inbox/threadStore';

const times = [
  '2026-10-08T14:00:00.000Z',
  '2026-10-08T13:00:00.000Z',
  '2026-10-08T12:00:00.000Z',
  '2026-10-08T11:00:00.000Z',
];
const threads = times.map((time, index) => projectConnectThread([
  createConnectThreadEvent({
    eventType: 'CONVERSATION_OPENED',
    requestId: `open-${index}`,
    organizationId: 'org-a',
    conversationId: `thread-${index}`,
    evidenceRef: `provider:event:${index}`,
    channel: 'whatsapp',
    occurredAt: new Date(time),
  }),
])!);
function firestoreRow(thread: typeof threads[number]) {
  return { document: {
    fields: {
      storageSchemaVersion: { integerValue: '1' },
      organizationId: { stringValue: thread.organizationId },
      conversationId: { stringValue: thread.conversationId },
      sourceEventCount: { integerValue: String(thread.sourceEventCount) },
      projectionJson: { stringValue: JSON.stringify(thread) },
    },
  } };
}
const calls: any[] = [];
const fetchImpl: typeof fetch = async (url, init) => {
  const target = String(url);
  if (!target.endsWith(':runQuery')) throw new Error('UNEXPECTED_PATH');
  const data = JSON.parse(String(init?.body));
  calls.push({ url: target, data });
  assert.equal(data.structuredQuery.orderBy[0].field.fieldPath, 'updatedAt');
  assert.equal(data.structuredQuery.orderBy[0].direction, 'DESCENDING');
  assert.equal(data.structuredQuery.orderBy[1].field.fieldPath, '__name__');
  let position = 0;
  const values = data.structuredQuery.startAt?.values;
  if (values) {
    const timestamp = values[0].stringValue;
    const id = values[1].referenceValue.split('/').at(-1);
    position = threads.findIndex(item => item.updatedAt === timestamp && item.conversationId === id) + 1;
    assert.ok(position > 0, 'cursor matches a previous item');
  }
  const page = threads.slice(position, position + data.structuredQuery.limit).map(firestoreRow);
  return new Response(JSON.stringify(page), { status: 200 });
};
const store = new FirestoreConnectThreadStore({
  projectId: 'millionsnest', fetchImpl,
  tokenProvider: { async getAccessToken() { return 'test-token'; } },
});
const one = await store.listPageByOrganization({ organizationId: 'org-a', limit: 2 });
assert.deepEqual(one.threads.map(x => x.conversationId), ['thread-0', 'thread-1']);
assert.ok(one.nextCursor);
const two = await store.listPageByOrganization({ organizationId: 'org-a', limit: 2, cursor: one.nextCursor! });
assert.deepEqual(two.threads.map(x => x.conversationId), ['thread-2', 'thread-3']);
assert.equal(two.nextCursor, null);
assert.equal(calls[0].data.structuredQuery.limit, 3, 'fetch one extra to detect next page');
assert.equal(calls[1].data.structuredQuery.startAt.before, false);
assert.ok(calls.every(call => call.url.includes('/connectOrganizations/org-a:runQuery')));
assert.throws(() => decodeInboxPageCursor(one.nextCursor!, 'org-b'), /INBOX_CURSOR_INVALID/);
await assert.rejects(
  () => store.listPageByOrganization({ organizationId: 'org-b', cursor: one.nextCursor, limit: 2 }),
  /INBOX_CURSOR_INVALID/,
);
assert.throws(
  () => encodeInboxPageCursor({ organizationId: '../bad', conversationId: 'x', updatedAt: times[0] }),
  /INBOX_CURSOR_INVALID/,
);
assert.equal(decodeInboxPageCursor(one.nextCursor!, 'org-a').conversationId, 'thread-1');

const provider: CanonicalContextProvider = {
  async resolve({ requestedOrganizationId }) {
    return { status: 'resolved', context: {
      actorUid: 'actor-1', systemRole: null, globalAccess: false,
      organizationId: requestedOrganizationId || 'org-a', organizationRole: 'admin',
      permissions: [], capabilities: [], appAccess: { musicscale: true },
    } };
  },
};
function mockRes() {
  const state: any = {
    statusCode: 200, body: null, headers: {},
    setHeader(name: string, value: string) { this.headers[name] = value; return this; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
  };
  return state;
}
const handler = createConnectInboxConversationListHttpHandler({
  contextProvider: provider, threadStore: store, messageStore: {} as ConnectMessageContentStore,
});
const firstResponse = mockRes();
await handler({ headers: { authorization: 'Bearer token' },
  query: { organizationId: 'org-a', limit: '2' } } as any, firstResponse);
assert.equal(firstResponse.statusCode, 200);
assert.equal(firstResponse.body.conversations.length, 2);
assert.ok(firstResponse.body.nextCursor);
const nextResponse = mockRes();
await handler({ headers: { authorization: 'Bearer token' },
  query: { organizationId: 'org-a', limit: '2', cursor: firstResponse.body.nextCursor } } as any, nextResponse);
assert.equal(nextResponse.statusCode, 200);
assert.deepEqual(nextResponse.body.conversations.map((item: any) => item.conversationId), ['thread-2', 'thread-3']);
const invalidResponse = mockRes();
await handler({ headers: { authorization: 'Bearer token' },
  query: { organizationId: 'org-b', cursor: firstResponse.body.nextCursor } } as any, invalidResponse);
assert.equal(invalidResponse.statusCode, 400, 'org-mismatched cursor denied before storage');
const legacy = createConnectInboxConversationListHttpHandler({
  contextProvider: provider, threadStore: new InMemoryConnectThreadStore(),
  messageStore: {} as ConnectMessageContentStore,
});
const legacyResponse = mockRes();
await legacy({ headers: { authorization: 'Bearer token' },
  query: { organizationId: 'org-a', cursor: firstResponse.body.nextCursor } } as any, legacyResponse);
assert.equal(legacyResponse.statusCode, 400, 'legacy backend cannot silently ignore cursor');
console.log('Inbox paging: newest-first cursor, organization isolation, page continuation and HTTP PASS');
