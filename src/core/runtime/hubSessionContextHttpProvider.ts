import {
  CanonicalContextProvider,
  CanonicalContextResolution,
} from './connectCore';
import {
  HubConnectSessionContextResponse,
  mapHubConnectSessionContext,
} from './hubSessionContextAdapter';

const HUB_SESSION_CONTEXT_PATH = '/api/ecosystem/connect/session-context';
const DEFAULT_TIMEOUT_MS = 8_000;

type HubFetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

type HubFetch = (
  input: string,
  init: {
    method: 'GET';
    headers: Record<string, string>;
    signal: AbortSignal;
  },
) => Promise<HubFetchResponse>;

export interface HubSessionContextHttpProviderOptions {
  hubOrigin: string;
  fetchImpl?: HubFetch;
  timeoutMs?: number;
}

function normalizeHubOrigin(rawOrigin: string): string {
  const trimmed = rawOrigin.trim();
  if (!trimmed) {
    throw new Error('MILLIONSNEST_HUB_ORIGIN is required.');
  }

  const parsed = new URL(trimmed);
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error('MILLIONSNEST_HUB_ORIGIN must use http or https.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('MILLIONSNEST_HUB_ORIGIN must not contain credentials.');
  }

  return parsed.origin;
}

function normalizeAuthorizationHeader(authToken: string): string {
  const trimmed = authToken.trim();
  if (!trimmed) return '';
  return /^bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

function isHubPayload(value: unknown): value is HubConnectSessionContextResponse {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'success' in value &&
      typeof (value as { success?: unknown }).success === 'boolean',
  );
}

/**
 * Server-side adapter for the canonical Hub session-context endpoint.
 * It forwards only the Firebase bearer credential required by Hub and never
 * treats Connect-side context as an authorization source.
 */
export class HubSessionContextHttpProvider implements CanonicalContextProvider {
  private readonly endpoint: string;
  private readonly fetchImpl: HubFetch;
  private readonly timeoutMs: number;

  constructor(options: HubSessionContextHttpProviderOptions) {
    const origin = normalizeHubOrigin(options.hubOrigin);
    this.endpoint = new URL(HUB_SESSION_CONTEXT_PATH, origin).toString();
    this.fetchImpl =
      options.fetchImpl ??
      ((input, init) => fetch(input, init) as Promise<HubFetchResponse>);
    this.timeoutMs = Math.max(1_000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  }

  async resolve(input: {
    authToken: string;
    requestedOrganizationId?: string;
  }): Promise<CanonicalContextResolution> {
    const authorization = normalizeAuthorizationHeader(input.authToken);
    if (!authorization) {
      return {
        status: 'identity_required',
        reason: 'Antes de acessar informações da sua igreja, precisamos confirmar sua conta.',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'GET',
        headers: {
          Authorization: authorization,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 404) {
        return {
          status: 'identity_required',
          reason: 'Antes de acessar informações da sua igreja, precisamos confirmar sua conta.',
        };
      }

      if (response.status === 403) {
        return {
          status: 'denied',
          reason: 'Sua conta não está autorizada a acessar este contexto.',
        };
      }

      if (!response.ok) {
        throw new Error(`Hub session context failed with status ${response.status}.`);
      }

      const payload = await response.json();
      if (!isHubPayload(payload)) {
        throw new Error('Hub session context returned an invalid payload.');
      }

      const resolution = mapHubConnectSessionContext(payload);

      if (
        resolution.status === 'resolved' &&
        input.requestedOrganizationId &&
        resolution.context.organizationId !== input.requestedOrganizationId
      ) {
        return {
          status: 'organization_required',
          reason: 'De qual igreja/organização você está falando?',
        };
      }

      return resolution;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export { HUB_SESSION_CONTEXT_PATH };
