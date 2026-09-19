import { evaluateConnectOperationalReadiness } from '../core/operations/operationalReadiness';
import { createConnectOperationalReadinessHttpHandler } from '../core/runtime/connectOperationalReadinessHttpHandler';
import type { CanonicalContextProvider } from '../core/runtime/connectCore';

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
function provider(globalAccess: boolean, role: string | null = null): CanonicalContextProvider {
  return {
    async resolve({ requestedOrganizationId }) {
      return {
        status: 'resolved',
        context: {
          actorUid: 'user-1',
          systemRole: globalAccess ? 'ceo' : null,
          globalAccess,
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

console.log('--- Running Connect Operational Readiness Tests ---');

{
  const result = evaluateConnectOperationalReadiness({
    CONNECT_RELEASE_SHA: 'release-123',
    MILLIONSNEST_HUB_ORIGIN: 'https://www.millionsnest.com',
    MUSICSCALE_ORIGIN: 'https://musicscale.millionsnest.com',
    CONNECT_INBOX_DURABLE_ENABLED: 'false',
    CONNECT_WHATSAPP_WEBHOOK_ENABLED: 'false',
    CONNECT_WHATSAPP_OUTBOUND_VALIDATION_ENABLED: 'true',
  }, 'denied_or_missing', new Date('2026-09-19T12:00:00Z'));

  equal(result.releaseSha, 'release-123', 'release sha is exposed from immutable runtime config');
  equal(result.overall, 'blocked', 'missing storage keeps overall readiness blocked');
  equal(result.gates.find((gate) => gate.id === 'core')?.status, 'ready', 'configured Core is ready');
  equal(result.gates.find((gate) => gate.id === 'tool_gateway')?.status, 'ready', 'MusicScale read vertical is ready');
  equal(result.gates.find((gate) => gate.id === 'structured_audit')?.status, 'ready', 'structured audit is explicit');
  equal(result.gates.find((gate) => gate.id === 'rollback')?.status, 'ready', 'rollback posture is explicit');
  equal(result.flags.durableInbox, false, 'durable Inbox gate remains visible');
  equal(result.flags.whatsappOutboundValidation, true, 'outbound validation flag is visible without secret material');
  equal(JSON.stringify(result).includes('token'), false, 'operational readiness does not carry provider tokens');
}

{
  const handler = createConnectOperationalReadinessHttpHandler({
    contextProvider: provider(true),
    env: {
      CONNECT_RELEASE_SHA: 'release-456',
      MILLIONSNEST_HUB_ORIGIN: 'https://www.millionsnest.com',
      MUSICSCALE_ORIGIN: 'https://musicscale.millionsnest.com',
    },
    storageReadinessProbe: async () => ({
      state: 'read_write_confirmed',
      permissions: { read: true, list: true, create: true, update: true },
      source: 'runtime_metadata',
    }),
  });
  const res = mockRes();
  await handler({
    headers: { authorization: 'Bearer token', 'x-organization-id': 'org-1' },
    query: {},
  } as any, res);
  equal(res.statusCode, 200, 'global governance can inspect operational readiness');
  equal(res.body.releaseSha, 'release-456', 'endpoint returns immutable release identifier');
  equal(res.body.organizationId, 'org-1', 'endpoint remains tenant-pinned');
}

{
  const handler = createConnectOperationalReadinessHttpHandler({
    contextProvider: provider(false, 'member'),
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
  equal(res.statusCode, 403, 'ordinary member cannot inspect operational governance');
  equal(res.body.code, 'OPERATIONS_ACCESS_DENIED', 'operations denial is explicit');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
