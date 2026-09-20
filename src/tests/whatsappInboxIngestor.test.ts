import {
  WhatsAppConnectionRegistry,
  parseWhatsAppConnectionBindings,
} from '../core/channels/whatsappConnectionRegistry';
import { WhatsAppInboxIngestor } from '../core/inbox/whatsappInboxIngestor';
import {
  normalizeMessageContentRecord,
  createProviderMessageIndexId,
  type ConnectMessageContentRecord,
  type ConnectMessageContentStore,
  type ConnectMessageContentWriteResult,
  type ConnectMessageDeliveryStatus,
} from '../core/inbox/messageContentStore';
import { InMemoryConnectThreadStore } from '../core/inbox/threadStore';

let total = 0;
let passed = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  passed++;
}
async function rejects(fn: () => Promise<unknown>, expected: string, message: string) {
  total++;
  try {
    await fn();
    throw new Error(`${message}: expected rejection ${expected}`);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== expected) {
      throw new Error(`${message}: expected ${expected}, got ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  passed++;
}

class MemoryMessageContentStore implements ConnectMessageContentStore {
  private readonly records = new Map<string, ConnectMessageContentRecord>();
  private readonly providerIndex = new Map<string, string>();

  async put(input: ConnectMessageContentRecord): Promise<ConnectMessageContentWriteResult> {
    const record = normalizeMessageContentRecord(input);
    const key = `${record.organizationId}/${record.conversationId}/${record.messageId}`;
    const providerKey = createProviderMessageIndexId(record.channel, record.providerMessageId);
    const existingKey = this.providerIndex.get(providerKey);
    if (existingKey) {
      const existing = this.records.get(existingKey)!;
      if (JSON.stringify(existing) !== JSON.stringify(record)) {
        throw new Error('PROVIDER_MESSAGE_ID_COLLISION');
      }
      return { kind: 'duplicate', record: existing };
    }
    this.records.set(key, record);
    this.providerIndex.set(providerKey, key);
    return { kind: 'created', record };
  }

  async get(input: { organizationId: string; conversationId: string; messageId: string }) {
    return this.records.get(`${input.organizationId}/${input.conversationId}/${input.messageId}`) ?? null;
  }

  async getByProviderMessageId(input: { channel: string; providerMessageId: string }) {
    const key = this.providerIndex.get(createProviderMessageIndexId(input.channel, input.providerMessageId));
    return key ? this.records.get(key) ?? null : null;
  }

  async listConversation(input: { organizationId: string; conversationId: string; limit?: number }) {
    return [...this.records.values()]
      .filter((record) =>
        record.organizationId === input.organizationId &&
        record.conversationId === input.conversationId)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
      .slice(-(input.limit ?? 100));
  }

  async updateDeliveryStatus(input: {
    organizationId: string;
    conversationId: string;
    messageId: string;
    deliveryStatus: ConnectMessageDeliveryStatus;
    occurredAt: string;
  }) {
    const key = `${input.organizationId}/${input.conversationId}/${input.messageId}`;
    const current = this.records.get(key);
    if (!current) return null;
    const next = normalizeMessageContentRecord({
      ...current,
      deliveryStatus: input.deliveryStatus,
      deliveryUpdatedAt: input.occurredAt,
      recordedAt: input.occurredAt,
    });
    this.records.set(key, next);
    return next;
  }
}

console.log('--- Running WhatsApp Inbox Ingestor Tests ---');

{
  const bindings = parseWhatsAppConnectionBindings({
    CONNECT_WHATSAPP_CONNECTIONS_JSON: JSON.stringify([
      {
        organizationId: 'org-1',
        phoneNumberId: 'phone-1',
        connectionRef: 'primary',
        enabled: true,
      },
    ]),
  });
  equal(bindings.length, 1, 'valid WhatsApp connection binding is parsed');
  equal(bindings[0].organizationId, 'org-1', 'binding stays tenant pinned');
}

{
  let code = '';
  try {
    parseWhatsAppConnectionBindings({
      CONNECT_WHATSAPP_CONNECTIONS_JSON: JSON.stringify([
        { organizationId: 'org-1', phoneNumberId: 'phone-1', connectionRef: 'a' },
        { organizationId: 'org-2', phoneNumberId: 'phone-1', connectionRef: 'b' },
      ]),
    });
  } catch (error) {
    code = error instanceof Error ? error.message : '';
  }
  equal(code, 'WHATSAPP_PHONE_NUMBER_ID_DUPLICATE', 'one provider number cannot ambiguously map to two tenants');
}

{
  const registry = new WhatsAppConnectionRegistry([
    {
      organizationId: 'org-1',
      phoneNumberId: 'phone-1',
      connectionRef: 'primary',
      enabled: true,
    },
  ]);
  const messageStore = new MemoryMessageContentStore();
  const threadStore = new InMemoryConnectThreadStore();
  const ingestor = new WhatsAppInboxIngestor(
    registry,
    messageStore,
    threadStore,
    () => new Date('2026-09-20T03:00:00Z'),
  );

  const event = {
    kind: 'message' as const,
    providerMessageId: 'wamid.test.1',
    from: '5543999999999',
    phoneNumberId: 'phone-1',
    timestamp: '1789873200',
    messageType: 'text',
    text: 'Qual é minha próxima escala?',
  };

  await ingestor.ingest([event]);

  const stored = await messageStore.getByProviderMessageId({
    channel: 'whatsapp',
    providerMessageId: event.providerMessageId,
  });
  equal(stored?.organizationId, 'org-1', 'message is stored only in the mapped organization');
  equal(stored?.body, 'Qual é minha próxima escala?', 'message body stays in sensitive content store');

  const projection = await threadStore.load({
    organizationId: 'org-1',
    conversationId: stored!.conversationId,
  });
  equal(projection?.status, 'in_progress', 'person reply opens and advances canonical Inbox thread');
  equal(projection?.mode, 'approval', 'inbound person reply pauses automatic mode');
  equal(projection?.automationPaused, true, 'inbound reply pauses automation');
  equal(projection?.sourceEventCount, 2, 'first inbound message creates open + reply events');
  equal(JSON.stringify(projection).includes('5543999999999'), false, 'thread metadata does not contain phone PII');
  equal(JSON.stringify(projection).includes('próxima escala'), false, 'thread metadata does not contain message body');

  await ingestor.ingest([event]);
  const duplicateProjection = await threadStore.load({
    organizationId: 'org-1',
    conversationId: stored!.conversationId,
  });
  equal(duplicateProjection?.sourceEventCount, 2, 'provider retry is idempotent across thread events');

  await ingestor.ingest([{
    kind: 'status',
    providerMessageId: event.providerMessageId,
    phoneNumberId: 'phone-1',
    timestamp: '1789873260',
    status: 'read',
    recipientId: '5543999999999',
  }]);
  const updated = await messageStore.getByProviderMessageId({
    channel: 'whatsapp',
    providerMessageId: event.providerMessageId,
  });
  equal(updated?.deliveryStatus, 'read', 'provider delivery status updates sensitive message record');
  equal(updated?.occurredAt, stored?.occurredAt, 'delivery update preserves original message occurrence time');

  await rejects(
    () => ingestor.ingest([{
      kind: 'message',
      providerMessageId: 'wamid.unmapped',
      from: '5511999999999',
      phoneNumberId: 'unknown-phone',
      timestamp: '1789873200',
      messageType: 'text',
      text: 'Oi',
    }]),
    'WHATSAPP_CONNECTION_NOT_MAPPED',
    'unmapped provider number fails closed instead of guessing tenant',
  );
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
