import {
  CanonicalContextResolution,
  CanonicalCoreContext,
} from './connectCore';

export interface HubConnectSessionUser {
  uid: string;
  systemRole: string | null;
  capabilities: string[];
}

export interface HubConnectSessionOrganization {
  id: string;
  organizationRole: string | null;
  permissions: string[];
  capabilities: string[];
}

export interface HubConnectSessionAppAccess {
  appId: 'musicscale';
  organizationId: string;
  accessible: boolean;
  decisionState: 'granted' | 'denied';
}

export interface HubConnectSessionContextResponse {
  success: boolean;
  protocolVersion: string;
  user?: HubConnectSessionUser;
  globalAccess?: boolean;
  activeOrganizationId?: string | null;
  activeOrganization?: HubConnectSessionOrganization | null;
  appAccess?: {
    musicscale: HubConnectSessionAppAccess;
  } | null;
}

function uniqueStrings(...groups: Array<string[] | undefined>): string[] {
  return Array.from(
    new Set(
      groups
        .flatMap((group) => group ?? [])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

/**
 * Maps the verified Hub Connect Session Context protocol into the neutral
 * Connect Core context. It does not grant permissions and does not perform
 * network I/O; the real provider is responsible for calling the canonical Hub
 * server endpoint and the downstream Tool Gateway must revalidate authority.
 */
export function mapHubConnectSessionContext(
  payload: HubConnectSessionContextResponse,
): CanonicalContextResolution {
  if (!payload.success || !payload.user?.uid) {
    return {
      status: 'identity_required',
      reason: 'Antes de acessar informações da sua igreja, precisamos confirmar sua conta.',
    };
  }

  const activeOrganization = payload.activeOrganization;
  const activeOrganizationId = payload.activeOrganizationId;

  if (!activeOrganization || !activeOrganizationId) {
    return {
      status: 'organization_required',
      reason: 'De qual igreja/organização você está falando?',
    };
  }

  if (activeOrganization.id !== activeOrganizationId) {
    return {
      status: 'denied',
      reason: 'O contexto da organização retornado pelo Hub está inconsistente.',
    };
  }

  const musicScaleAccess = payload.appAccess?.musicscale;
  if (
    musicScaleAccess &&
    musicScaleAccess.organizationId !== activeOrganizationId
  ) {
    return {
      status: 'denied',
      reason: 'O acesso do MusicScale não corresponde à organização ativa.',
    };
  }

  const context: CanonicalCoreContext = {
    actorUid: payload.user.uid,
    systemRole: payload.user.systemRole ?? null,
    globalAccess: payload.globalAccess === true,
    organizationId: activeOrganizationId,
    organizationRole: activeOrganization.organizationRole ?? null,
    permissions: uniqueStrings(activeOrganization.permissions),
    capabilities: uniqueStrings(
      payload.user.capabilities,
      activeOrganization.capabilities,
    ),
    appAccess: {
      musicscale:
        musicScaleAccess?.accessible === true &&
        musicScaleAccess.decisionState === 'granted',
    },
  };

  return { status: 'resolved', context };
}
