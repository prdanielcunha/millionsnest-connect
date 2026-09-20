import { evaluateConnectChannelReadiness } from '../core/channels/channelReadiness';
import { createConnectChannelReadinessHttpHandler } from '../core/runtime/connectChannelReadinessHttpHandler';
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
function provider(globalAccess: boolean, organizationRole: string | null = null): CanonicalContextProvider {
  return {
    async resolve({ requestedOrganizationId }) {
      return {
        status: 'resolved',
        context: {
          actorUid: 'user-1',
          systemRole: globalAccess ? 'ceo' : null,
          globalAccess,
          organizationId: requestedOrganizationId || 'org-1',
          organizationRole,
          permissions: [],
          capabilities: [],
          appAccess: { musicscale: true },
        },
      };
    },
  };
}

console.log('--- Running Connect Channel Readiness Tests ---');

{
  const result = evaluateConnectChannelReadiness({
    MILLIONSNEST_HUB_ORIGIN: 'https://www.millionsnest.com',
    MUSICSCALE_ORIGIN: 'https://musicscale.millionsnest.com',
  }, 'denied_or_missing');
  const inapp = result.channels.find((item) => item.id === 'inapp')!;
  const whatsapp = result.channels.find((item) => item.id === 'whatsapp')!;
  equal(inapp.status, 'active', 'in-app is real when Core upstreams are configured');
  equal(whatsapp.status, 'blocked', 'WhatsApp stays blocked without provider setup');
  equal(whatsapp.sendReady, false, 'WhatsApp dispatch is never implied by readiness model');
  equal(whatsapp.blockers.includes('provider_dispatch_disabled'), true, 'dispatch gate remains explicit');
}
{
  const result = evaluateConnectChannelReadiness({
    MILLIONSNEST_HUB_ORIGIN: 'https://www.millionsnest.com',
    MUSICSCALE_ORIGIN: 'https://musicscale.millionsnest.com',
    CONNECT_WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify',
    CONNECT_WHATSAPP_APP_SECRET: 'secret',
    CONNECT_WHATSAPP_ACCESS_TOKEN: 'access',
    CONNECT_WHATSAPP_PHONE_NUMBER_ID: 'phone',
    CONNECT_WHATSAPP_WEBHOOK_ENABLED: 'true',
    CONNECT_INBOX_DURABLE_ENABLED: 'true',
    CONNECT_INBOX_MESSAGE_CONTENT_ENABLED: 'true',
    CONNECT_WHATSAPP_INGESTION_ENABLED: 'true',
    CONNECT_WHATSAPP_CONNECTIONS_JSON: JSON.stringify([{
      organizationId: 'org-1',
      phoneNumberId: 'phone',
      connectionRef: 'wa-main',
      enabled: true,
    }]),
  }, 'read_write_confirmed');
  const whatsapp = result.channels.find((item) => item.id === 'whatsapp')!;
  equal(whatsapp.receiveReady, true, 'WhatsApp receive readiness requires every gate');
  equal(whatsapp.status, 'active', 'receive-ready WhatsApp is operationally active');
  equal(whatsapp.sendReady, false, 'receive readiness does not fake outbound dispatch');
  equal(whatsapp.blockers.includes('provider_policy_ack_missing'), true, 'Meta policy acknowledgement remains explicit');
}
{
  const result = evaluateConnectChannelReadiness({
    MILLIONSNEST_HUB_ORIGIN: 'https://www.millionsnest.com',
    MUSICSCALE_ORIGIN: 'https://musicscale.millionsnest.com',
    CONNECT_WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify',
    CONNECT_WHATSAPP_APP_SECRET: 'secret',
    CONNECT_WHATSAPP_ACCESS_TOKEN: 'access',
    CONNECT_WHATSAPP_PHONE_NUMBER_ID: 'phone',
    CONNECT_WHATSAPP_GRAPH_API_VERSION: 'v99.0',
    CONNECT_WHATSAPP_WEBHOOK_ENABLED: 'true',
    CONNECT_INBOX_DURABLE_ENABLED: 'true',
    CONNECT_INBOX_MESSAGE_CONTENT_ENABLED: 'true',
    CONNECT_WHATSAPP_INGESTION_ENABLED: 'true',
    CONNECT_INBOX_HUMAN_REPLY_ENABLED: 'true',
    CONNECT_WHATSAPP_PROVIDER_DISPATCH_ENABLED: 'true',
    CONNECT_WHATSAPP_REPLY_POLICY_ACK: 'CONNECT_WHATSAPP_REPLY_POLICY_READY',
    CONNECT_WHATSAPP_CONNECTIONS_JSON: JSON.stringify([{
      organizationId: 'org-1',
      phoneNumberId: 'phone',
      connectionRef: 'wa-main',
      enabled: true,
    }]),
  }, 'read_write_confirmed');
  const whatsapp = result.channels.find((item) => item.id === 'whatsapp')!;
  equal(whatsapp.receiveReady, true, 'fully configured WhatsApp remains receive ready');
  equal(whatsapp.sendReady, true, 'official human reply is send-ready only after every explicit gate');
  equal(whatsapp.capabilities.includes('official_human_reply'), true, 'send-ready channel exposes the real reply capability');
}
{
  const handler = createConnectChannelReadinessHttpHandler({
    contextProvider: provider(true),
    env: {
      MILLIONSNEST_HUB_ORIGIN: 'https://www.millionsnest.com',
      MUSICSCALE_ORIGIN: 'https://musicscale.millionsnest.com',
    },
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
  equal(res.statusCode, 200, 'global governance can inspect channel readiness');
  equal(res.body.storageState, 'denied_or_missing', 'real storage gate is exposed without secrets');
  equal(JSON.stringify(res.body).includes('secret'), false, 'readiness response never exposes secrets');
}
{
  const handler = createConnectChannelReadinessHttpHandler({
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
  equal(res.statusCode, 403, 'ordinary member cannot inspect channel administration');
  equal(res.body.code, 'CHANNELS_ACCESS_DENIED', 'channel administration denial is explicit');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
