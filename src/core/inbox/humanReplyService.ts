import { createHash } from 'node:crypto';
import type { WhatsAppProvider } from '../channels/metaWhatsAppProvider';
import type { WhatsAppConnectionRegistry } from '../channels/whatsappConnectionRegistry';
import {
  createMessageEvidenceRef,
  createProviderMessageIndexId,
  type ConnectMessageContentStore,
} from './messageContentStore';
import {
  fingerprintReplyBody,
  type HumanReplyDispatchRecord,
  type HumanReplyDispatchStore,
} from './humanReplyDispatchStore';
import { ConnectThreadCommandService } from './threadService';
import type { ConnectThreadStore } from './threadStore';

export type HumanReplyResult = {
  kind: 'sent' | 'duplicate';
  conversationId: string;
  messageId: string;
  providerMessageId: string;
  deliveryStatus: 'sent';
};

export interface HumanReplyServiceOptions {
  registry: WhatsAppConnectionRegistry;
  messageStore: ConnectMessageContentStore;
  dispatchStore: HumanReplyDispatchStore;
  threadStore: ConnectThreadStore;
  provider: WhatsAppProvider;
  now?: () => Date;
}

function safeRequestId(value: string): string {
  const clean = value.trim();
  if (!clean || clean.length > 180 || clean.includes('/') || clean.includes('\\')) {
    throw new Error('HUMAN_REPLY_REQUEST_ID_INVALID');
  }
  return clean;
}

function safeText(value: string): string {
  const clean = value.replace(/\u0000/g, '').trim();
  if (!clean || clean.length > 4096) throw new Error('WHATSAPP_REPLY_TEXT_INVALID');
  return clean;
}

function eventRequestId(requestId: string): string {
  const digest = createHash('sha256').update(requestId).digest('hex').slice(0, 32);
  return `human-reply-${digest}`;
}

function errorCode(error: unknown): string {
  if (!(error instanceof Error) || !error.message) return 'UNKNOWN_PROVIDER_ERROR';
  return error.message.replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 180);
}

/**
 * Human Inbox reply orchestration.
 *
 * A durable dispatch record is written before provider I/O. If Meta accepts a
 * message but local persistence cannot complete, the dispatch becomes
 * ambiguous_after_provider_accept and automatic retry is refused. This favors
 * no duplicate external messages over optimistic retry.
 */
export class HumanReplyService {
  private readonly now: () => Date;
  private readonly threadService: ConnectThreadCommandService;

  constructor(private readonly options: HumanReplyServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.threadService = new ConnectThreadCommandService(options.threadStore, this.now);
  }

  async send(input: {
    organizationId: string;
    conversationId: string;
    requestId: string;
    text: string;
  }): Promise<HumanReplyResult> {
    const text = safeText(input.text);
    const requestId = safeRequestId(input.requestId);
    const thread = await this.threadService.getThread({
      organizationId: input.organizationId,
      conversationId: input.conversationId,
    });
    if (!thread) throw new Error('THREAD_NOT_FOUND');
    if (thread.status === 'resolved' || thread.status === 'archived') {
      throw new Error('THREAD_MUST_REOPEN');
    }

    const messages = await this.options.messageStore.listConversation({
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      limit: 200,
    });
    const latestInbound = [...messages]
      .reverse()
      .find((message) =>
        message.channel === 'whatsapp' &&
        message.direction === 'inbound' &&
        Boolean(message.senderRef) &&
        Boolean(message.recipientRef));

    if (!latestInbound?.recipientRef) {
      throw new Error('WHATSAPP_RECIPIENT_CONTEXT_MISSING');
    }

    const binding = this.options.registry.resolve(latestInbound.recipientRef);
    if (!binding || binding.organizationId !== input.organizationId) {
      throw new Error('WHATSAPP_CONNECTION_NOT_MAPPED');
    }

    const now = this.now().toISOString();
    const begun = await this.options.dispatchStore.begin({
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      requestId,
      bodyFingerprint: fingerprintReplyBody(text),
      now,
    });

    if (begun.kind === 'existing') {
      const existing = begun.record;
      if (existing.status === 'sent' && existing.providerMessageId) {
        return {
          kind: 'duplicate',
          conversationId: input.conversationId,
          messageId: createProviderMessageIndexId('whatsapp', existing.providerMessageId),
          providerMessageId: existing.providerMessageId,
          deliveryStatus: 'sent',
        };
      }
      if (existing.status === 'ambiguous_after_provider_accept') {
        throw new Error('HUMAN_REPLY_REQUIRES_REVIEW');
      }
      if (existing.status === 'dispatching') {
        throw new Error('HUMAN_REPLY_DISPATCH_IN_PROGRESS');
      }
      throw new Error('HUMAN_REPLY_PREVIOUSLY_FAILED');
    }

    const dispatchRecord = begun.record;
    let providerMessageId = '';

    try {
      const providerResult = await this.options.provider.sendText({
        phoneNumberId: latestInbound.recipientRef,
        recipientPhone: latestInbound.senderRef,
        text,
      });
      providerMessageId = providerResult.providerMessageId;
    } catch (error) {
      await this.safeMarkFailed(dispatchRecord, errorCode(error));
      throw error;
    }

    const messageId = createProviderMessageIndexId('whatsapp', providerMessageId);
    const evidenceRef = createMessageEvidenceRef('whatsapp', providerMessageId);
    const sentAt = this.now().toISOString();

    try {
      await this.options.messageStore.put({
        schemaVersion: 1,
        organizationId: input.organizationId,
        conversationId: input.conversationId,
        messageId,
        channel: 'whatsapp',
        direction: 'outbound',
        providerMessageId,
        senderRef: latestInbound.recipientRef,
        recipientRef: latestInbound.senderRef,
        messageType: 'text',
        body: text,
        occurredAt: sentAt,
        recordedAt: sentAt,
        deliveryStatus: 'sent',
        deliveryUpdatedAt: sentAt,
        evidenceRef,
      });

      await this.threadService.recordHumanReplySent({
        requestId: eventRequestId(requestId),
        organizationId: input.organizationId,
        conversationId: input.conversationId,
        evidenceRef,
        occurredAt: new Date(sentAt),
      });

      await this.options.dispatchStore.markSent({
        record: dispatchRecord,
        providerMessageId,
        now: this.now().toISOString(),
      });
    } catch (error) {
      await this.safeMarkAmbiguous(
        dispatchRecord,
        providerMessageId,
        errorCode(error),
      );
      throw new Error('HUMAN_REPLY_ACCEPTED_PERSISTENCE_INCOMPLETE');
    }

    return {
      kind: 'sent',
      conversationId: input.conversationId,
      messageId,
      providerMessageId,
      deliveryStatus: 'sent',
    };
  }

  private async safeMarkFailed(record: HumanReplyDispatchRecord, code: string) {
    try {
      await this.options.dispatchStore.markFailed({
        record,
        errorCode: code,
        now: this.now().toISOString(),
      });
    } catch {
      // Provider did not confirm acceptance. The original provider error wins.
    }
  }

  private async safeMarkAmbiguous(
    record: HumanReplyDispatchRecord,
    providerMessageId: string,
    code: string,
  ) {
    try {
      await this.options.dispatchStore.markAmbiguous({
        record,
        providerMessageId,
        errorCode: code,
        now: this.now().toISOString(),
      });
    } catch {
      // The caller still receives the explicit ambiguous-after-provider error.
    }
  }
}
