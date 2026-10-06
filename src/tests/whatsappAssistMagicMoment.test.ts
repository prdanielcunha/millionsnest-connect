import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  createWhatsAppChannelLinkToken,
  deriveWhatsAppChannelIdentityRef,
  verifyWhatsAppChannelLinkToken,
} from '../core/channels/channelIdentityLink';
import {
  FirestoreWhatsAppChannelIdentityBindingStore,
  type WhatsAppChannelIdentityBinding,
} from '../core/channels/firestoreWhatsAppChannelIdentityBindingStore';
import { WhatsAppConnectionRegistry } from '../core/channels/whatsappConnectionRegistry';
import {
  createConversationIdFromChannelIdentity,
  type ConnectMessageContentRecord,
} from '../core/inbox/messageContentStore';
import {
  FirebaseCustomTokenExchanger,
  HubChannelGrantHttpClient,
} from '../core/runtime/hubChannelGrantHttpClient';
import { WhatsAppAssistOrchestrator } from '../core/runtime/whatsappAssistOrchestrator';

const rootSecret = 'test-root-secret-that-is-long-enough-123456789';
const channelOrganizationId = 'connect-channel-org';
const targetOrganizationId = 'church-music-org';
const phoneNumberId = '1404832352704331';
const sender = '5543991234567';
const providerMessageId = 'wamid.magic-moment-1';
const nowMs = 1_800_000_000_000;

console.log('--- Running WhatsApp Assist Magic Moment Tests ---');

{
  const serverSource = fs.readFileSync('src/server/createConnectServer.ts', 'utf8');
  assert.match(
    serverSource,
    /const linkRootSecret = env\.CONNECT_WHATSAPP_APP_SECRET\?\.trim\(\)/,
    'WhatsApp channel cryptography must use the high-entropy app secret root',
  );
  assert.doesNotMatch(
    serverSource,
    /const linkRootSecret = env\.CONNECT_WHATSAPP_WEBHOOK_VERIFY_TOKEN/,
    'Operator webhook verify token must never be reused as the channel encryption/signing root',
  );
}

{
  const first = deriveWhatsAppChannelIdentityRef({ providerUserId: sender, phoneNumberId, rootSecret });
  const same = deriveWhatsAppChannelIdentityRef({ providerUserId: sender, phoneNumberId, rootSecret });
  const otherBusinessNumber = deriveWhatsAppChannelIdentityRef({
    providerUserId: sender,
    phoneNumberId: '999999999',
    rootSecret,
  });
  assert.equal(first, same, 'channel identity ref must be stable');
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, otherBusinessNumber, 'same person on another business number gets an isolated channel identity');
  assert.equal(first.includes(sender), false, 'raw WhatsApp sender never appears in the identity ref');

  const token = createWhatsAppChannelLinkToken({
    channelIdentityRef: first,
    channelOrganizationId,
    conversationId: 'whatsapp_conversation_1',
    providerMessageId,
    rootSecret,
    nowMs,
  });
  const verified = verifyWhatsAppChannelLinkToken({ token, rootSecret, nowMs: nowMs + 1_000 });
  assert.equal(verified.channelIdentityRef, first);
  assert.equal(verified.channelOrganizationId, channelOrganizationId);
  assert.throws(
    () => verifyWhatsAppChannelLinkToken({ token: token + 'tamper', rootSecret, nowMs: nowMs + 1_000 }),
    /WHATSAPP_LINK_TOKEN_INVALID/,
  );
  assert.throws(
    () => verifyWhatsAppChannelLinkToken({ token, rootSecret, nowMs: nowMs + 16 * 60_000 }),
    /WHATSAPP_LINK_TOKEN_EXPIRED/,
  );
}

{
  let storedBody = '';
  let storedFields: any = null;
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      storedBody = String(init.body || '');
      storedFields = JSON.parse(storedBody).fields;
      return new Response(JSON.stringify({ fields: storedFields }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (init?.method === 'GET' && storedFields) {
      return new Response(JSON.stringify({ fields: storedFields }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  const store = new FirestoreWhatsAppChannelIdentityBindingStore({
    projectId: 'millionsnest',
    encryptionRootSecret: rootSecret,
    fetchImpl,
    tokenProvider: { getAccessToken: async () => 'metadata-token' },
  });
  const identityRef = deriveWhatsAppChannelIdentityRef({ providerUserId: sender, phoneNumberId, rootSecret });
  const binding: WhatsAppChannelIdentityBinding = {
    schemaVersion: 1,
    channelOrganizationId,
    channelIdentityRef: identityRef,
    grantRef: identityRef,
    grantSecret: 'grant-secret-must-not-be-plaintext',
    targetOrganizationId,
    linkedAtMs: nowMs,
    expiresAtMs: nowMs + 60_000,
  };
  await store.put(binding);
  assert.equal(
    storedBody.includes(binding.grantSecret),
    false,
    'Hub grant credential must be encrypted before Firestore persistence',
  );
  const loaded = await store.get({ channelOrganizationId, channelIdentityRef: identityRef });
  assert.equal(loaded?.grantSecret, binding.grantSecret, 'server can decrypt its own stored binding');
  assert.equal(loaded?.targetOrganizationId, targetOrganizationId);
}

{
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith('/api/ecosystem/connect/channel-grants')) {
      return new Response(JSON.stringify({
        success: true,
        grantRef: 'a'.repeat(64),
        grantSecret: 'grant_secret_abcdefghijklmnopqrstuvwxyz012345',
        organizationId: targetOrganizationId,
        expiresAt: nowMs + 60_000,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.endsWith('/api/ecosystem/connect/channel-session')) {
      return new Response(JSON.stringify({
        success: true,
        customToken: 'firebase-custom-token',
        userId: 'uid-1',
        organizationId: targetOrganizationId,
        expiresAt: nowMs + 300_000,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.startsWith('https://identitytoolkit.googleapis.com/')) {
      return new Response(JSON.stringify({
        idToken: 'fresh-firebase-id-token',
        localId: 'uid-1',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  const hub = new HubChannelGrantHttpClient({ hubOrigin: 'https://www.millionsnest.com', fetchImpl });
  const grant = await hub.createGrant({
    authToken: 'browser-firebase-id-token',
    channelIdentityRef: 'a'.repeat(64),
    organizationId: targetOrganizationId,
  });
  assert.equal(grant.organizationId, targetOrganizationId);
  assert.match(String(calls[0].init?.headers), /object Object/);
  assert.equal((calls[0].init?.headers as any).Authorization, 'Bearer browser-firebase-id-token');

  const session = await hub.exchangeGrant({ grantRef: grant.grantRef, grantSecret: grant.grantSecret });
  const exchanger = new FirebaseCustomTokenExchanger({ apiKey: 'public-firebase-web-api-key', fetchImpl });
  const idToken = await exchanger.exchange({ customToken: session.customToken, expectedUid: session.userId });
  assert.equal(idToken, 'fresh-firebase-id-token');
}

{
  const registry = new WhatsAppConnectionRegistry([{
    organizationId: channelOrganizationId,
    phoneNumberId,
    connectionRef: 'primary',
    enabled: true,
  }]);

  const conversationId = createConversationIdFromChannelIdentity({
    organizationId: channelOrganizationId,
    channel: 'whatsapp',
    connectionRef: 'primary',
    channelUserId: sender,
  });
  const original: ConnectMessageContentRecord = {
    schemaVersion: 1,
    organizationId: channelOrganizationId,
    conversationId,
    messageId: 'msg-1',
    channel: 'whatsapp',
    direction: 'inbound',
    providerMessageId,
    senderRef: sender,
    recipientRef: phoneNumberId,
    messageType: 'text',
    body: 'Qual é minha próxima escala?',
    occurredAt: new Date(nowMs).toISOString(),
    recordedAt: new Date(nowMs).toISOString(),
    deliveryStatus: 'received',
    evidenceRef: 'evidence-1',
  };

  let binding: WhatsAppChannelIdentityBinding | null = null;
  const sent: Array<{ requestId: string; text: string }> = [];
  let coreCalls = 0;
  let createdGrantOrganization = '';

  const messageStore = {
    async getByProviderMessageId(input: { providerMessageId: string }) {
      return input.providerMessageId === providerMessageId ? original : null;
    },
  };

  const orchestrator = new WhatsAppAssistOrchestrator({
    registry,
    bindingStore: {
      async get() { return binding; },
      async put(next) { binding = next; },
    },
    messageStore: messageStore as any,
    hubClient: {
      async createGrant(input: { organizationId: string }) {
        createdGrantOrganization = input.organizationId;
        return {
          grantRef: 'b'.repeat(64),
          grantSecret: 'grant_secret_linked_abcdefghijklmnopqrstuvwxyz',
          organizationId: input.organizationId,
          expiresAt: nowMs + 86_400_000,
        };
      },
      async exchangeGrant() {
        return {
          customToken: 'custom-token',
          userId: 'uid-linked',
          organizationId: targetOrganizationId,
          expiresAt: nowMs + 300_000,
        };
      },
    } as any,
    tokenExchanger: {
      async exchange(input: { expectedUid: string }) {
        assert.equal(input.expectedUid, 'uid-linked');
        return 'firebase-id-token';
      },
    } as any,
    core: {
      async handleMessage(input: any) {
        coreCalls++;
        assert.equal(input.authToken, 'firebase-id-token');
        assert.equal(input.requestedOrganizationId, targetOrganizationId);
        assert.equal(input.channel.type, 'whatsapp');
        assert.equal(input.channel.conversationId, conversationId);
        return {
          status: 'success',
          intent: 'get_next_schedule',
          humanSummary: 'Sua próxima escala é domingo.',
          data: {
            id: 'scale-1',
            date: '2026-10-11',
            time: '19:00',
            functionNames: ['Guitarra'],
          },
          auditId: 'audit-1',
          deepLink: 'https://musicscale.millionsnest.com/schedules/scale-1',
        };
      },
    } as any,
    replyService: {
      async send(input: any) {
        sent.push({ requestId: input.requestId, text: input.text });
        return { kind: 'sent', providerMessageId: `out-${sent.length}`, messageId: `msg-out-${sent.length}` };
      },
    } as any,
    linkRootSecret: rootSecret,
    publicOrigin: 'https://connect.millionsnest.com',
    now: () => new Date(nowMs),
    logger: { info() {}, warn() {}, error() {} },
  });

  await orchestrator.afterIngest([{
    kind: 'message',
    providerMessageId,
    from: sender,
    phoneNumberId,
    timestamp: String(Math.floor(nowMs / 1000)),
    messageType: 'text',
    text: original.body,
  }]);

  assert.equal(coreCalls, 0, 'unlinked WhatsApp must not access MusicScale');
  assert.equal(sent.length, 1, 'known intent receives exactly one secure linking prompt');
  const linkLine = sent[0].text.split('\n').find((line) => line.startsWith('https://connect.millionsnest.com/link/whatsapp?token='));
  assert.ok(linkLine, 'link prompt uses the canonical Connect origin');
  const linkToken = new URL(linkLine!).searchParams.get('token');
  assert.ok(linkToken);

  const confirmation = await orchestrator.confirmLink({
    token: linkToken!,
    authToken: 'browser-firebase-id-token',
    targetOrganizationId,
  });
  assert.equal(confirmation.success, true);
  assert.equal(confirmation.answerTriggered, true, 'linking automatically resumes the original WhatsApp request');
  assert.equal(createdGrantOrganization, targetOrganizationId);
  assert.equal(binding?.targetOrganizationId, targetOrganizationId);
  assert.equal(coreCalls, 1);
  assert.equal(sent.length, 2, 'the resumed request sends the actual Assist answer');
  assert.match(sent[1].text, /Sua próxima escala é domingo/);
  assert.match(sent[1].text, /2026-10-11 · 19:00/);
  assert.match(sent[1].text, /Guitarra/);
  assert.match(sent[1].text, /musicscale\.millionsnest\.com/);
  assert.equal(sent[1].text.includes('grant_secret'), false, 'no grant credential leaks into WhatsApp output');

  await orchestrator.afterIngest([{
    kind: 'message',
    providerMessageId: 'wamid.unknown',
    from: sender,
    phoneNumberId,
    timestamp: String(Math.floor(nowMs / 1000)),
    messageType: 'text',
    text: 'Oi, preciso falar com alguém.',
  }]);
  assert.equal(sent.length, 2, 'unknown intent remains in Inbox for human handling');
}

console.log('✅ WhatsApp Assist magic moment preserves channel possession, Hub authority and automatic continuation.');
