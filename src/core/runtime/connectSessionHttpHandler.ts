import express from 'express';

export interface ConnectSessionHttpHandlerOptions {
  hubOrigin: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function bearerFromRequest(req: express.Request): string {
  const value = req.headers.authorization;
  return typeof value === 'string' && /^Bearer\s+\S+$/i.test(value.trim()) ? value.trim() : '';
}

function normalizeOrigin(raw: string): string {
  const value = raw.trim();
  if (!value) throw new Error('MILLIONSNEST_HUB_ORIGIN is required.');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('MILLIONSNEST_HUB_ORIGIN is invalid.');
  }
  return url.origin;
}

/**
 * Browser-safe projection endpoint for live Connect bootstrap.
 * Hub remains the authority: this handler only forwards the Firebase bearer,
 * verifies tenant consistency, and returns Hub's already-sanitized Connect
 * session-context response. It never derives roles or permissions locally.
 */
export function createConnectSessionHttpHandler(options: ConnectSessionHttpHandlerOptions) {
  const endpoint = new URL(
    '/api/ecosystem/connect/session-context',
    normalizeOrigin(options.hubOrigin),
  ).toString();
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? 8_000);

  return async function connectSessionHttpHandler(req: express.Request, res: express.Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    const authorization = bearerFromRequest(req);
    if (!authorization) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        humanSummary: 'Sua sessão precisa ser confirmada novamente.',
      });
    }

    const requestedOrganizationId = typeof req.query.organizationId === 'string'
      ? req.query.organizationId.trim()
      : '';
    if (!requestedOrganizationId || requestedOrganizationId.length > 256 || requestedOrganizationId.includes('/') || requestedOrganizationId.includes('\\')) {
      return res.status(400).json({
        success: false,
        code: 'ORGANIZATION_REQUIRED',
        humanSummary: 'Selecione uma organização válida no MillionsNest.',
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const upstream = await fetchImpl(endpoint, {
        method: 'GET',
        headers: {
          Authorization: authorization,
          Accept: 'application/json',
          'Cache-Control': 'no-store',
        },
        signal: controller.signal,
      });
      const payload = await upstream.json().catch(() => null) as any;

      if (upstream.status === 401) {
        return res.status(401).json({
          success: false,
          code: 'AUTH_REQUIRED',
          humanSummary: 'Sua sessão expirou. Abra o Connect novamente pelo MillionsNest.',
        });
      }
      if (!upstream.ok || !payload || payload.success !== true) {
        return res.status(upstream.status >= 400 && upstream.status < 500 ? upstream.status : 503).json({
          success: false,
          code: 'CANONICAL_CONTEXT_UNAVAILABLE',
          humanSummary: 'Não foi possível confirmar seu contexto no MillionsNest.',
        });
      }

      const activeOrganizationId = typeof payload.activeOrganizationId === 'string'
        ? payload.activeOrganizationId.trim()
        : '';
      const activeObjectId = typeof payload.activeOrganization?.id === 'string'
        ? payload.activeOrganization.id.trim()
        : '';

      if (
        activeOrganizationId !== requestedOrganizationId ||
        activeObjectId !== requestedOrganizationId ||
        typeof payload.user?.uid !== 'string' ||
        !payload.user.uid.trim()
      ) {
        return res.status(409).json({
          success: false,
          code: 'ORGANIZATION_CONTEXT_MISMATCH',
          humanSummary: 'A organização ativa mudou. Abra o Connect novamente pelo MillionsNest.',
        });
      }

      return res.status(200).json(payload);
    } catch (error) {
      return res.status(503).json({
        success: false,
        code: 'CANONICAL_CONTEXT_UNAVAILABLE',
        humanSummary: error instanceof Error && error.name === 'AbortError'
          ? 'A confirmação da sessão demorou mais que o esperado.'
          : 'Não foi possível confirmar seu contexto no MillionsNest.',
      });
    } finally {
      clearTimeout(timeout);
    }
  };
}
