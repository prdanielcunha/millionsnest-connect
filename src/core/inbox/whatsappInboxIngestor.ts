import { createHash } from 'node:crypto';
import type {
  WhatsAppNormalizedEvent,
} from '../channels/whatsappOfficial';
import type { WhatsAppConnectionRegistry } from '../channels/whatsappConnectionRegistry';
import type { WhatsAppWebhookIngestor } from '../runtime/whatsappOfficialWebhookHttpHandler';
import {
  createConversationIdFromChannelIdentity,
  createMessageEvidenceRef,
  createProviderMessageIndexId,
  type ConnectMessageContentStore,
  type ConnectMessageDeliveryStatus,
} from './messageContentStore';
import { ConnectThreadCommandService } from './threadService';
import type { ConnectThreadStore } from './threadStore';

function providerTimestampToIso(raw: string, fallback: Date): string {
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds > 0) {
    const date = new Date(seconds * 1000);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return fallback.toISOString();
}

function requestKey(prefix: string, providerMessageId: string): string {
  const digest = createHash('sha256')
    .update(providerMessageId)
    .digest('hex')
    .slice(0, 32);
  return `${prefix}-${digest}`;
}

function deliveryStatus(raw: string): ConnectMessageDeliveryStatus | null {
  if (raw === 'sent' || raw === 'delivered' || raw === 'read' || raw === 'failed') {
    return raw;
  }
  return null;
}

/**
 * Official WhatsApp -> canonical Inbox bridge.
 *
 * This service is deliberately provider-specific at the edge and provider-
 * neutral after normalization. Organization routing comes only from the
 * server-side phone-number binding registry; no tenant value from the webhook
 * is trusted. Provider retries converge through deterministic message/event IDs.
 */
export class WhatsAppInboxIngestor implements WhatsAppWebhookIngestor {
  private readonly threadService: ConnectThreadCommandService;

  constructor(
    private readonly registry: WhatsAppConnectionRegistry,
    private readonly contentStore: ConnectMessageContentStore,
    threadStore: ConnectThreadStore,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.threadService = new ConnectThreadCommandService(threadStore, now);
  }

  async ingest(events: WhatsAppNormalizedEvent[]): Promise<void> {
    for (const event of events) {
      if (event.kind === 'message') {
        await this.ingestMessage(event);
      } else {
        await this.ingestStatus(event);
      }
    }
  }

  private async ingestMessage(
    event: Extract<WhatsAppNormalizedEvent, { kind: 'message' }>,
  ): Promise<void> {
    const binding = this.registry.resolve(event.phoneNumberId);
    if (!binding) throw new Error('WHATSAPP_CONNECTION_NOT_MAPPED');

    const conversationId = createConversationIdFromChannelIdentity({
      organizationId: binding.organizationId,
      channel: 'whatsapp',
      connectionRef: binding.connectionRef,
      channelUserId: event.from,
    });
    const messageId = createProviderMessageIndexId('whatsapp', event.providerMessageId);
    const evidenceRef = createMessageEvidenceRef('whatsapp', event.providerMessageId);
    const occurredAt = providerTimestampToIso(event.timestamp, this.now());

    await this.contentStore.put({
      schemaVersion: 1,
      organizationId: binding.organizationId,
      conversationId,
      messageId,
      channel: 'whatsapp',
      direction: 'inbound',
      providerMessageId: event.providerMessageId,
      senderRef: event.from,
      recipientRef: event.phoneNumberId,
      messageType: event.messageType,
      body: event.text,
      occurredAt,
      recordedAt: this.now().toISOString(),
      deliveryStatus: 'received',
      evidenceRef,
    });

    const scope = {
      organizationId: binding.organizationId,
      conversationId,
    };
    const current = await this.threadService.getThread(scope);

    if (!current) {
      await this.threadService.open({
        requestId: requestKey('wa-00-open', event.providerMessageId),
        organizationId: binding.organizationId,
        conversationId,
        evidenceRef,
        channel: 'whatsapp',
        occurredAt: new Date(occurredAt),
      });
    }

    await this.threadService.recordPersonReply({
      requestId: requestKey('wa-10-in', event.providerMessageId),
      organizationId: binding.organizationId,
      conversationId,
      evidenceRef,
      occurredAt: new Date(occurredAt),
    });
  }

  private async ingestStatus(
    event: Extract<WhatsAppNormalizedEvent, { kind: 'status' }>,
  ): Promise<void> {
    if (!this.registry.resolve(event.phoneNumberId)) {
      throw new Error('WHATSAPP_CONNECTION_NOT_MAPPED');
    }

    const status = deliveryStatus(event.status);
    if (!status) return;

    const existing = await this.contentStore.getByProviderMessageId({
      channel: 'whatsapp',
      providerMessageId: event.providerMessageId,
    });
    if (!existing) return;

    await this.contentStore.updateDeliveryStatus({
      organizationId: existing.organizationId,
      conversationId: existing.conversationId,
      messageId: existing.messageId,
      deliveryStatus: status,
      occurredAt: providerTimestampToIso(event.timestamp, this.now()),
    });
  }
}
