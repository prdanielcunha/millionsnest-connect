import {
  MusicScaleNextScheduleResult,
  MusicScaleReadToolPort,
} from './connectCore';

export const MUSIC_SCALE_NEXT_PRESENCE_PATH =
  '/api/v1/connect/next-schedule/presence';

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

export interface MusicScaleNextSchedulePresenceHttpToolOptions {
  musicScaleOrigin: string;
  fetchImpl?: ToolFetch;
  timeoutMs?: number;
}

type MusicScalePresencePayload = {
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
  presence?: null | {
    status?: string;
    statuses?: unknown[];
    responseCount?: number;
    respondedAt?: string | null;
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
    ? value.trim().slice(0, 500)
    : fallback;
}

function isPayload(value: unknown): value is MusicScalePresencePayload {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'success' in value &&
      typeof (value as { success?: unknown }).success === 'boolean',
  );
}

function sanitizePresence(value: MusicScalePresencePayload['presence']) {
  if (!value || typeof value !== 'object') return null;
  const allowed = new Set(['pending', 'accepted', 'maybe', 'declined', 'mixed']);
  const status = typeof value.status === 'string' && allowed.has(value.status)
    ? value.status
    : 'pending';
  const statuses = Array.isArray(value.statuses)
    ? value.statuses
        .filter((item): item is string =>
          item === 'accepted' || item === 'maybe' || item === 'declined')
        .slice(0, 10)
    : [];
  const responseCount =
    typeof value.responseCount === 'number' &&
    Number.isInteger(value.responseCount) &&
    value.responseCount >= 0 &&
    value.responseCount <= 100
      ? value.responseCount
      : statuses.length;
  const respondedAt =
    typeof value.respondedAt === 'string' && !Number.isNaN(Date.parse(value.respondedAt))
      ? new Date(value.respondedAt).toISOString()
      : null;

  return { status, statuses, responseCount, respondedAt };
}

export class MusicScaleNextSchedulePresenceHttpTool {
  private readonly endpoint: string;
  private readonly fetchImpl: ToolFetch;
  private readonly timeoutMs: number;

  constructor(options: MusicScaleNextSchedulePresenceHttpToolOptions) {
    const origin = normalizeOrigin(options.musicScaleOrigin);
    this.endpoint = new URL(MUSIC_SCALE_NEXT_PRESENCE_PATH, origin).toString();
    this.fetchImpl =
      options.fetchImpl ??
      ((input, init) => fetch(input, init) as Promise<ToolFetchResponse>);
    this.timeoutMs = Math.max(1_000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  }

  async getNextSchedulePresence(
    input: Parameters<NonNullable<MusicScaleReadToolPort['getNextSchedulePresence']>>[0],
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
          'X-Connect-User-Authorization': authorization,
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
            'O MusicScale negou acesso a essa informação de presença.',
          ),
          auditId: isPayload(payload) ? payload.auditId : undefined,
        };
      }

      if (response.status === 400 || response.status === 409) {
        return {
          status: 'conflict',
          humanSummary: safeSummary(
            isPayload(payload) ? payload.humanSummary : null,
            'Não foi possível resolver a organização desta consulta.',
          ),
          auditId: isPayload(payload) ? payload.auditId : undefined,
        };
      }

      if (!response.ok) {
        return {
          status: 'failed',
          humanSummary: 'Não consegui consultar sua presença no MusicScale agora.',
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
        data: {
          schedule: payload.schedule ?? null,
          presence: sanitizePresence(payload.presence),
        },
        humanSummary: safeSummary(
          payload.humanSummary,
          payload.schedule
            ? 'Consultei sua resposta de presença no MusicScale.'
            : 'Não encontrei uma próxima escala atribuída a você.',
        ),
        auditId: payload.auditId,
        deepLink:
          payload.schedule && typeof payload.schedule.deepLink === 'string'
            ? payload.schedule.deepLink
            : undefined,
      };
    } catch {
      return {
        status: 'failed',
        humanSummary: 'Não consegui consultar sua presença no MusicScale agora.',
        retryable: true,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
