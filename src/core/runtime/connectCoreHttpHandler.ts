import crypto from 'node:crypto';
import { ConnectCoreResponse, ConnectCoreService } from './connectCore';

type MinimalRequest = {
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type MinimalResponse = {
  status(code: number): MinimalResponse;
  json(payload: unknown): unknown;
  setHeader?(name: string, value: string): void;
};

type InAppBody = {
  text?: unknown;
  requestedOrganizationId?: unknown;
  locale?: unknown;
  conversationId?: unknown;
};

const MAX_MESSAGE_CHARS = 4_000;
const MAX_ORG_ID_CHARS = 180;
const MAX_CONVERSATION_ID_CHARS = 180;

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() || '';
  return typeof value === 'string' ? value.trim() : '';
}

function getHeader(req: MinimalRequest, name: string): string {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (key.toLowerCase() === target) return headerValue(value);
  }
  return '';
}

function bodyObject(value: unknown): InAppBody {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as InAppBody)
    : {};
}

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeLocale(value: unknown): string {
  const locale = cleanString(value, 32).toLowerCase();
  if (locale.startsWith('en')) return 'en';
  if (locale.startsWith('es')) return 'es';
  return 'pt-BR';
}

function responseStatus(result: ConnectCoreResponse): number {
  if (result.status === 'success') return 200;
  if (result.status === 'unsupported') return 400;
  if (result.status === 'denied') return 403;
  if (result.code === 'AUTH_REQUIRED' || result.code === 'IDENTITY_REQUIRED') return 401;
  if (result.code === 'ORGANIZATION_REQUIRED' || result.code === 'TOOL_CONFLICT') return 409;
  return 503;
}

export interface ConnectCoreHttpHandlerOptions {
  createRequestId?: () => string;
  createCorrelationId?: () => string;
}

/**
 * Small server-side boundary for the first real in-app Core request.
 *
 * The browser supplies a Firebase bearer and message text. It does not supply
 * roles/capabilities as authority. Connect resolves canonical context through
 * Hub and MusicScale independently revalidates the same bearer before reading.
 */
export function createConnectCoreHttpHandler(
  core: ConnectCoreService,
  options: ConnectCoreHttpHandlerOptions = {},
) {
  const createRequestId = options.createRequestId ?? (() => `core-${crypto.randomUUID()}`);
  const createCorrelationId = options.createCorrelationId ?? (() => `cor-${crypto.randomUUID()}`);

  return async function handleConnectCoreRequest(
    req: MinimalRequest,
    res: MinimalResponse,
  ) {
    res.setHeader?.('Cache-Control', 'no-store');

    const requestId = createRequestId();
    const correlationId = createCorrelationId();
    const authorization = getHeader(req, 'authorization');

    if (!authorization || !/^Bearer\s+\S+/i.test(authorization)) {
      return res.status(401).json({
        status: 'needs_context',
        code: 'AUTH_REQUIRED',
        humanSummary: 'Antes de acessar informações da sua igreja, precisamos confirmar sua conta.',
        requestId,
        correlationId,
      });
    }

    const body = bodyObject(req.body);
    const text = cleanString(body.text, MAX_MESSAGE_CHARS);
    if (!text) {
      return res.status(400).json({
        status: 'unsupported',
        code: 'MESSAGE_REQUIRED',
        humanSummary: 'Escreva o que você precisa para eu poder ajudar.',
        requestId,
        correlationId,
      });
    }

    const requestedOrganizationId = cleanString(
      body.requestedOrganizationId,
      MAX_ORG_ID_CHARS,
    );
    const conversationId =
      cleanString(body.conversationId, MAX_CONVERSATION_ID_CHARS) ||
      `inapp-${requestId}`;

    try {
      const result = await core.handleMessage({
        requestId,
        correlationId,
        authToken: authorization,
        requestedOrganizationId: requestedOrganizationId || undefined,
        channel: {
          type: 'inapp',
          conversationId,
        },
        locale: normalizeLocale(body.locale),
        text,
      });

      return res.status(responseStatus(result)).json({
        ...result,
        requestId,
        correlationId,
      });
    } catch {
      return res.status(503).json({
        status: 'failed',
        code: 'CORE_UNAVAILABLE',
        humanSummary: 'Não consegui concluir essa consulta agora. Tente novamente em instantes.',
        requestId,
        correlationId,
      });
    }
  };
}
