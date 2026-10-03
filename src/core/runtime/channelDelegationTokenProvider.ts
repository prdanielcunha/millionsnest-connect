const DEFAULT_HUB_ORIGIN = 'https://www.millionsnest.com';
const DEFAULT_CONNECT_PUBLIC_ORIGIN = 'https://connect.millionsnest.com';
const METADATA_IDENTITY_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeOrigin(value: string | undefined, fallback: string): string {
  const raw = clean(value) || fallback;
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/') {
    throw new Error('CHANNEL_DELEGATION_ORIGIN_INVALID');
  }
  return url.origin;
}

export interface ChannelDelegationTokenProvider {
  getFirebaseIdToken(input: {
    actorUid: string;
    organizationId: string;
    channelIdentityRef: string;
  }): Promise<string>;
}

export interface GoogleMetadataIdentityTokenProviderOptions {
  fetchImpl?: typeof fetch;
  metadataIdentityUrl?: string;
}

export class GoogleMetadataIdentityTokenProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly metadataIdentityUrl: string;

  constructor(options: GoogleMetadataIdentityTokenProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.metadataIdentityUrl = clean(options.metadataIdentityUrl) || METADATA_IDENTITY_URL;
  }

  async getIdentityToken(audience: string): Promise<string> {
    const target = clean(audience);
    if (!target.startsWith('https://')) throw new Error('CHANNEL_DELEGATION_AUDIENCE_INVALID');

    const url = new URL(this.metadataIdentityUrl);
    url.searchParams.set('audience', target);
    url.searchParams.set('format', 'full');

    const response = await this.fetchImpl(url.toString(), {
      method: 'GET',
      headers: { 'Metadata-Flavor': 'Google' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('CONNECT_RUNTIME_IDENTITY_TOKEN_UNAVAILABLE');

    const token = (await response.text()).trim();
    if (!token || token.split('.').length !== 3) {
      throw new Error('CONNECT_RUNTIME_IDENTITY_TOKEN_INVALID');
    }
    return token;
  }
}

export class HubDelegatedFirebaseTokenProvider implements ChannelDelegationTokenProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly hubOrigin: string;
  private readonly connectPublicOrigin: string;
  private readonly identityProvider: GoogleMetadataIdentityTokenProvider;
  private apiKeyCache: string | null = null;

  constructor(options: {
    fetchImpl?: typeof fetch;
    hubOrigin?: string;
    connectPublicOrigin?: string;
    identityProvider?: GoogleMetadataIdentityTokenProvider;
  } = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.hubOrigin = safeOrigin(options.hubOrigin, DEFAULT_HUB_ORIGIN);
    this.connectPublicOrigin = safeOrigin(options.connectPublicOrigin, DEFAULT_CONNECT_PUBLIC_ORIGIN);
    this.identityProvider = options.identityProvider ?? new GoogleMetadataIdentityTokenProvider({
      fetchImpl: this.fetchImpl,
    });
  }

  async getFirebaseIdToken(input: {
    actorUid: string;
    organizationId: string;
    channelIdentityRef: string;
  }): Promise<string> {
    const actorUid = clean(input.actorUid);
    const organizationId = clean(input.organizationId);
    const channelIdentityRef = clean(input.channelIdentityRef);
    if (!actorUid || !organizationId || !channelIdentityRef) {
      throw new Error('CHANNEL_DELEGATION_INPUT_INVALID');
    }

    const delegationUrl = `${this.hubOrigin}/api/ecosystem/connect/channel-delegation`;
    const serviceIdentityToken = await this.identityProvider.getIdentityToken(delegationUrl);

    const response = await this.fetchImpl(delegationUrl, {
      method: 'POST',
      headers: {
        'X-Connect-Service-Authorization': `Bearer ${serviceIdentityToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        uid: actorUid,
        organizationId,
        channel: 'whatsapp',
        channelIdentityRef,
      }),
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({})) as any;
    if (!response.ok) {
      const code = clean(payload?.code) || 'CHANNEL_DELEGATION_UNAVAILABLE';
      throw new Error(code);
    }

    const customToken = clean(payload?.customToken);
    if (
      payload?.success !== true ||
      clean(payload?.uid) !== actorUid ||
      clean(payload?.organizationId) !== organizationId ||
      !customToken
    ) {
      throw new Error('CHANNEL_DELEGATION_RESPONSE_INVALID');
    }

    const apiKey = await this.getFirebaseApiKey();
    const exchange = await this.fetchImpl(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({
          token: customToken,
          returnSecureToken: true,
        }),
        cache: 'no-store',
      },
    );

    const exchangeBody = await exchange.json().catch(() => ({})) as any;
    if (!exchange.ok) throw new Error('CHANNEL_DELEGATION_EXCHANGE_FAILED');

    const idToken = clean(exchangeBody?.idToken);
    const localId = clean(exchangeBody?.localId);
    if (!idToken || (localId && localId !== actorUid)) {
      throw new Error('CHANNEL_DELEGATION_IDENTITY_MISMATCH');
    }

    return idToken;
  }

  private async getFirebaseApiKey(): Promise<string> {
    if (this.apiKeyCache) return this.apiKeyCache;

    const response = await this.fetchImpl(`${this.connectPublicOrigin}/__/firebase/init.json`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-store',
      },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('FIREBASE_CONFIG_UNAVAILABLE');

    const config = await response.json().catch(() => null) as any;
    const apiKey = clean(config?.apiKey);
    if (!apiKey) throw new Error('FIREBASE_CONFIG_UNAVAILABLE');

    this.apiKeyCache = apiKey;
    return apiKey;
  }
}
