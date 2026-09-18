import {
  MusicScaleNextScheduleResult,
  MusicScaleReadToolPort,
} from './connectCore';

export const MUSIC_SCALE_NEXT_CHART_PATH = '/api/v1/connect/next-schedule/chart';

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

export interface MusicScaleNextScheduleChartHttpToolOptions {
  musicScaleOrigin: string;
  fetchImpl?: ToolFetch;
  timeoutMs?: number;
}

type MusicScaleChartPayload = {
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
  chart?: null | {
    status?: string;
    songId?: string;
    title?: string;
    artist?: string | null;
    sourceKey?: string;
    scheduledKey?: string | null;
    bpm?: number | null;
    chords?: string;
    transposed?: boolean;
    changedChordCount?: number;
    sourceVerified?: boolean;
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

function isPayload(value: unknown): value is MusicScaleChartPayload {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'success' in value &&
      typeof (value as { success?: unknown }).success === 'boolean',
  );
}

function sanitizeChart(value: MusicScaleChartPayload['chart']) {
  if (!value || typeof value !== 'object') return null;
  const allowedStatuses = new Set([
    'ready',
    'no_chords',
    'requires_source_key_confirmation',
    'transposition_failed',
  ]);
  const status =
    typeof value.status === 'string' && allowedStatuses.has(value.status)
      ? value.status
      : 'transposition_failed';

  const base = {
    status,
    songId: typeof value.songId === 'string' ? value.songId.slice(0, 256) : '',
    title: typeof value.title === 'string' ? value.title.slice(0, 180) : '',
    artist: typeof value.artist === 'string' ? value.artist.slice(0, 160) : null,
    sourceKey: typeof value.sourceKey === 'string' ? value.sourceKey.slice(0, 24) : null,
    scheduledKey: typeof value.scheduledKey === 'string' ? value.scheduledKey.slice(0, 24) : null,
    bpm: typeof value.bpm === 'number' && Number.isFinite(value.bpm) ? value.bpm : null,
  };

  if (status !== 'ready') return base;

  const chords = typeof value.chords === 'string' ? value.chords.slice(0, 80_000) : '';
  if (!chords || value.sourceVerified !== true) {
    return { ...base, status: 'transposition_failed' as const };
  }

  return {
    ...base,
    chords,
    transposed: value.transposed === true,
    changedChordCount:
      typeof value.changedChordCount === 'number' &&
      Number.isInteger(value.changedChordCount) &&
      value.changedChordCount >= 0
        ? value.changedChordCount
        : 0,
    sourceVerified: true,
  };
}

export class MusicScaleNextScheduleChartHttpTool {
  private readonly endpointOrigin: string;
  private readonly fetchImpl: ToolFetch;
  private readonly timeoutMs: number;

  constructor(options: MusicScaleNextScheduleChartHttpToolOptions) {
    const origin = normalizeOrigin(options.musicScaleOrigin);
    this.endpointOrigin = new URL(MUSIC_SCALE_NEXT_CHART_PATH, origin).toString();
    this.fetchImpl =
      options.fetchImpl ??
      ((input, init) => fetch(input, init) as Promise<ToolFetchResponse>);
    this.timeoutMs = Math.max(1_000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  }

  async getNextScheduleChart(
    input: Parameters<NonNullable<MusicScaleReadToolPort['getNextScheduleChart']>>[0],
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
    if (input.channel.type !== 'inapp') {
      return {
        status: 'denied',
        humanSummary: 'A entrega de cifra completa está disponível somente dentro do Connect por enquanto.',
      };
    }

    const songTitleQuery = input.songTitleQuery.trim().slice(0, 180);
    if (!songTitleQuery) {
      return {
        status: 'conflict',
        humanSummary: 'Qual música da sua próxima escala você quer abrir?',
      };
    }

    const endpoint = new URL(this.endpointOrigin);
    endpoint.searchParams.set('title', songTitleQuery);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(endpoint.toString(), {
        method: 'GET',
        headers: {
          Authorization: authorization,
          'X-Connect-User-Authorization': authorization,
          'X-Organization-Id': input.organizationId,
          'X-Connect-Channel': input.channel.type,
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
            'O MusicScale negou acesso a essa cifra.',
          ),
          auditId: isPayload(payload) ? payload.auditId : undefined,
        };
      }

      if ([400, 404, 409].includes(response.status)) {
        return {
          status: 'conflict',
          humanSummary: safeSummary(
            isPayload(payload) ? payload.humanSummary : null,
            'Não consegui resolver essa música na sua próxima escala.',
          ),
          auditId: isPayload(payload) ? payload.auditId : undefined,
        };
      }

      if (!response.ok) {
        return {
          status: 'failed',
          humanSummary: 'Não consegui consultar essa cifra no MusicScale agora.',
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

      const chart = sanitizeChart(payload.chart);
      return {
        status: 'success',
        data: {
          schedule: payload.schedule ?? null,
          chart,
        },
        humanSummary: safeSummary(
          payload.humanSummary,
          chart?.status === 'ready'
            ? 'Encontrei a cifra da sua próxima escala no MusicScale.'
            : 'A cifra precisa de uma revisão no MusicScale antes de ser entregue.',
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
        humanSummary: 'Não consegui consultar essa cifra no MusicScale agora.',
        retryable: true,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
