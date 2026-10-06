type FetchLike = typeof fetch;

export type HubChannelGrant = {
  grantRef: string;
  grantSecret: string;
  organizationId: string;
  expiresAt: number;
};

export type HubChannelSession = {
  customToken: string;
  userId: string;
  organizationId: string;
  expiresAt: number;
};

export class HubChannelGrantError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'HubChannelGrantError';
  }
}

export interface HubChannelGrantHttpClientOptions {
  hubOrigin: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

function safeOrigin(value: string): string {
  const parsed = new URL(value.trim());
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('HUB_CHANNEL_GRANT_ORIGIN_INVALID');
  }
  return parsed.origin;
}

function bearer(value: string): string {
  const clean = value.trim();
  if (!clean) return '';
  return /^Bearer\s+/i.test(clean) ? clean : `Bearer ${clean}`;
}

function safeString(value: unknown, max = 512): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function payload(response: Response): Promise<any> {
  return response.json().catch(() => ({}));
}

export class HubChannelGrantHttpClient {
  private readonly hubOrigin: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: HubChannelGrantHttpClientOptions) {
    this.hubOrigin = safeOrigin(options.hubOrigin);
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = Math.max(1_000, Math.min(options.timeoutMs ?? 8_000, 30_000));
  }

  async createGrant(input: {
    authToken: string;
    channelIdentityRef: string;
    organizationId: string;
  }): Promise<HubChannelGrant> {
    const authorization = bearer(input.authToken);
    if (!authorization) throw new HubChannelGrantError('AUTH_REQUIRED', 401);

    const response = await this.post(
      '/api/ecosystem/connect/channel-grants',
      {
        channel: 'whatsapp',
        channelIdentityRef: input.channelIdentityRef,
        organizationId: input.organizationId,
      },
      { Authorization: authorization },
    );
    const body = await payload(response);
    if (!response.ok) {
      throw new HubChannelGrantError(
        safeString(body?.code, 120) || 'CHANNEL_GRANT_CREATE_FAILED',
        response.status,
      );
    }

    const grantRef = safeString(body?.grantRef, 180);
    const grantSecret = safeString(body?.grantSecret, 512);
    const organizationId = safeString(body?.organizationId, 180);
    const expiresAt = Number(body?.expiresAt);
    if (
      body?.success !== true ||
      !grantRef ||
      !grantSecret ||
      !organizationId ||
      !Number.isFinite(expiresAt)
    ) {
      throw new HubChannelGrantError('CHANNEL_GRANT_RESPONSE_INVALID', 502);
    }

    return { grantRef, grantSecret, organizationId, expiresAt };
  }

  async exchangeGrant(input: {
    grantRef: string;
    grantSecret: string;
  }): Promise<HubChannelSession> {
    const response = await this.post(
      '/api/ecosystem/connect/channel-session',
      {
        channel: 'whatsapp',
        grantRef: input.grantRef,
        grantSecret: input.grantSecret,
      },
    );
    const body = await payload(response);
    if (!response.ok) {
      throw new HubChannelGrantError(
        safeString(body?.code, 120) || 'CHANNEL_SESSION_FAILED',
        response.status,
      );
    }

    const customToken = safeString(body?.customToken, 16_384);
    const userId = safeString(body?.userId, 256);
    const organizationId = safeString(body?.organizationId, 180);
    const expiresAt = Number(body?.expiresAt);
    if (
      body?.success !== true ||
      !customToken ||
      !userId ||
      !organizationId ||
      !Number.isFinite(expiresAt)
    ) {
      throw new HubChannelGrantError('CHANNEL_SESSION_RESPONSE_INVALID', 502);
    }
    return { customToken, userId, organizationId, expiresAt };
  }

  private async post(
    path: string,
    body: Record<string, unknown>,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(new URL(path, this.hubOrigin).toString(), {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: 'no-store',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HubChannelGrantError('CHANNEL_HUB_TIMEOUT', 504);
      }
      throw new HubChannelGrantError('CHANNEL_HUB_UNAVAILABLE', 503);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class FirebaseCustomTokenExchanger {
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: { apiKey: string; fetchImpl?: FetchLike; timeoutMs?: number }) {
    this.apiKey = options.apiKey.trim();
    if (!this.apiKey || this.apiKey.length > 256) {
      throw new Error('CONNECT_FIREBASE_API_KEY_INVALID');
    }
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = Math.max(1_000, Math.min(options.timeoutMs ?? 8_000, 30_000));
  }

  async exchange(input: { customToken: string; expectedUid: string }): Promise<string> {
    const customToken = input.customToken.trim();
    const expectedUid = input.expectedUid.trim();
    if (!customToken || !expectedUid) throw new Error('CHANNEL_CUSTOM_TOKEN_INVALID');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ token: customToken, returnSecureToken: true }),
          signal: controller.signal,
          cache: 'no-store',
        },
      );
      const body = await response.json().catch(() => ({})) as any;
      const idToken = safeString(body?.idToken, 16_384);
      const localId = safeString(body?.localId, 256);
      if (!response.ok || !idToken || (localId && localId !== expectedUid)) {
        throw new Error('CHANNEL_CUSTOM_TOKEN_EXCHANGE_FAILED');
      }
      return idToken;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('CHANNEL_CUSTOM_TOKEN_EXCHANGE_TIMEOUT');
      }
      if (error instanceof Error && error.message === 'CHANNEL_CUSTOM_TOKEN_EXCHANGE_FAILED') {
        throw error;
      }
      throw new Error('CHANNEL_CUSTOM_TOKEN_EXCHANGE_FAILED');
    } finally {
      clearTimeout(timeout);
    }
  }
}
