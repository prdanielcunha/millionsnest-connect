export type WhatsAppProviderSendTextInput = {
  phoneNumberId: string;
  recipientPhone: string;
  text: string;
};

export type WhatsAppProviderSendResult = {
  providerMessageId: string;
};

export interface WhatsAppProvider {
  sendText(input: WhatsAppProviderSendTextInput): Promise<WhatsAppProviderSendResult>;
}

export type MetaWhatsAppProviderOptions = {
  accessToken: string;
  graphApiVersion: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function safeId(value: string, maxLength: number): string {
  const clean = value.trim();
  if (!clean || clean.length > maxLength || !/^[a-zA-Z0-9._:-]+$/.test(clean)) {
    throw new Error('WHATSAPP_PROVIDER_ID_INVALID');
  }
  return clean;
}

function safePhone(value: string): string {
  const clean = value.replace(/\D/g, '');
  if (clean.length < 8 || clean.length > 20) {
    throw new Error('WHATSAPP_RECIPIENT_INVALID');
  }
  return clean;
}

function safeText(value: string): string {
  const clean = value.replace(/\u0000/g, '').trim();
  if (!clean || clean.length > 4096) {
    throw new Error('WHATSAPP_REPLY_TEXT_INVALID');
  }
  return clean;
}

function safeVersion(value: string): string {
  const clean = value.trim();
  if (!/^v\d{1,3}\.\d{1,3}$/.test(clean)) {
    throw new Error('WHATSAPP_GRAPH_VERSION_INVALID');
  }
  return clean;
}

/**
 * Official Meta WhatsApp Business Platform adapter.
 *
 * Policy windows, pricing and template rules are intentionally not hard-coded.
 * Activation requires an explicit server-side policy acknowledgement and Meta
 * remains the final authority for whether a message is accepted.
 */
export class MetaWhatsAppProvider implements WhatsAppProvider {
  private readonly accessToken: string;
  private readonly graphApiVersion: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: MetaWhatsAppProviderOptions) {
    this.accessToken = options.accessToken.trim();
    if (!this.accessToken) throw new Error('WHATSAPP_ACCESS_TOKEN_MISSING');
    this.graphApiVersion = safeVersion(options.graphApiVersion);
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = Math.max(1_000, Math.min(options.timeoutMs ?? 10_000, 30_000));
  }

  async sendText(input: WhatsAppProviderSendTextInput): Promise<WhatsAppProviderSendResult> {
    const phoneNumberId = safeId(input.phoneNumberId, 128);
    const recipientPhone = safePhone(input.recipientPhone);
    const text = safeText(input.text);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(
        `https://graph.facebook.com/${this.graphApiVersion}/${encodeURIComponent(phoneNumberId)}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipientPhone,
            type: 'text',
            text: {
              preview_url: false,
              body: text,
            },
          }),
          signal: controller.signal,
          cache: 'no-store',
        },
      );

      const payload = await response.json().catch(() => ({})) as {
        messages?: Array<{ id?: unknown }>;
        error?: { code?: unknown; type?: unknown };
      };

      if (!response.ok) {
        const providerCode =
          typeof payload.error?.code === 'number' || typeof payload.error?.code === 'string'
            ? String(payload.error.code).slice(0, 40)
            : String(response.status);
        throw new Error(`WHATSAPP_PROVIDER_REJECTED:${providerCode}`);
      }

      const providerMessageId = payload.messages?.[0]?.id;
      if (typeof providerMessageId !== 'string' || !providerMessageId.trim()) {
        throw new Error('WHATSAPP_PROVIDER_RESPONSE_INVALID');
      }

      return { providerMessageId: providerMessageId.trim().slice(0, 300) };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('WHATSAPP_PROVIDER_TIMEOUT');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createMetaWhatsAppProviderFromEnv(
  env: NodeJS.ProcessEnv,
  fetchImpl?: typeof fetch,
): MetaWhatsAppProvider {
  return new MetaWhatsAppProvider({
    accessToken: env.CONNECT_WHATSAPP_ACCESS_TOKEN || '',
    graphApiVersion: env.CONNECT_WHATSAPP_GRAPH_API_VERSION || '',
    fetchImpl,
  });
}

export function isWhatsAppHumanReplyConfigured(env: NodeJS.ProcessEnv): boolean {
  return (
    env.CONNECT_INBOX_HUMAN_REPLY_ENABLED?.trim().toLowerCase() === 'true' &&
    env.CONNECT_WHATSAPP_PROVIDER_DISPATCH_ENABLED?.trim().toLowerCase() === 'true' &&
    env.CONNECT_WHATSAPP_REPLY_POLICY_ACK?.trim() === 'CONNECT_WHATSAPP_REPLY_POLICY_READY' &&
    Boolean(env.CONNECT_WHATSAPP_ACCESS_TOKEN?.trim()) &&
    /^v\d{1,3}\.\d{1,3}$/.test(env.CONNECT_WHATSAPP_GRAPH_API_VERSION?.trim() || '')
  );
}
