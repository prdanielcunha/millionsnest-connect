import {
  createWhatsAppChannelLinkToken,
  deriveWhatsAppChannelIdentityRef,
  verifyWhatsAppChannelLinkToken,
} from '../core/channels/channelIdentityLink';
import { WhatsAppConnectionRegistry } from '../core/channels/whatsappConnectionRegistry';
import type {
  WhatsAppChannelIdentityBinding,
  WhatsAppChannelIdentityBindingStore,
} from '../core/channels/firestoreWhatsAppChannelIdentityBindingStore';
import {
  createConversationIdFromChannelIdentity,
  createProviderMessageIndexId,
  normalizeMessageContentRecord,
  type ConnectMessageContentRecord,
  type ConnectMessageContentStore,
  type ConnectMessageDeliveryStatus,
} from '../core/inbox/messageContentStore';
import { WhatsAppAssistOrchestrator } from '../core/runtime/whatsappAssistOrchestrator';

let total = 0;
let passed = 0;

function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
  passed++;
}

function ok(value: unknown, message: string) {
  total++;
  if (!value) throw new Error(message);
  passed++;
}

function throwsCode(fn: () => unknown, code: string, message: string) {
  total++;
  try {
    fn();
  } catch (error) {
    if (error instanceof Error && error.message === code) {
      passed++;
      return;
    }
    throw error;
  }
  throw new Error(`${message}: expected ${code}`);
}

class MemoryBindingStore implements WhatsAppChannelIdentityBindingStore {
  value: WhatsAppChannelIdentityBinding | null = null;

  async get(input: { channelOrganizationId: string; channelIdentityRef: string }) {
    if (
      this.value?.channelOrganizationId === input.channelOrganizationId &&
      this.value?.channelIdentityRef === input.channelIdentityRef
    ) {
      return this.value;
    }
    return null;
  }

  async put(binding: WhatsAppChannelIdentityBinding) {
    this.value = { ...binding };
  }
}

class MemoryMessageStore implements ConnectMessageContentStore {
  records: ConnectMessageContentRecord[] = [];

  async put(input: ConnectMessageContentRecord) {
    const record = normalizeMessageContentRecord(input);
    const existing = this.records.find((item) =>
      item.channel === record.channel &&
      item.providerMessageId === record.providerMessageId);
    if (existing) return { kind: 'duplicate' as const, record: existing };
    this.records.push(record);
    return { kind: 'created' as const, record };
  }

  async get(input: { organizationId: string; conversationId: string; messageId: string }) {
    return this.records.find((item) =>
      item.organizationId === input.organizationId &&
      item.conversationId === input.conversationId &&
      item.messageId === input.messageId) ?? null;
  }

  async getByProviderMessageId(input: { channel: string; providerMessageId: string }) {
    return this.records.find((item) =>
      item.channel === input.channel &&
      item.providerMessageId === input.providerMessageId) ?? null;
  }

  async listConversation(input: { organizationId: string; conversationId: string; limit?: number }) {
    return this.records
      .filter((item) =>
        item.organizationId === input.organizationId &&
        item.conversationId === input.conversationId)
      .slice(-(input.limit ?? 100));
  }

  async updateDeliveryStatus(input: {
    organizationId: string;
    conversationId: string;
    messageId: string;
    deliveryStatus: ConnectMessageDeliveryStatus;
    occurredAt: string;
  }) {
    const item = await this.get(input);
    if (!item) return null;
    Object.assign(item, {
      deliveryStatus: input.deliveryStatus,
      deliveryUpdatedAt: new Date(input.occurredAt).toISOString(),
    });
    return item;
  }
}

console.log('--- Running WhatsApp Assist Identity Bridge Tests ---');

const rootSecret = 'connect-whatsapp-link-secret-for-tests';
const nowMs = Date.parse('2026-10-06T03:00:00.000Z');
const rawPhone = '5543999999999';
const phoneNumberId = '1404832352704331';
const channelOrganizationId = 'org-connect-channel';

{
  const identityRef = deriveWhatsAppChannelIdentityRef({
    providerUserId: rawPhone,
    phoneNumberId,
    rootSecret,
  });
  equal(identityRef.length, 64, 'channel identity is a fixed opaque HMAC ref');
  ok(!identityRef.includes(rawPhone), 'opaque channel identity never contains raw WhatsApp phone');

  const token = createWhatsAppChannelLinkToken({
    channelIdentityRef: identityRef,
    channelOrganizationId,
    conversationId: 'conversation-1',
    providerMessageId: 'wamid.in.1',
    rootSecret,
    nowMs,
  });
  const decodedPayload = Buffer.from(token.split('.')[0], 'base64url').toString('utf8');
  ok(!decodedPayload.includes(rawPhone), 'signed link token contains no raw WhatsApp phone');

  const verified = verifyWhatsAppChannelLinkToken({
    token,
    rootSecret,
    nowMs: nowMs + 60_000,
  });
  equal(verified.channelIdentityRef, identityRef, 'valid signed link restores only opaque identity');

  throwsCode(
    () => verifyWhatsAppChannelLinkToken({
      token: token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a'),
      rootSecret,
      nowMs: nowMs + 60_000,
    }),
    'WHATSAPP_LINK_TOKEN_INVALID',
    'tampered link is rejected',
  );

  throwsCode(
    () => verifyWhatsAppChannelLinkToken({
      token,
      rootSecret,
      nowMs: nowMs + (16 * 60 * 1000),
    }),
    'WHATSAPP_LINK_TOKEN_EXPIRED',
    'link expires after the bounded linking window',
  );
}

{
  const registry = new WhatsAppConnectionRegistry([{
    organizationId: channelOrganizationId,
    phoneNumberId,
    connectionRef: 'primary',
    enabled: true,
  }]);
  const bindingStore = new MemoryBindingStore();
  const messageStore = new MemoryMessageStore();
  const replies: any[] = [];
  const hubCalls: any[] = [];
  const coreCalls: any[] = [];

  const event = {
    kind: 'message' as const,
    providerMessageId: 'wamid.magic.1',
    from: rawPhone,
    phoneNumberId,
    timestamp: String(Math.floor(nowMs / 1000)),
    messageType: 'text',
    text: 'Qual é minha próxima escala?',
  };
  const conversationId = createConversationIdFromChannelIdentity({
    organizationId: channelOrganizationId,
    channel: 'whatsapp',
    connectionRef: 'primary',
    channelUserId: rawPhone,
  });

  await messageStore.put({
    schemaVersion: 1,
    organizationId: channelOrganizationId,
    conversationId,
    messageId: createProviderMessageIndexId('whatsapp', event.providerMessageId),
    channel: 'whatsapp',
    direction: 'inbound',
    providerMessageId: event.providerMessageId,
    senderRef: rawPhone,
    recipientRef: phoneNumberId,
    messageType: 'text',
    body: event.text,
    occurredAt: new Date(nowMs).toISOString(),
    recordedAt: new Date(nowMs).toISOString(),
    deliveryStatus: 'received',
    evidenceRef: 'connect-message:whatsapp:test',
  });

  const fakeHub = {
    async createGrant(input: any) {
      hubCalls.push({ kind: 'create', ...input });
      return {
        grantRef: 'grant-ref-1',
        grantSecret: 'grant-secret-1',
        organizationId: 'org-music-real',
        expiresAt: nowMs + (180 * 24 * 60 * 60 * 1000),
      };
    },
    async exchangeGrant(input: any) {
      hubCalls.push({ kind: 'exchange', ...input });
      return {
        customToken: 'firebase-custom-token',
        userId: 'uid-real-1',
        organizationId: 'org-music-real',
        expiresAt: nowMs + (5 * 60 * 1000),
      };
    },
  };

  const orchestrator = new WhatsAppAssistOrchestrator({
    registry,
    bindingStore,
    messageStore,
    hubClient: fakeHub as any,
    tokenExchanger: {
      async exchange(input: any) {
        equal(input.customToken, 'firebase-custom-token', 'Hub custom token is exchanged server-side');
        equal(input.expectedUid, 'uid-real-1', 'custom token exchange is bound to Hub user');
        return 'firebase-id-token-real-user';
      },
    } as any,
    core: {
      async handleMessage(input: any) {
        coreCalls.push(input);
        return {
          status: 'success',
          intent: 'get_next_schedule',
          humanSummary: 'Sua próxima escala é domingo.',
          data: {
            date: '11/10/2026',
            time: '19:00',
            functionNames: ['Guitarra'],
          },
          auditId: 'audit-real-1',
          deepLink: 'https://musicscale.millionsnest.com/scales/scale-real-1',
        };
      },
    } as any,
    replyService: {
      async send(input: any) {
        replies.push(input);
        return {
          kind: 'sent',
          providerMessageId: `wamid.out.${replies.length}`,
          messageId: `out-${replies.length}`,
        };
      },
    } as any,
    linkRootSecret: rootSecret,
    publicOrigin: 'https://connect.millionsnest.com',
    now: () => new Date(nowMs),
    logger: { info() {}, warn() {}, error() {} },
  });

  await orchestrator.afterIngest([event]);
  equal(replies.length, 1, 'unknown WhatsApp identity receives exactly one secure linking prompt');
  ok(
    String(replies[0].text).includes('https://connect.millionsnest.com/link/whatsapp?token='),
    'link prompt points to canonical Connect secure linking route',
  );
  equal(coreCalls.length, 0, 'phone number alone never authorizes a MusicScale Core call');

  const link = String(replies[0].text)
    .split('\n')
    .find((line: string) => line.startsWith('https://connect.millionsnest.com/link/whatsapp?token='));
  ok(link, 'link token is present in the prompt');
  const token = new URL(link!).searchParams.get('token')!;

  const linked = await orchestrator.confirmLink({
    token,
    authToken: 'authenticated-millionsnest-id-token',
    targetOrganizationId: 'org-music-real',
  });

  equal(linked.success, true, 'authenticated link confirmation succeeds');
  equal(linked.answerTriggered, true, 'original WhatsApp question resumes automatically after linking');
  equal(hubCalls[0].kind, 'create', 'link confirmation asks Hub to create channel grant');
  equal(
    hubCalls[0].authToken,
    'authenticated-millionsnest-id-token',
    'Hub grant creation uses authenticated MillionsNest session, not phone identity',
  );
  equal(hubCalls[1].kind, 'exchange', 'linked channel exchanges the Hub-held grant for a fresh session');
  equal(bindingStore.value?.targetOrganizationId, 'org-music-real', 'binding stays pinned to authorized target organization');
  equal(coreCalls.length, 1, 'Core is called only after secure Hub binding');
  equal(coreCalls[0].authToken, 'firebase-id-token-real-user', 'Core receives real short-lived user identity token');
  equal(coreCalls[0].requestedOrganizationId, 'org-music-real', 'Core request is pinned to Hub-authorized organization');
  equal(replies.length, 2, 'successful linking continues with the real automatic WhatsApp answer');
  ok(String(replies[1].text).includes('11/10/2026 · 19:00'), 'WhatsApp answer contains real Core schedule data');
  ok(String(replies[1].text).includes('Guitarra'), 'WhatsApp answer preserves authorized schedule function');
  ok(
    String(replies[1].text).includes('https://musicscale.millionsnest.com/scales/scale-real-1'),
    'WhatsApp answer only exposes trusted MusicScale deep link',
  );

  await orchestrator.afterIngest([{
    ...event,
    providerMessageId: 'wamid.magic.2',
  }]);
  equal(coreCalls.length, 2, 'subsequent message uses the existing secure binding without relinking');
  equal(replies.length, 3, 'subsequent linked request is answered directly in WhatsApp');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
