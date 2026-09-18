import {
  evaluateConnectInboxAuthority,
} from '../core/inbox/inboxAuthority';
import {
  InMemoryConnectThreadStore,
} from '../core/inbox/threadStore';
import {
  ConnectThreadCommandService,
} from '../core/inbox/threadService';
import {
  createConnectInboxThreadCommandHttpHandler,
  createConnectInboxThreadReadHttpHandler,
} from '../core/runtime/connectInboxThreadHttpHandler';
import type {
  CanonicalContextProvider,
  CanonicalContextResolution,
  CanonicalCoreContext,
} from '../core/runtime/connectCore';

let total = 0;
let passed = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
  passed++;
}

function context(overrides: Partial<CanonicalCoreContext> = {}): CanonicalCoreContext {
  return {
    actorUid: 'user-1',
    systemRole: null,
    globalAccess: false,
    organizationId: 'org-1',
    organizationRole: 'member',
    permissions: [],
    capabilities: [],
    appAccess: { musicscale: false, nestlocal: false },
    ...overrides,
  };
}

function provider(result: CanonicalContextResolution): CanonicalContextProvider {
  return {
    async resolve(input) {
      if (result.status === 'resolved' && input.requestedOrganizationId) {
        equal(
          input.requestedOrganizationId,
          'org-1',
          'requested organization is revalidated by canonical provider',
        );
      }
      return result;
    },
  };
}

function req(input: {
  method?: string;
  authorization?: string;
  organizationId?: string;
  conversationId?: string;
  body?: Record<string, unknown>;
}) {
  return {
    method: input.method ?? 'GET',
    headers: {
      authorization: input.authorization === undefined
        ? 'Bearer firebase-id-token'
        : input.authorization,
    },
    query: {
      organizationId: input.organizationId ?? 'org-1',
    },
    params: {
      conversationId: input.conversationId ?? 'thread-1',
    },
    body: input.body,
  } as any;
}

function res() {
  const state: any = { statusCode: 200, body: null, headers: {} };
  state.setHeader = (key: string, value: string) => {
    state.headers[key.toLowerCase()] = value;
    return state;
  };
  state.status = (code: number) => {
    state.statusCode = code;
    return state;
  };
  state.json = (body: unknown) => {
    state.body = body;
    return state;
  };
  return state;
}

console.log('--- Running Connect Inbox Authority + HTTP Contract Tests ---');

{
  equal(
    evaluateConnectInboxAuthority(context({ globalAccess: true }), 'manage').allowed,
    true,
    'Hub global access can manage Inbox',
  );
  equal(
    evaluateConnectInboxAuthority(context({ organizationRole: 'owner' }), 'manage').allowed,
    true,
    'canonical organization owner can manage Inbox',
  );
  equal(
    evaluateConnectInboxAuthority(context({ organizationRole: 'admin' }), 'manage').allowed,
    true,
    'canonical organization admin can manage Inbox',
  );
  equal(
    evaluateConnectInboxAuthority(context({ permissions: ['connect.inbox.read'] }), 'read').allowed,
    true,
    'explicit read permission authorizes read',
  );
  equal(
    evaluateConnectInboxAuthority(context({ capabilities: ['connect.inbox.manage'] }), 'manage').allowed,
    true,
    'explicit manage capability authorizes management',
  );
  equal(
    evaluateConnectInboxAuthority(context({ permissions: ['connect.inbox.read'] }), 'manage').allowed,
    false,
    'read permission never escalates to manage',
  );
  equal(
    evaluateConnectInboxAuthority(context(), 'read').allowed,
    false,
    'ordinary membership without Inbox grant is denied',
  );
}

const store = new InMemoryConnectThreadStore();
const commands = new ConnectThreadCommandService(store, () => new Date('2026-09-18T22:00:00.000Z'));
await commands.open({
  requestId: 'seed-open',
  organizationId: 'org-1',
  conversationId: 'thread-1',
  evidenceRef: 'provider-conversation:seed',
  channel: 'whatsapp',
});

{
  const handler = createConnectInboxThreadReadHttpHandler({
    contextProvider: provider({ status: 'resolved', context: context({ organizationRole: 'owner' }) }),
    store,
  });
  const response = res();
  await handler(req({ authorization: '' }), response);
  equal(response.statusCode, 401, 'Inbox read requires bearer');
  equal(response.body.code, 'AUTH_REQUIRED', 'missing bearer has stable code');
  equal(response.headers['cache-control'], 'no-store', 'Inbox responses are private/no-store');
}

{
  const handler = createConnectInboxThreadReadHttpHandler({
    contextProvider: provider({ status: 'resolved', context: context() }),
    store,
  });
  const response = res();
  await handler(req({}), response);
  equal(response.statusCode, 403, 'ordinary member without grant cannot read');
  equal(response.body.code, 'INBOX_READ_REQUIRED', 'read denial is explicit');
}

{
  const handler = createConnectInboxThreadReadHttpHandler({
    contextProvider: provider({
      status: 'resolved',
      context: context({ permissions: ['connect.inbox.read'] }),
    }),
    store,
  });
  const response = res();
  await handler(req({}), response);
  equal(response.statusCode, 200, 'explicit reader can read thread');
  equal(response.body.thread.conversationId, 'thread-1', 'read is scoped to requested thread');
  equal(JSON.stringify(response.body).includes('firebase-id-token'), false, 'bearer never appears in response');
}

{
  const handler = createConnectInboxThreadReadHttpHandler({
    contextProvider: provider({
      status: 'resolved',
      context: context({ organizationId: 'org-other', globalAccess: true }),
    }),
    store,
  });
  const response = res();
  await handler(req({}), response);
  equal(response.statusCode, 409, 'canonical tenant mismatch fails closed');
  equal(response.body.code, 'ORGANIZATION_CONTEXT_MISMATCH', 'tenant mismatch code is stable');
}

{
  const handler = createConnectInboxThreadCommandHttpHandler({
    contextProvider: provider({
      status: 'resolved',
      context: context({ permissions: ['connect.inbox.read'] }),
    }),
    store,
  });
  const response = res();
  await handler(req({
    method: 'POST',
    body: {
      organizationId: 'org-1',
      action: 'resolve',
      requestId: 'resolve-denied',
      evidenceRef: 'connect-request:resolve-denied',
    },
  }), response);
  equal(response.statusCode, 403, 'read-only member cannot mutate');
  equal(response.body.code, 'INBOX_MANAGE_REQUIRED', 'manage denial is explicit');
}

{
  const handler = createConnectInboxThreadCommandHttpHandler({
    contextProvider: provider({
      status: 'resolved',
      context: context({ organizationRole: 'admin' }),
    }),
    store,
  });
  const response = res();
  await handler(req({
    method: 'POST',
    body: {
      organizationId: 'org-1',
      action: 'handoff',
      requestId: 'handoff-http',
      evidenceRef: 'connect-request:handoff-http',
      assigneeType: 'team',
      assigneeRef: 'care-team',
      reasonCode: 'human_requested',
    },
  }), response);
  equal(response.statusCode, 200, 'canonical admin can handoff');
  equal(response.body.thread.status, 'waiting_team', 'handoff produces waiting team state');
  equal(response.body.thread.mode, 'human', 'handoff pauses automation into human mode');
}

{
  const handler = createConnectInboxThreadCommandHttpHandler({
    contextProvider: provider({
      status: 'resolved',
      context: context({ organizationRole: 'owner' }),
    }),
    store,
  });
  const response = res();
  await handler(req({
    method: 'POST',
    body: {
      organizationId: 'org-1',
      action: 'resolve',
      requestId: 'unsafe-extra',
      evidenceRef: 'connect-request:unsafe-extra',
      content: 'pastoral free text must not enter thread event API',
    },
  }), response);
  equal(response.statusCode, 400, 'unknown/free-text fields are rejected');
  equal(response.body.code, 'UNKNOWN_FIELD', 'unknown field rejection is explicit');
  equal(
    JSON.stringify(await store.readEvents({ organizationId: 'org-1', conversationId: 'thread-1' }))
      .includes('pastoral free text'),
    false,
    'rejected free text never enters event stream',
  );
}

{
  const handler = createConnectInboxThreadReadHttpHandler({
    contextProvider: provider({
      status: 'resolved',
      context: context({ globalAccess: true }),
    }),
    store,
  });
  const response = res();
  await handler(req({ conversationId: '../foreign' }), response);
  equal(response.statusCode, 400, 'invalid conversation scope is rejected before storage');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
