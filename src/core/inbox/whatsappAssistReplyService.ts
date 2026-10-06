import type { WhatsAppProvider } from '../channels/metaWhatsAppProvider';
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

export type WhatsAppAssistReplyResult = {
  kind: 'sent' | 'duplicate';
  providerMessageId: string;
  messageId: string;
};

function safeRequestId(value: string): string {
  const clean = value.trim();
  if (!clean || clean.length > 180 || clean.includes('/') || clean.includes('\\')) {
    throw new Error('ASSIST_REPLY_REQUEST_ID_INVALID');
  }
  return clean;
}

function safeText(value: string): string {
  const clean = value.replace(/\u0000/g, '').trim();
  if (!clean || clean.length > 4096) throw new Error('WHATSAPP_REPLY_TEXT_INVALID');
  return clean;
}

function safeErrorCode(error: unknown): string {
  if (!(error instanceof Error) || !error.message) return 'UNKNOWN_PROVIDER_ERROR';
  return error.message.replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 180);
}

/**
 * Official WhatsApp outbound used by Connect Assist.
 *
 * The durable dispatch reservation is written before provider I/O. If Meta
 * accepts but local persistence fails, automatic retry is blocked to avoid
 * duplicate external responses.
 */
export class WhatsAppAssistReplyService {
  private readonly now: () => Date;

  constructor(private readonly options: {
    messageStore: ConnectMessageContentStore;
    dispatchStore: HumanReplyDispatchStore;
    provider: WhatsAppProvider;
    now?: () => Date;
  }) {
    this.now = options.now ?? (() => new Date());
  }

  async send(input: {
    organizationId: string;
    conversationId: string;
    requestId: string;
    phoneNumberId: string;
    recipientPhone: string;
    text: string;
  }): Promise<WhatsAppAssistReplyResult> {
    const text = safeText(input.text);
    const requestId = safeRequestId(input.requestId);
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
          providerMessageId: existing.providerMessageId,
          messageId: createProviderMessageIndexId('whatsapp', existing.providerMessageId),
        };
      }
      if (existing.status === 'ambiguous_after_provider_accept') {
        throw new Error('ASSIST_REPLY_REQUIRES_REVIEW');
      }
      if (existing.status === 'dispatching') {
        throw new Error('ASSIST_REPLY_DISPATCH_IN_PROGRESS');
      }
      throw new Error('ASSIST_REPLY_PREVIOUSLY_FAILED');
    }

    const dispatchRecord = begun.record;
    let providerMessageId = '';
    try {
      const result = await this.options.provider.sendText({
        phoneNumberId: input.phoneNumberId,
        recipientPhone: input.recipientPhone,
        text,
      });
      providerMessageId = result.providerMessageId;
    } catch (error) {
      await this.safeMarkFailed(dispatchRecord, safeErrorCode(error));
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
        senderRef: input.phoneNumberId,
        recipientRef: input.recipientPhone,
        messageType: 'text',
        body: text,
        occurredAt: sentAt,
        recordedAt: sentAt,
        deliveryStatus: 'sent',
        deliveryUpdatedAt: sentAt,
        evidenceRef,
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
        safeErrorCode(error),
      );
      throw new Error('ASSIST_REPLY_ACCEPTED_PERSISTENCE_INCOMPLETE');
    }

    return { kind: 'sent', providerMessageId, messageId };
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
      // Caller still receives the explicit ambiguous-after-provider signal.
    }
  }
}
