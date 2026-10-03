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

export type WhatsAppSystemReplyResult = {
  kind: 'sent' | 'duplicate';
  providerMessageId: string;
  messageId: string;
};

function safe(value: string, maxLength: number): string {
  const clean = value.trim();
  if (!clean || clean.length > maxLength || clean.includes('/') || clean.includes('\\')) {
    throw new Error('WHATSAPP_SYSTEM_REPLY_FIELD_INVALID');
  }
  return clean;
}

function safePhone(value: string): string {
  const clean = value.replace(/\D/g, '');
  if (clean.length < 8 || clean.length > 20) throw new Error('WHATSAPP_RECIPIENT_INVALID');
  return clean;
}

function safeText(value: string): string {
  const clean = value.replace(/\u0000/g, '').trim();
  if (!clean || clean.length > 4096) throw new Error('WHATSAPP_REPLY_TEXT_INVALID');
  return clean;
}

function errorCode(error: unknown): string {
  if (!(error instanceof Error) || !error.message) return 'UNKNOWN_PROVIDER_ERROR';
  return error.message.replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 180);
}

/**
 * Durable outbound path used by Connect Assist/system responses.
 *
 * It deliberately reuses the existing fail-closed dispatch ledger so webhook
 * retries cannot cause duplicate external messages. It does not emit a human
 * Inbox event because the sender is Connect Assist, not an operator.
 */
export class WhatsAppSystemReplyService {
  private readonly now: () => Date;

  constructor(private readonly options: {
    registry: WhatsAppConnectionRegistry;
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
    businessPhoneNumberId: string;
    recipientPhone: string;
    requestId: string;
    text: string;
  }): Promise<WhatsAppSystemReplyResult> {
    const organizationId = safe(input.organizationId, 180);
    const conversationId = safe(input.conversationId, 180);
    const businessPhoneNumberId = safe(input.businessPhoneNumberId, 180);
    const requestId = safe(input.requestId, 180);
    const recipientPhone = safePhone(input.recipientPhone);
    const text = safeText(input.text);

    const binding = this.options.registry.resolve(businessPhoneNumberId);
    if (!binding || binding.organizationId !== organizationId) {
      throw new Error('WHATSAPP_CONNECTION_NOT_MAPPED');
    }

    const begun = await this.options.dispatchStore.begin({
      organizationId,
      conversationId,
      requestId,
      bodyFingerprint: fingerprintReplyBody(text),
      now: this.now().toISOString(),
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
        throw new Error('WHATSAPP_SYSTEM_REPLY_REQUIRES_REVIEW');
      }
      if (existing.status === 'dispatching') {
        throw new Error('WHATSAPP_SYSTEM_REPLY_IN_PROGRESS');
      }
      throw new Error('WHATSAPP_SYSTEM_REPLY_PREVIOUSLY_FAILED');
    }

    const dispatchRecord = begun.record;
    let providerMessageId = '';
    try {
      const providerResult = await this.options.provider.sendText({
        phoneNumberId: businessPhoneNumberId,
        recipientPhone,
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
        organizationId,
        conversationId,
        messageId,
        channel: 'whatsapp',
        direction: 'outbound',
        providerMessageId,
        senderRef: businessPhoneNumberId,
        recipientRef: recipientPhone,
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
      await this.safeMarkAmbiguous(dispatchRecord, providerMessageId, errorCode(error));
      throw new Error('WHATSAPP_SYSTEM_REPLY_ACCEPTED_PERSISTENCE_INCOMPLETE');
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
      // The provider did not confirm acceptance; keep the original error.
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
      // The caller still receives an explicit ambiguous-after-provider error.
    }
  }
}
