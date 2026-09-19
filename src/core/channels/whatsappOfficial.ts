import { createHmac, timingSafeEqual } from 'node:crypto';

export type WhatsAppInboundMessage = {
  kind: 'message';
  providerMessageId: string;
  from: string;
  phoneNumberId: string;
  timestamp: string;
  messageType: string;
  text?: string;
};

export type WhatsAppInboundStatus = {
  kind: 'status';
  providerMessageId: string;
  phoneNumberId: string;
  timestamp: string;
  status: string;
  recipientId?: string;
};

export type WhatsAppNormalizedEvent = WhatsAppInboundMessage | WhatsAppInboundStatus;

function clean(value: unknown, max = 1024): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function verifyWhatsAppWebhookChallenge(
  query: Record<string, unknown>,
  verifyToken: string,
): { ok: true; challenge: string } | { ok: false } {
  const mode = clean(query['hub.mode'], 64);
  const token = clean(query['hub.verify_token'], 512);
  const challenge = clean(query['hub.challenge'], 4096);

  if (
    mode !== 'subscribe' ||
    !verifyToken ||
    token !== verifyToken ||
    !challenge
  ) {
    return { ok: false };
  }

  return { ok: true, challenge };
}

export function verifyWhatsAppSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  const signature = clean(signatureHeader, 256);
  if (!appSecret || !signature.startsWith('sha256=')) return false;

  const suppliedHex = signature.slice('sha256='.length);
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) return false;

  const expectedHex = createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const supplied = Buffer.from(suppliedHex, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

/**
 * Normalizes only the provider envelope. This function does not persist,
 * authorize, classify or log message bodies. Domain routing remains in Core.
 */
export function normalizeWhatsAppWebhookEnvelope(payload: unknown): WhatsAppNormalizedEvent[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const root = payload as Record<string, unknown>;
  if (root.object !== 'whatsapp_business_account') return [];

  const events: WhatsAppNormalizedEvent[] = [];
  const entries = Array.isArray(root.entry) ? root.entry : [];

  for (const rawEntry of entries) {
    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) continue;
    const changes = Array.isArray((rawEntry as any).changes) ? (rawEntry as any).changes : [];

    for (const rawChange of changes) {
      const value = rawChange && typeof rawChange === 'object' ? (rawChange as any).value : null;
      if (!value || typeof value !== 'object') continue;

      const phoneNumberId = clean(value?.metadata?.phone_number_id, 128);

      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const rawMessage of messages) {
        if (!rawMessage || typeof rawMessage !== 'object') continue;
        const message = rawMessage as any;
        const providerMessageId = clean(message.id, 256);
        const from = clean(message.from, 64);
        const timestamp = clean(message.timestamp, 64);
        const messageType = clean(message.type, 64);
        if (!providerMessageId || !from || !phoneNumberId) continue;

        const text = messageType === 'text' ? clean(message?.text?.body, 4096) : '';
        events.push({
          kind: 'message',
          providerMessageId,
          from,
          phoneNumberId,
          timestamp,
          messageType,
          ...(text ? { text } : {}),
        });
      }

      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const rawStatus of statuses) {
        if (!rawStatus || typeof rawStatus !== 'object') continue;
        const status = rawStatus as any;
        const providerMessageId = clean(status.id, 256);
        const timestamp = clean(status.timestamp, 64);
        const statusName = clean(status.status, 64);
        if (!providerMessageId || !phoneNumberId || !statusName) continue;

        const recipientId = clean(status.recipient_id, 64);
        events.push({
          kind: 'status',
          providerMessageId,
          phoneNumberId,
          timestamp,
          status: statusName,
          ...(recipientId ? { recipientId } : {}),
        });
      }
    }
  }

  return events;
}
