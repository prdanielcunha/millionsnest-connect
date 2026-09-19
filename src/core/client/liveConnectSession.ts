import { EffectiveEcosystemContext, LanguageCode } from '../../types';
import { restoreConnectDirectIdentity } from './connectDirectAuth';

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
  entrySource: 'handoff' | 'direct';
  organizationSelectionRequired: boolean;
  context: EffectiveEcosystemContext;
  selectOrganization(organizationId: string): Promise<LiveConnectSession>;
  sendMessage(text: string, conversationId: string, locale: LanguageCode): Promise<LiveCoreResponse>;
};

type BootstrapDependencies = {
  locationHref: string;
  replaceUrl(url: string): void;
  fetchFn: typeof fetch;
  now(): number;
  configuredApiKey?: string;
  restoreDirectIdentity?: typeof restoreConnectDirectIdentity;
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
  if (!idToken) throw new Error('HANDOFF_IDENTITY_MISMATCH');
  if (localId && localId !== payload.userId) throw new Error('HANDOFF_IDENTITY_MISMATCH');
  return idToken;
}

function mapCanonicalSessionToContext(
  session: any,
  expectedOrgId: string | null,
  expectedUid: string,
): EffectiveEcosystemContext {
  const activeId = safeString(session?.activeOrganizationId);
  const active = session?.activeOrganization;

  if (
    session?.success !== true ||
    safeString(session?.user?.uid) !== expectedUid ||
    !activeId ||
    safeString(active?.id) !== activeId ||
    (expectedOrgId && activeId !== expectedOrgId)
  ) {
    throw new Error('CANONICAL_CONTEXT_MISMATCH');
  }

  const userSystemRole = safeString(session.user?.systemRole);
  const allowedSystemRoles = new Set(['ceo', 'global_admin', 'ecosystem_owner', 'founder', 'support']);
  const capabilities = Array.isArray(session.user?.capabilities)
    ? session.user.capabilities.filter((value: unknown): value is string => typeof value === 'string')
    : [];

  const rawOrganizations = Array.isArray(session?.organizations) ? session.organizations : [active];
  const availableOrganizations = rawOrganizations
    .filter((item: any) => item && safeString(item.id))
    .map((item: any) => ({
      id: safeString(item.id),
      name: safeString(item.name) || safeString(item.id),
      slug: safeString(item.slug) || safeString(item.id),
      plan: 'ecosystem',
      isDemo: false,
    }));

  if (!availableOrganizations.some((organization) => organization.id === activeId)) {
    availableOrganizations.unshift({
      id: activeId,
      name: safeString(active.name) || activeId,
      slug: safeString(active.slug) || activeId,
      plan: 'ecosystem',
      isDemo: false,
    });
  }

  const organization = availableOrganizations.find((item) => item.id === activeId)!;

  const memberships = rawOrganizations
    .filter((item: any) => item && safeString(item.id))
    .map((item: any) => ({
      id: `${safeString(item.id)}:${expectedUid}`,
      uid: expectedUid,
      organizationId: safeString(item.id),
      organizationName: safeString(item.name) || safeString(item.id),
      organizationRole: safeString(item.organizationRole) || null,
      status: 'active' as const,
      permissions: Array.isArray(item.permissions)
        ? item.permissions.filter((value: unknown): value is string => typeof value === 'string')
        : [],
    }));

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
    availableOrganizations,
    memberships,
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
  'USER_NOT_FOUND',
  'USER_INACTIVE',
]);

async function requestCanonicalSession(
  idToken: string,
  expectedUid: string,
  fetchFn: typeof fetch,
  organizationId?: string,
): Promise<EffectiveEcosystemContext> {
  const url = organizationId
    ? `/api/core/session?organizationId=${encodeURIComponent(organizationId)}`
    : '/api/core/session';

  const response = await fetchFn(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: 'application/json',
      'Cache-Control': 'no-store',
    },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({})) as any;
  if (!response.ok) {
    const upstreamCode = safeString(payload?.code);
    throw new Error(
      SAFE_CANONICAL_SESSION_ERROR_CODES.has(upstreamCode)
        ? upstreamCode
        : 'CANONICAL_CONTEXT_UNAVAILABLE',
    );
  }

  return mapCanonicalSessionToContext(payload, organizationId || null, expectedUid);
}

function createLiveSession(params: {
  idToken: string;
  expectedUid: string;
  context: EffectiveEcosystemContext;
  entrySource: 'handoff' | 'direct';
  organizationSelectionRequired?: boolean;
  fetchFn: typeof fetch;
}): LiveConnectSession {
  const { idToken, expectedUid, context, entrySource, fetchFn } = params;
  const organizationSelectionRequired = params.organizationSelectionRequired === true;
  const organizationId = context.activeOrganization.id;

  return {
    idToken,
    expectedOrganizationId: organizationId,
    entrySource,
    organizationSelectionRequired,
    context,
    async selectOrganization(nextOrganizationId) {
      const allowed = context.availableOrganizations.some((organization) => organization.id === nextOrganizationId);
      if (!allowed) throw new Error('ORGANIZATION_ACCESS_DENIED');
      const nextContext = await requestCanonicalSession(idToken, expectedUid, fetchFn, nextOrganizationId);
      try { localStorage.setItem('mn_connect_last_org_id', nextOrganizationId); } catch {}
      return createLiveSession({
        idToken,
        expectedUid,
        context: nextContext,
        entrySource,
        organizationSelectionRequired: false,
        fetchFn,
      });
    },
    async sendMessage(text, conversationId, locale) {
      const response = await fetchFn('/api/core/message', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({
          text,
          requestedOrganizationId: organizationId,
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

export async function bootstrapLiveConnectSession(
  injected?: Partial<BootstrapDependencies>,
): Promise<LiveConnectSession> {
  const deps: BootstrapDependencies = {
    locationHref: injected?.locationHref ?? window.location.href,
    replaceUrl: injected?.replaceUrl ?? ((url) => window.history.replaceState({}, '', url)),
    fetchFn: injected?.fetchFn ?? globalThis.fetch.bind(globalThis),
    now: injected?.now ?? Date.now,
    configuredApiKey: injected?.configuredApiKey ?? readViteEnv('VITE_FIREBASE_API_KEY'),
    restoreDirectIdentity: injected?.restoreDirectIdentity ?? restoreConnectDirectIdentity,
  };

  const url = new URL(deps.locationHref);
  const encoded = url.searchParams.get('ecosystem_ctx');

  if (encoded) {
    url.searchParams.delete('ecosystem_ctx');
    deps.replaceUrl(url.toString());

    const handoff = decodeHandoff(encoded, deps.now());
    const apiKey = await resolveFirebaseApiKey(deps);
    const idToken = await exchangeCustomToken(handoff, apiKey, deps.fetchFn);
    const context = await requestCanonicalSession(idToken, handoff.userId, deps.fetchFn, handoff.orgId);
    return createLiveSession({
      idToken,
      expectedUid: handoff.userId,
      context,
      entrySource: 'handoff',
      fetchFn: deps.fetchFn,
    });
  }

  const identity = await deps.restoreDirectIdentity!();
  if (!identity) throw new Error('DIRECT_LOGIN_REQUIRED');

  let context = await requestCanonicalSession(identity.idToken, identity.uid, deps.fetchFn);
  let remembered = '';
  try { remembered = safeString(localStorage.getItem('mn_connect_last_org_id')); } catch {}

  const rememberedIsEligible = Boolean(
    remembered &&
    context.availableOrganizations.some((organization) => organization.id === remembered),
  );

  if (rememberedIsEligible && remembered !== context.activeOrganization.id) {
    context = await requestCanonicalSession(identity.idToken, identity.uid, deps.fetchFn, remembered);
  }

  return createLiveSession({
    idToken: identity.idToken,
    expectedUid: identity.uid,
    context,
    entrySource: 'direct',
    organizationSelectionRequired: context.availableOrganizations.length > 1 && !rememberedIsEligible,
    fetchFn: deps.fetchFn,
  });
}

export const CONNECT_LIVE_MODE_ENABLED = readViteEnv('VITE_CONNECT_LIVE_ENABLED') === 'true';
