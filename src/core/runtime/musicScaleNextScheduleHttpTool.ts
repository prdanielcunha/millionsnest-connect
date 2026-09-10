import {
  MusicScaleNextScheduleResult,
  MusicScaleReadToolPort,
} from './connectCore';

export const MUSIC_SCALE_NEXT_SCHEDULE_PATH = '/api/v1/connect/next-schedule';
const DEFAULT_TIMEOUT_MS = 8_000;

type ToolFetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

type ToolFetch = (
  input: string,
  init: {
    method: 'GET';
    headers: Record<string, string>;
    signal: AbortSignal;
  },
) => Promise<ToolFetchResponse>;

export interface MusicScaleNextScheduleHttpToolOptions {
  musicScaleOrigin: string;
  fetchImpl?: ToolFetch;
  timeoutMs?: number;
}

type MusicScaleToolPayload = {
  success: boolean;
  code?: string;
  auditId?: string;
  organizationId?: string;
  schedule?: null | {
    id?: string;
    organizationId?: string;
    deepLink?: string;
    [key: string]: unknown;
  };
  humanSummary?: string;
};

function normalizeOrigin(rawOrigin: string): string {
  const trimmed = rawOrigin.trim();
  if (!trimmed) throw new Error('MUSICSCALE_ORIGIN is required.');

  const parsed = new URL(trimmed);
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error('MUSICSCALE_ORIGIN must use http or https.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('MUSICSCALE_ORIGIN must not contain credentials.');
  }

  return parsed.origin;
}

function normalizeAuthorizationHeader(authToken: string): string {
  const trimmed = authToken.trim();
  if (!trimmed) return '';
  return /^bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

function safeSummary(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 300)
    : fallback;
}

function isPayload(value: unknown): value is MusicScaleToolPayload {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'success' in value &&
      typeof (value as { success?: unknown }).success === 'boolean',
  );
}

/**
 * Real server-to-server adapter for the canonical MusicScale read boundary.
 *
 * Important: Connect deliberately does NOT forward its resolved roles,
 * permissions or capabilities as authority. Only the user's bearer,
 * organization id and request tracing metadata cross the boundary. MusicScale
 * independently verifies identity, tenant and `scales.read`.
 */
export class MusicScaleNextScheduleHttpTool implements MusicScaleReadToolPort {
  private readonly endpoint: string;
  private readonly fetchImpl: ToolFetch;
  private readonly timeoutMs: number;

  constructor(options: MusicScaleNextScheduleHttpToolOptions) {
    const origin = normalizeOrigin(options.musicScaleOrigin);
    this.endpoint = new URL(MUSIC_SCALE_NEXT_SCHEDULE_PATH, origin).toString();
    this.fetchImpl =
      options.fetchImpl ??
      ((input, init) => fetch(input, init) as Promise<ToolFetchResponse>);
    this.timeoutMs = Math.max(1_000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  }

  async getNextSchedule(
    input: Parameters<MusicScaleReadToolPort['getNextSchedule']>[0],
  ): Promise<MusicScaleNextScheduleResult> {
    const authorization = normalizeAuthorizationHeader(input.authToken);
    if (!authorization) {
      return {
        status: 'denied',
        humanSummary: 'Antes de consultar o MusicScale, precisamos confirmar sua conta.',
      };
    }

    if (!input.organizationId.trim()) {
      return {
        status: 'conflict',
        humanSummary: 'De qual igreja/organização você está falando?',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'GET',
        headers: {
          Authorization: authorization,
          'X-Organization-Id': input.organizationId,
          'X-Request-Id': input.requestId,
          'X-Correlation-Id': input.correlationId,
          'Accept-Language': input.locale || 'pt-BR',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (response.status === 401 || response.status === 403) {
        return {
          status: 'denied',
          humanSummary: safeSummary(
            isPayload(payload) ? payload.humanSummary : null,
            'O MusicScale negou acesso a essa informação.',
          ),
          auditId: isPayload(payload) ? payload.auditId : undefined,
        };
      }

      if (response.status === 400 || response.status === 409) {
        return {
          status: 'conflict',
          humanSummary: safeSummary(
            isPayload(payload) ? payload.humanSummary : null,
            'Não foi possível resolver o contexto da organização para esta consulta.',
          ),
          auditId: isPayload(payload) ? payload.auditId : undefined,
        };
      }

      if (!response.ok) {
        return {
          status: 'failed',
          humanSummary: 'Não consegui consultar o MusicScale agora. Tente novamente em instantes.',
          auditId: isPayload(payload) ? payload.auditId : undefined,
          retryable: response.status >= 500,
        };
      }

      if (!isPayload(payload) || payload.success !== true || !payload.auditId) {
        return {
          status: 'failed',
          humanSummary: 'O MusicScale respondeu em um formato inesperado.',
          retryable: false,
        };
      }

      if (payload.organizationId !== input.organizationId) {
        return {
          status: 'conflict',
          humanSummary: 'A organização devolvida pelo MusicScale não corresponde ao contexto autorizado.',
          auditId: payload.auditId,
        };
      }

      if (
        payload.schedule &&
        payload.schedule.organizationId &&
        payload.schedule.organizationId !== input.organizationId
      ) {
        return {
          status: 'conflict',
          humanSummary: 'A escala devolvida pelo MusicScale não pertence à organização autorizada.',
          auditId: payload.auditId,
        };
      }

      return {
        status: 'success',
        data: payload.schedule ?? null,
        humanSummary: safeSummary(
          payload.humanSummary,
          payload.schedule
            ? 'Encontrei sua próxima escala no MusicScale.'
            : 'Não encontrei uma próxima escala atribuída a você.',
        ),
        auditId: payload.auditId,
        deepLink:
          payload.schedule && typeof payload.schedule.deepLink === 'string'
            ? payload.schedule.deepLink
            : undefined,
      };
    } catch (error) {
      return {
        status: 'failed',
        humanSummary: 'Não consegui consultar o MusicScale agora. Tente novamente em instantes.',
        retryable: true,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
