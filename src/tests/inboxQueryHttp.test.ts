import {
  createConnectInboxConversationListHttpHandler,
  createConnectInboxMessageListHttpHandler,
} from '../core/runtime/connectInboxQueryHttpHandler';
import type { CanonicalContextProvider } from '../core/runtime/connectCore';
import { InMemoryConnectThreadStore } from '../core/inbox/threadStore';
import { ConnectThreadCommandService } from '../core/inbox/threadService';
import type {
  ConnectMessageContentRecord,
  ConnectMessageContentStore,
} from '../core/inbox/messageContentStore';

let total = 0;
let passed = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  passed++;
}
function mockRes() {
  const state: any = { statusCode: 200, body: null, headers: {} };
  state.setHeader = (key: string, value: string) => { state.headers[key.toLowerCase()] = value; return state; };
  state.status = (code: number) => { state.statusCode = code; return state; };
  state.json = (body: unknown) => { state.body = body; return state; };
  return state;
}
function contextProvider(role: string | null): CanonicalContextProvider {
  return {
    async resolve({ requestedOrganizationId }) {
      return {
        status: 'resolved',
        context: {
          actorUid: 'user-1',
          systemRole: null,
          globalAccess: false,
          organizationId: requestedOrganizationId || 'org-1',
          organizationRole: role,
          permissions: [],
          capabilities: [],
          appAccess: { musicscale: true },
        },
      };
    },
  };
}

class QueryMessageStore implements ConnectMessageContentStore {
  constructor(private readonly records: ConnectMessageContentRecord[]) {}
  async put(record: ConnectMessageContentRecord) { return { kind: 'created' as const, record }; }
  async get() { return null; }
  async getByProviderMessageId() { return null; }
  async listConversation(input: { organizationId: string; conversationId: string; limit?: number }) {
    return this.records.filter((record) =>
      record.organizationId === input.organizationId &&
      record.conversationId === input.conversationId);
  }
  async updateDeliveryStatus() { return null; }
}

console.log('--- Running Connect Inbox Query HTTP Tests ---');

const threadStore = new InMemoryConnectThreadStore();
const service = new ConnectThreadCommandService(threadStore, () => new Date('2026-09-20T03:00:00Z'));
await service.open({
  requestId: 'open-1',
  organizationId: 'org-1',
  conversationId: 'conversation-1',
  evidenceRef: 'connect-message:whatsapp:abc',
  channel: 'whatsapp',
});
await service.recordPersonReply({
  requestId: 'reply-1',
  organizationId: 'org-1',
  conversationId: 'conversation-1',
  evidenceRef: 'connect-message:whatsapp:abc',
});

const messageStore = new QueryMessageStore([{
  schemaVersion: 1,
  organizationId: 'org-1',
  conversationId: 'conversation-1',
  messageId: 'whatsapp:abc',
  channel: 'whatsapp',
  direction: 'inbound',
  providerMessageId: 'wamid.secret-provider-id',
  senderRef: '5543999999999',
  recipientRef: 'phone-number-id',
  messageType: 'text',
  body: 'Mensagem real',
  occurredAt: '2026-09-20T03:00:00.000Z',
  recordedAt: '2026-09-20T03:00:01.000Z',
  deliveryStatus: 'received',
  evidenceRef: 'connect-message:whatsapp:abc',
}]);

{
  const handler = createConnectInboxConversationListHttpHandler({
    contextProvider: contextProvider('admin'),
    threadStore,
    messageStore,
  });
  const res = mockRes();
  await handler({
    headers: { authorization: 'Bearer token' },
    query: { organizationId: 'org-1' },
  } as any, res);
  equal(res.statusCode, 200, 'authorized admin can list real conversations');
  equal(res.body.conversations.length, 1, 'conversation list is tenant scoped');
  equal(res.body.conversations[0].conversationId, 'conversation-1', 'canonical conversation projection is returned');
}

{
  const handler = createConnectInboxMessageListHttpHandler({
    contextProvider: contextProvider('admin'),
    threadStore,
    messageStore,
  });
  const res = mockRes();
  await handler({
    headers: { authorization: 'Bearer token' },
    query: { organizationId: 'org-1' },
    params: { conversationId: 'conversation-1' },
  } as any, res);
  equal(res.statusCode, 200, 'authorized admin can read message timeline');
  equal(res.body.messages.length, 1, 'timeline returns persisted content');
  equal(res.body.messages[0].body, 'Mensagem real', 'message body is returned to authorized Inbox reader');
  equal('senderRef' in res.body.messages[0], false, 'raw sender PII is omitted from browser contract');
  equal('providerMessageId' in res.body.messages[0], false, 'provider correlation id is omitted from browser contract');
  equal(JSON.stringify(res.body).includes('5543999999999'), false, 'raw phone never leaks through query response');
  equal(JSON.stringify(res.body).includes('wamid.secret-provider-id'), false, 'provider message id never leaks through query response');
}

{
  const handler = createConnectInboxConversationListHttpHandler({
    contextProvider: contextProvider('member'),
    threadStore,
    messageStore,
  });
  const res = mockRes();
  await handler({
    headers: { authorization: 'Bearer token' },
    query: { organizationId: 'org-1' },
  } as any, res);
  equal(res.statusCode, 403, 'member without Inbox read authority cannot list conversations');
  equal(res.body.code, 'INBOX_READ_REQUIRED', 'query denial uses canonical Inbox authority');
}

{
  const handler = createConnectInboxConversationListHttpHandler({
    contextProvider: contextProvider('admin'),
    threadStore,
    messageStore,
  });
  const res = mockRes();
  await handler({
    headers: {},
    query: { organizationId: 'org-1' },
  } as any, res);
  equal(res.statusCode, 401, 'conversation list requires a canonical bearer');
  equal(res.body.code, 'AUTH_REQUIRED', 'missing bearer fails closed');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
