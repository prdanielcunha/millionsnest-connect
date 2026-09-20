import {
  createConnectInboxHumanReplyHttpHandler,
} from '../core/runtime/connectInboxHumanReplyHttpHandler';
import type {
  CanonicalContextProvider,
} from '../core/runtime/connectCore';

let total = 0;
let passed = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  passed++;
}
function res() {
  const state: any = { statusCode: 200, body: null, headers: {} };
  state.setHeader = (key: string, value: string) => { state.headers[key.toLowerCase()] = value; return state; };
  state.status = (code: number) => { state.statusCode = code; return state; };
  state.json = (body: unknown) => { state.body = body; return state; };
  return state;
}
function provider(role: string): CanonicalContextProvider {
  return {
    async resolve({ requestedOrganizationId }) {
      return {
        status: 'resolved',
        context: {
          actorUid: 'user-123456',
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
const readyEnv = {
  CONNECT_INBOX_HUMAN_REPLY_ENABLED: 'true',
  CONNECT_WHATSAPP_PROVIDER_DISPATCH_ENABLED: 'true',
  CONNECT_WHATSAPP_REPLY_POLICY_ACK: 'CONNECT_WHATSAPP_REPLY_POLICY_READY',
  CONNECT_WHATSAPP_ACCESS_TOKEN: 'server-secret',
  CONNECT_WHATSAPP_GRAPH_API_VERSION: 'v99.0',
};
const fakeService: any = {
  async send(input: any) {
    equal(input.organizationId, 'org-1', 'reply service receives canonical organization');
    equal(input.conversationId, 'conversation-1', 'reply service stays on requested conversation');
    return {
      kind: 'sent',
      conversationId: input.conversationId,
      messageId: 'whatsapp:public-message-ref',
      providerMessageId: 'wamid.secret-provider-id',
      deliveryStatus: 'sent',
    };
  },
};

console.log('--- Running Inbox Human Reply HTTP Tests ---');

{
  const handler = createConnectInboxHumanReplyHttpHandler({
    contextProvider: provider('admin'),
    service: fakeService,
    env: readyEnv,
    logger: { info() {}, warn() {}, error() {} },
  });
  const response = res();
  await handler({
    headers: { authorization: 'Bearer firebase-token' },
    params: { conversationId: 'conversation-1' },
    body: {
      organizationId: 'org-1',
      requestId: 'reply-request-123',
      text: 'Olá',
    },
  } as any, response);
  equal(response.statusCode, 201, 'canonical admin can send human reply when every gate is ready');
  equal(response.body.deliveryStatus, 'sent', 'browser gets safe delivery status');
  equal('providerMessageId' in response.body, false, 'provider correlation id never reaches browser');
  equal(JSON.stringify(response.body).includes('wamid.secret-provider-id'), false, 'provider id is absent from response bytes');
}

{
  const handler = createConnectInboxHumanReplyHttpHandler({
    contextProvider: provider('member'),
    service: fakeService,
    env: readyEnv,
    logger: { info() {}, warn() {}, error() {} },
  });
  const response = res();
  await handler({
    headers: { authorization: 'Bearer firebase-token' },
    params: { conversationId: 'conversation-1' },
    body: { organizationId: 'org-1', requestId: 'reply-request-124', text: 'Olá' },
  } as any, response);
  equal(response.statusCode, 403, 'ordinary member cannot send organizational reply');
  equal(response.body.code, 'INBOX_MANAGE_REQUIRED', 'manage denial stays canonical');
}

{
  const handler = createConnectInboxHumanReplyHttpHandler({
    contextProvider: provider('admin'),
    service: fakeService,
    env: { ...readyEnv, CONNECT_WHATSAPP_PROVIDER_DISPATCH_ENABLED: 'false' },
    logger: { info() {}, warn() {}, error() {} },
  });
  const response = res();
  await handler({
    headers: { authorization: 'Bearer firebase-token' },
    params: { conversationId: 'conversation-1' },
    body: { organizationId: 'org-1', requestId: 'reply-request-125', text: 'Olá' },
  } as any, response);
  equal(response.statusCode, 409, 'provider gate prevents accidental dispatch');
  equal(response.body.code, 'HUMAN_REPLY_NOT_READY', 'disabled provider has explicit safe state');
}

{
  const handler = createConnectInboxHumanReplyHttpHandler({
    contextProvider: provider('admin'),
    service: fakeService,
    env: readyEnv,
  });
  const response = res();
  await handler({
    headers: {},
    params: { conversationId: 'conversation-1' },
    body: { organizationId: 'org-1', requestId: 'reply-request-126', text: 'Olá' },
  } as any, response);
  equal(response.statusCode, 401, 'reply endpoint always requires bearer');
  equal(response.body.code, 'AUTH_REQUIRED', 'missing bearer fails closed');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
