import { evaluateConnectInboxReadiness } from '../core/inbox/inboxReadiness';
import { createConnectInboxReadinessHttpHandler } from '../core/runtime/connectInboxReadinessHttpHandler';
import type { CanonicalContextProvider } from '../core/runtime/connectCore';

let total = 0;
let passed = 0;

function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
  passed++;
}

function mockRes() {
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

function contextProvider(
  role: string | null,
  grants: string[] = [],
): CanonicalContextProvider {
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
          permissions: grants,
          capabilities: [],
          appAccess: { musicscale: true },
        },
      };
    },
  };
}

console.log('--- Running Connect Inbox Readiness Tests ---');

{
  const result = evaluateConnectInboxReadiness({}, 'denied_or_missing');
  equal(result.state, 'blocked', 'missing runtime storage blocks Inbox');
  equal(result.durableInboxEnabled, false, 'durable Inbox defaults off');
  equal(result.blockers.includes('durable_storage_not_ready'), true, 'storage blocker is explicit');
  equal(result.blockers.includes('message_content_store_not_mounted'), true, 'message-content boundary remains explicit');
  equal(
    result.foundations.find((item) => item.id === 'thread_state_machine')?.status,
    'ready',
    'thread state machine is represented as ready',
  );
}

{
  const result = evaluateConnectInboxReadiness(
    { CONNECT_INBOX_DURABLE_ENABLED: 'true' },
    'read_write_confirmed',
  );
  equal(result.state, 'controlled', 'durable routing foundation alone remains controlled');
  equal(
    result.foundations.find((item) => item.id === 'durable_event_store')?.status,
    'ready',
    'durable event store is ready only after flag and storage gate',
  );
  equal(
    result.blockers.includes('human_reply_not_mounted'),
    true,
    'human reply must still be mounted before support is real',
  );
}

{
  const result = evaluateConnectInboxReadiness(
    {
      CONNECT_INBOX_DURABLE_ENABLED: 'true',
      CONNECT_INBOX_MESSAGE_CONTENT_ENABLED: 'true',
      CONNECT_WHATSAPP_INGESTION_ENABLED: 'true',
      CONNECT_INBOX_HUMAN_REPLY_ENABLED: 'true',
    },
    'read_write_confirmed',
  );
  equal(result.state, 'available', 'Inbox becomes available only when every real boundary is mounted');
  equal(
    result.foundations.every((item) => item.status === 'ready'),
    true,
    'all Inbox foundations must be ready before availability',
  );
  equal(result.blockers.length, 0, 'fully mounted Inbox has no readiness blockers');
}

{
  const handler = createConnectInboxReadinessHttpHandler({
    contextProvider: contextProvider('admin'),
    env: { CONNECT_INBOX_DURABLE_ENABLED: 'false' },
    storageReadinessProbe: async () => ({
      state: 'denied_or_missing',
      permissions: { read: false, list: false, create: false, update: false },
      source: 'runtime_metadata',
    }),
  });
  const res = mockRes();
  await handler({
    headers: { authorization: 'Bearer token', 'x-organization-id': 'org-1' },
    query: {},
  } as any, res);
  equal(res.statusCode, 200, 'organization admin can inspect Inbox readiness');
  equal(res.body.storageState, 'denied_or_missing', 'readiness exposes safe runtime state');
  equal(res.body.authoritySource, 'organization_role', 'authority source is server-derived');
}

{
  const handler = createConnectInboxReadinessHttpHandler({
    contextProvider: contextProvider('member'),
    env: {},
    storageReadinessProbe: async () => ({
      state: 'unknown',
      permissions: { read: false, list: false, create: false, update: false },
      source: 'metadata_unavailable',
    }),
  });
  const res = mockRes();
  await handler({
    headers: { authorization: 'Bearer token', 'x-organization-id': 'org-1' },
    query: {},
  } as any, res);
  equal(res.statusCode, 403, 'member without Inbox grant cannot inspect readiness');
  equal(res.body.code, 'INBOX_READ_REQUIRED', 'Inbox authority remains canonical');
}

{
  const handler = createConnectInboxReadinessHttpHandler({
    contextProvider: contextProvider('member', ['connect.inbox.read']),
    env: {},
    storageReadinessProbe: async () => ({
      state: 'unknown',
      permissions: { read: false, list: false, create: false, update: false },
      source: 'metadata_unavailable',
    }),
  });
  const res = mockRes();
  await handler({
    headers: { authorization: 'Bearer token', 'x-organization-id': 'org-1' },
    query: {},
  } as any, res);
  equal(res.statusCode, 200, 'explicit Inbox read grant can inspect readiness');
  equal(res.body.authoritySource, 'explicit_grant', 'explicit grant is observable without exposing token');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
