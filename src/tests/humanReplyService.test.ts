import {
  HumanReplyService,
} from '../core/inbox/humanReplyService';
import {
  WhatsAppConnectionRegistry,
} from '../core/channels/whatsappConnectionRegistry';
import type {
  WhatsAppProvider,
} from '../core/channels/metaWhatsAppProvider';
import {
  InMemoryConnectThreadStore,
} from '../core/inbox/threadStore';
import {
  ConnectThreadCommandService,
} from '../core/inbox/threadService';
import type {
  ConnectMessageContentRecord,
  ConnectMessageContentStore,
  ConnectMessageDeliveryStatus,
} from '../core/inbox/messageContentStore';
import {
  createProviderMessageIndexId,
  normalizeMessageContentRecord,
} from '../core/inbox/messageContentStore';
import type {
  BeginHumanReplyDispatchResult,
  HumanReplyDispatchRecord,
  HumanReplyDispatchStore,
} from '../core/inbox/humanReplyDispatchStore';
import {
  createHumanReplyDispatchId,
} from '../core/inbox/humanReplyDispatchStore';

let total = 0;
let passed = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  passed++;
}
async function rejects(fn: () => Promise<unknown>, code: string, message: string) {
  total++;
  try {
    await fn();
  } catch (error) {
    if (error instanceof Error && error.message === code) {
      passed++;
      return;
    }
    throw error;
  }
  throw new Error(`${message}: expected ${code}`);
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
    const index = this.records.findIndex((item) =>
      item.organizationId === input.organizationId &&
      item.conversationId === input.conversationId &&
      item.messageId === input.messageId);
    if (index < 0) return null;
    this.records[index] = normalizeMessageContentRecord({
      ...this.records[index],
      deliveryStatus: input.deliveryStatus,
      deliveryUpdatedAt: input.occurredAt,
    });
    return this.records[index];
  }
}

class MemoryDispatchStore implements HumanReplyDispatchStore {
  records = new Map<string, HumanReplyDispatchRecord>();
  async begin(input: {
    organizationId: string;
    conversationId: string;
    requestId: string;
    bodyFingerprint: string;
    now: string;
  }): Promise<BeginHumanReplyDispatchResult> {
    const dispatchId = createHumanReplyDispatchId(input);
    const existing = this.records.get(dispatchId);
    if (existing) {
      if (existing.bodyFingerprint !== input.bodyFingerprint) {
        throw new Error('HUMAN_REPLY_IDEMPOTENCY_COLLISION');
      }
      return { kind: 'existing', record: existing };
    }
    const record: HumanReplyDispatchRecord = {
      schemaVersion: 1,
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      dispatchId,
      requestId: input.requestId,
      bodyFingerprint: input.bodyFingerprint,
      status: 'dispatching',
      createdAt: input.now,
      updatedAt: input.now,
    };
    this.records.set(dispatchId, record);
    return { kind: 'created', record };
  }
  async markSent(input: { record: HumanReplyDispatchRecord; providerMessageId: string; now: string }) {
    const next: HumanReplyDispatchRecord = {
      ...input.record,
      status: 'sent',
      providerMessageId: input.providerMessageId,
      updatedAt: input.now,
    };
    this.records.set(next.dispatchId, next);
    return next;
  }
  async markFailed(input: { record: HumanReplyDispatchRecord; errorCode: string; now: string }) {
    const next: HumanReplyDispatchRecord = {
      ...input.record,
      status: 'failed',
      errorCode: input.errorCode,
      updatedAt: input.now,
    };
    this.records.set(next.dispatchId, next);
    return next;
  }
  async markAmbiguous(input: { record: HumanReplyDispatchRecord; providerMessageId: string; errorCode: string; now: string }) {
    const next: HumanReplyDispatchRecord = {
      ...input.record,
      status: 'ambiguous_after_provider_accept',
      providerMessageId: input.providerMessageId,
      errorCode: input.errorCode,
      updatedAt: input.now,
    };
    this.records.set(next.dispatchId, next);
    return next;
  }
}

class FakeProvider implements WhatsAppProvider {
  calls = 0;
  fail = false;
  async sendText(input: { phoneNumberId: string; recipientPhone: string; text: string }) {
    this.calls++;
    equal(input.phoneNumberId, 'phone-1', 'provider uses mapped business phone id');
    equal(input.recipientPhone, '5543999999999', 'provider uses recipient only from sensitive inbound content');
    if (this.fail) throw new Error('WHATSAPP_PROVIDER_REJECTED:131047');
    return { providerMessageId: 'wamid.out.1' };
  }
}

console.log('--- Running Human Reply Service Tests ---');

const threadStore = new InMemoryConnectThreadStore();
const threadService = new ConnectThreadCommandService(
  threadStore,
  () => new Date('2026-09-20T03:30:00.000Z'),
);
await threadService.open({
  requestId: 'open',
  organizationId: 'org-1',
  conversationId: 'conversation-1',
  evidenceRef: 'connect-message:whatsapp:inbound',
  channel: 'whatsapp',
});
await threadService.recordPersonReply({
  requestId: 'reply',
  organizationId: 'org-1',
  conversationId: 'conversation-1',
  evidenceRef: 'connect-message:whatsapp:inbound',
  occurredAt: new Date('2026-09-20T03:30:01.000Z'),
});

const messageStore = new MemoryMessageStore();
await messageStore.put({
  schemaVersion: 1,
  organizationId: 'org-1',
  conversationId: 'conversation-1',
  messageId: createProviderMessageIndexId('whatsapp', 'wamid.in.1'),
  channel: 'whatsapp',
  direction: 'inbound',
  providerMessageId: 'wamid.in.1',
  senderRef: '5543999999999',
  recipientRef: 'phone-1',
  messageType: 'text',
  body: 'Oi',
  occurredAt: '2026-09-20T03:30:01.000Z',
  recordedAt: '2026-09-20T03:30:01.000Z',
  deliveryStatus: 'received',
  evidenceRef: 'connect-message:whatsapp:inbound',
});

const dispatchStore = new MemoryDispatchStore();
const provider = new FakeProvider();
let nowTick = Date.parse('2026-09-20T03:31:00.000Z');
const service = new HumanReplyService({
  registry: new WhatsAppConnectionRegistry([{
    organizationId: 'org-1',
    phoneNumberId: 'phone-1',
    connectionRef: 'primary',
    enabled: true,
  }]),
  messageStore,
  dispatchStore,
  threadStore,
  provider,
  now: () => new Date(nowTick += 1000),
});

{
  const sent = await service.send({
    organizationId: 'org-1',
    conversationId: 'conversation-1',
    requestId: 'operator-reply-1',
    text: 'Olá! Posso te ajudar por aqui.',
  });
  equal(sent.kind, 'sent', 'first authorized human reply sends once');
  equal(provider.calls, 1, 'provider called exactly once');
  const outbound = await messageStore.getByProviderMessageId({
    channel: 'whatsapp',
    providerMessageId: 'wamid.out.1',
  });
  equal(outbound?.direction, 'outbound', 'accepted provider reply is persisted as outbound content');
  equal(outbound?.body, 'Olá! Posso te ajudar por aqui.', 'reply body stays in sensitive content store');

  const thread = await threadStore.load({
    organizationId: 'org-1',
    conversationId: 'conversation-1',
  });
  equal(thread?.status, 'waiting_person', 'human reply moves thread to waiting person');
  equal(thread?.mode, 'human', 'human reply makes ownership explicit');
  equal(thread?.automationPaused, true, 'human reply keeps automation paused');
  const serialized = JSON.stringify(await threadStore.readEvents({
    organizationId: 'org-1',
    conversationId: 'conversation-1',
  }));
  equal(serialized.includes('5543999999999'), false, 'canonical event stream excludes recipient phone');
  equal(serialized.includes('Posso te ajudar'), false, 'canonical event stream excludes reply body');
}

{
  const duplicate = await service.send({
    organizationId: 'org-1',
    conversationId: 'conversation-1',
    requestId: 'operator-reply-1',
    text: 'Olá! Posso te ajudar por aqui.',
  });
  equal(duplicate.kind, 'duplicate', 'same request id converges to sent result');
  equal(provider.calls, 1, 'idempotent retry never dispatches twice');
}

{
  provider.fail = true;
  await rejects(
    () => service.send({
      organizationId: 'org-1',
      conversationId: 'conversation-1',
      requestId: 'operator-reply-provider-failure',
      text: 'Teste de falha',
    }),
    'WHATSAPP_PROVIDER_REJECTED:131047',
    'definitive provider rejection is surfaced',
  );
  equal(provider.calls, 2, 'provider was attempted once for the failed request');
  await rejects(
    () => service.send({
      organizationId: 'org-1',
      conversationId: 'conversation-1',
      requestId: 'operator-reply-provider-failure',
      text: 'Teste de falha',
    }),
    'HUMAN_REPLY_PREVIOUSLY_FAILED',
    'same failed request is not silently retried',
  );
  equal(provider.calls, 2, 'failed idempotency key blocks duplicate provider attempt');
}

{
  const foreignService = new HumanReplyService({
    registry: new WhatsAppConnectionRegistry([{
      organizationId: 'org-other',
      phoneNumberId: 'phone-1',
      connectionRef: 'foreign',
      enabled: true,
    }]),
    messageStore,
    dispatchStore: new MemoryDispatchStore(),
    threadStore,
    provider: new FakeProvider(),
  });
  await rejects(
    () => foreignService.send({
      organizationId: 'org-1',
      conversationId: 'conversation-1',
      requestId: 'foreign-binding',
      text: 'Não deve sair',
    }),
    'WHATSAPP_CONNECTION_NOT_MAPPED',
    'provider number bound to another tenant fails closed',
  );
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
