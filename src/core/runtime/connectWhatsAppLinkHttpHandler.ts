import type { CanonicalContextProvider } from './connectCore';
import type { WhatsAppChannelIdentityStore } from '../channels/whatsappChannelIdentityStore';

export type WhatsAppLinkHttpRequest = {
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type WhatsAppLinkHttpResponse = {
  status(code: number): WhatsAppLinkHttpResponse;
  json(body: unknown): unknown;
  setHeader?(name: string, value: string): void;
};

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? clean(value[0]) : clean(value);
}

function readHeader(headers: Record<string, string | string[] | undefined>, name: string): string {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return headerValue(value);
  }
  return '';
}

export function createConnectWhatsAppLinkHttpHandler(options: {
  store: WhatsAppChannelIdentityStore;
  contextProvider: CanonicalContextProvider;
  now?: () => Date;
  logger?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
}) {
  const now = options.now ?? (() => new Date());
  const logger = options.logger ?? console;

  return async function handleWhatsAppLink(
    req: WhatsAppLinkHttpRequest,
    res: WhatsAppLinkHttpResponse,
  ): Promise<unknown> {
    res.setHeader?.('Cache-Control', 'no-store');

    const authorization = readHeader(req.headers, 'authorization');
    if (!/^Bearer\s+\S+$/i.test(authorization)) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
      });
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        success: false,
        code: 'WHATSAPP_LINK_TOKEN_REQUIRED',
      });
    }

    const token = clean((req.body as Record<string, unknown>).token);
    if (!/^[A-Za-z0-9_-]{40,128}$/.test(token)) {
      return res.status(400).json({
        success: false,
        code: 'WHATSAPP_LINK_TOKEN_INVALID',
      });
    }

    let challenge;
    try {
      challenge = await options.store.getChallenge(token);
    } catch (error) {
      logger.warn?.('[CONNECT_WHATSAPP_LINK] challenge lookup failed', {
        error: error instanceof Error ? error.message : 'unknown_error',
      });
      return res.status(400).json({
        success: false,
        code: 'WHATSAPP_LINK_TOKEN_INVALID',
      });
    }

    if (!challenge) {
      return res.status(404).json({
        success: false,
        code: 'WHATSAPP_LINK_NOT_FOUND',
      });
    }

    const nowIso = now().toISOString();
    if (challenge.consumedAt) {
      return res.status(409).json({
        success: false,
        code: 'WHATSAPP_LINK_ALREADY_USED',
      });
    }
    if (Date.parse(challenge.expiresAt) < Date.parse(nowIso)) {
      return res.status(410).json({
        success: false,
        code: 'WHATSAPP_LINK_EXPIRED',
      });
    }

    const resolution = await options.contextProvider.resolve({
      authToken: authorization,
      requestedOrganizationId: challenge.organizationId,
    });

    if (resolution.status !== 'resolved') {
      const code = resolution.status === 'identity_required'
        ? 'AUTH_REQUIRED'
        : resolution.status === 'organization_required'
          ? 'ORGANIZATION_REQUIRED'
          : 'ORGANIZATION_ACCESS_DENIED';
      return res.status(code === 'AUTH_REQUIRED' ? 401 : 403).json({
        success: false,
        code,
      });
    }

    if (
      resolution.context.organizationId !== challenge.organizationId ||
      resolution.context.appAccess.musicscale !== true
    ) {
      return res.status(403).json({
        success: false,
        code: 'MUSICSCALE_ACCESS_REQUIRED',
      });
    }

    try {
      const binding = await options.store.consumeChallenge({
        token,
        actorUid: resolution.context.actorUid,
        now: nowIso,
      });

      logger.info?.('[CONNECT_WHATSAPP_LINK] linked', {
        organizationId: binding.organizationId,
        channelIdentityRef: `wa:${binding.channelIdentityHash.slice(0, 16)}`,
      });

      return res.status(200).json({
        success: true,
        linked: true,
        organizationId: binding.organizationId,
        channel: 'whatsapp',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      if (message === 'WHATSAPP_LINK_CHALLENGE_USED') {
        return res.status(409).json({
          success: false,
          code: 'WHATSAPP_LINK_ALREADY_USED',
        });
      }
      if (message === 'WHATSAPP_LINK_CHALLENGE_EXPIRED') {
        return res.status(410).json({
          success: false,
          code: 'WHATSAPP_LINK_EXPIRED',
        });
      }

      logger.error?.('[CONNECT_WHATSAPP_LINK] consume failed', {
        organizationId: challenge.organizationId,
        error: message,
      });
      return res.status(503).json({
        success: false,
        code: 'WHATSAPP_LINK_UNAVAILABLE',
        retryable: true,
      });
    }
  };
}
