import { EffectiveEcosystemContext, LanguageCode } from '../../types';

export type ConnectHandoffPayload = {
  appId: 'connect';
  protocolVersion: string;
  orgId: string;
  userId: string;
  customToken: string;
  expiresAt: number;
  supportMode: boolean;
};

export type LiveCoreResponse = {
  status: 'success' | 'failed' | 'needs_identity' | 'needs_organization' | 'denied';
  code?: string;
  humanSummary: string;
  auditId?: string;
  data?: unknown;
  deepLink?: string;
};

export type LiveConnectSession = {
  idToken: string;
  expectedOrganizationId: string;
  context: EffectiveEcosystemContext;
  sendMessage(text: string, conversationId: string, locale: LanguageCode): Promise<LiveCoreResponse>;
};

type BootstrapDependencies = {
  locationHref: string;
  replaceUrl(url: string): void;
  fetchFn: typeof fetch;
  now(): number;
  configuredApiKey?: string;
};

function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readViteEnv(name: keyof ImportMetaEnv): string | undefined {
  const env = (import.meta as ImportMeta & { env?: ImportMetaEnv }).env;
  const value = env?.[name];
  return typeof value === 'string' ? value : undefined;
}

function decodeHandoff(encoded: string, now: number): ConnectHandoffPayload {
  if (!encoded || encoded.length > 32_768) throw new Error('HANDOFF_INVALID');

  let payload: any;
  try {
    payload = JSON.parse(atob(encoded));
  } catch {
    throw new Error('HANDOFF_INVALID');
  }

  const expiresAtMs = Number(payload?.expiresAt) > 1e11
    ? Number(payload.expiresAt)
    : Number(payload?.expiresAt) * 1000;

  if (
    payload?.appId !== 'connect' ||
    typeof payload?.protocolVersion !== 'string' ||
    !payload.protocolVersion.startsWith('1.') ||
    !safeString(payload?.orgId) ||
    !safeString(payload?.userId) ||
    !safeString(payload?.customToken) ||
    safeString(payload.customToken).length > 16_384 ||
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs < now - 60_000 ||
    typeof payload?.supportMode !== 'boolean'
  ) {
    throw new Error(expiresAtMs < now - 60_000 ? 'HANDOFF_EXPIRED' : 'HANDOFF_INVALID');
  }

  return {
    appId: 'connect',
    protocolVersion: payload.protocolVersion,
    orgId: safeString(payload.orgId),
    userId: safeString(payload.userId),
    customToken: safeString(payload.customToken),
    expiresAt: expiresAtMs,
    supportMode: payload.supportMode,
  };
}

async function resolveFirebaseApiKey(deps: BootstrapDependencies): Promise<string> {
  const configured = safeString(deps.configuredApiKey);
  if (configured) return configured;

  const response = await deps.fetchFn('/__/firebase/init.json', {
    method: 'GET',
    headers: { Accept: 'application/json', 'Cache-Control': 'no-store' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('FIREBASE_CONFIG_UNAVAILABLE');

  const config = await response.json().catch(() => null) as any;
  const apiKey = safeString(config?.apiKey);
  if (!apiKey) throw new Error('FIREBASE_CONFIG_UNAVAILABLE');
  return apiKey;
}

async function exchangeCustomToken(
  payload: ConnectHandoffPayload,
  apiKey: string,
  fetchFn: typeof fetch,
): Promise<string> {
  const response = await fetchFn(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token: payload.customToken, returnSecureToken: true }),
    },
  );
  const body = await response.json().catch(() => ({})) as any;
  if (!response.ok) throw new Error('HANDOFF_EXCHANGE_FAILED');

  const idToken = safeString(body?.idToken);
  const localId = safeString(body?.localId);
  if (!idToken || (localId && localId !== payload.userId)) {
    throw new Error('HANDOFF_IDENTITY_MISMATCH');
  }
  return idToken;
}

function mapCanonicalSessionToContext(session: any, expectedOrgId: string, expectedUid: string): EffectiveEcosystemContext {
  if (
    session?.success !== true ||
    safeString(session?.user?.uid) !== expectedUid ||
    safeString(session?.activeOrganizationId) !== expectedOrgId ||
    safeString(session?.activeOrganization?.id) !== expectedOrgId
  ) {
    throw new Error('CANONICAL_CONTEXT_MISMATCH');
  }

  const active = session.activeOrganization;
  const userSystemRole = safeString(session.user?.systemRole);
  const allowedSystemRoles = new Set(['ceo', 'global_admin', 'ecosystem_owner', 'founder', 'support']);
  const capabilities = Array.isArray(session.user?.capabilities)
    ? session.user.capabilities.filter((value: unknown): value is string => typeof value === 'string')
    : [];

  const organization = {
    id: expectedOrgId,
    name: safeString(active.name) || expectedOrgId,
    slug: safeString(active.slug) || expectedOrgId,
    plan: 'ecosystem',
    isDemo: false,
  };

  return {
    mode: 'LIVE_CORE',
    user: {
      uid: expectedUid,
      name: safeString(session.user?.displayName) || 'Usuário MillionsNest',
      avatarUrl: safeString(session.user?.photoUrl) || undefined,
      systemRole: allowedSystemRoles.has(userSystemRole) ? userSystemRole as any : null,
      capabilities,
    },
    activeOrganization: organization,
    // Organization switching remains owned by Hub in this first live slice.
    availableOrganizations: [organization],
    memberships: [{
      id: `${expectedOrgId}:${expectedUid}`,
      uid: expectedUid,
      organizationId: expectedOrgId,
      organizationName: organization.name,
      organizationRole: safeString(active.organizationRole) || null,
      status: 'active',
      permissions: Array.isArray(active.permissions)
        ? active.permissions.filter((value: unknown): value is string => typeof value === 'string')
        : [],
    }],
    appAccess: [{
      appId: 'musicscale',
      access: session.appAccess?.musicscale?.accessible === true,
      capabilities: [],
    }],
  };
}

const SAFE_CANONICAL_SESSION_ERROR_CODES = new Set([
  'AUTH_REQUIRED',
  'ORGANIZATION_REQUIRED',
  'ORGANIZATION_CONTEXT_MISMATCH',
  'ORGANIZATION_ACCESS_DENIED',
  'CANONICAL_CONTEXT_UNAVAILABLE',
]);

export async function bootstrapLiveConnectSession(
  injected?: Partial<BootstrapDependencies>,
): Promise<LiveConnectSession> {
  const deps: BootstrapDependencies = {
    locationHref: injected?.locationHref ?? window.location.href,
    replaceUrl: injected?.replaceUrl ?? ((url) => window.history.replaceState({}, '', url)),
    fetchFn: injected?.fetchFn ?? globalThis.fetch.bind(globalThis),
    now: injected?.now ?? Date.now,
    configuredApiKey: injected?.configuredApiKey ?? readViteEnv('VITE_FIREBASE_API_KEY'),
  };

  const url = new URL(deps.locationHref);
  const encoded = url.searchParams.get('ecosystem_ctx');
  if (!encoded) throw new Error('HANDOFF_REQUIRED');

  // Remove credential-bearing handoff from browser history before any network I/O.
  url.searchParams.delete('ecosystem_ctx');
  deps.replaceUrl(url.toString());

  const handoff = decodeHandoff(encoded, deps.now());
  const apiKey = await resolveFirebaseApiKey(deps);
  const idToken = await exchangeCustomToken(handoff, apiKey, deps.fetchFn);

  const sessionResponse = await deps.fetchFn(
    `/api/core/session?organizationId=${encodeURIComponent(handoff.orgId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: 'application/json',
        'Cache-Control': 'no-store',
      },
      cache: 'no-store',
    },
  );
  const sessionPayload = await sessionResponse.json().catch(() => ({})) as any;
  if (!sessionResponse.ok) {
    const upstreamCode = safeString(sessionPayload?.code);
    throw new Error(
      SAFE_CANONICAL_SESSION_ERROR_CODES.has(upstreamCode)
        ? upstreamCode
        : 'CANONICAL_CONTEXT_UNAVAILABLE',
    );
  }

  const context = mapCanonicalSessionToContext(sessionPayload, handoff.orgId, handoff.userId);

  return {
    idToken,
    expectedOrganizationId: handoff.orgId,
    context,
    async sendMessage(text, conversationId, locale) {
      const response = await deps.fetchFn('/api/core/message', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({
          text,
          requestedOrganizationId: handoff.orgId,
          locale,
          conversationId,
        }),
      });
      const body = await response.json().catch(() => ({})) as any;
      if (!response.ok && !body?.humanSummary) {
        throw new Error(response.status === 401 ? 'SESSION_EXPIRED' : 'CORE_UNAVAILABLE');
      }
      return {
        status: body?.status ?? (response.ok ? 'success' : 'failed'),
        code: body?.code,
        humanSummary: safeString(body?.humanSummary) || 'O Connect não conseguiu concluir esta solicitação.',
        auditId: safeString(body?.auditId) || undefined,
        data: body?.data,
        deepLink: safeString(body?.deepLink) || undefined,
      } as LiveCoreResponse;
    },
  };
}

export const CONNECT_LIVE_MODE_ENABLED = readViteEnv('VITE_CONNECT_LIVE_ENABLED') === 'true';
