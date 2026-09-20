import express from 'express';
import type {
  CanonicalContextProvider,
  CanonicalContextResolution,
} from './connectCore';
import { evaluateConnectInboxAuthority } from '../inbox/inboxAuthority';
import type { HumanReplyService } from '../inbox/humanReplyService';
import { isWhatsAppHumanReplyConfigured } from '../channels/metaWhatsAppProvider';

export interface ConnectInboxHumanReplyHttpHandlerOptions {
  contextProvider: CanonicalContextProvider;
  service: HumanReplyService;
  env?: NodeJS.ProcessEnv;
  logger?: {
    info(message: string, meta?: Record<string, unknown>): void;
    warn?(message: string, meta?: Record<string, unknown>): void;
    error?(message: string, meta?: Record<string, unknown>): void;
  };
}

function bearer(req: express.Request): string {
  const value = req.headers.authorization;
  return typeof value === 'string' && /^Bearer\s+\S+$/i.test(value.trim())
    ? value.trim()
    : '';
}

function safeId(value: unknown, maxLength = 180): string {
  if (typeof value !== 'string') return '';
  const clean = value.trim();
  if (!clean || clean.length > maxLength || clean.includes('/') || clean.includes('\\')) return '';
  return clean;
}

function safeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const clean = value.replace(/\u0000/g, '').trim();
  return clean.length <= 4096 ? clean : '';
}

function resolutionError(resolution: CanonicalContextResolution) {
  if (resolution.status === 'identity_required') return { status: 401, code: 'IDENTITY_REQUIRED' };
  if (resolution.status === 'organization_required') return { status: 400, code: 'ORGANIZATION_REQUIRED' };
  return { status: 403, code: 'CANONICAL_ACCESS_DENIED' };
}

function publicFailure(error: unknown): { status: number; code: string } {
  const code = error instanceof Error ? error.message : '';
  if (code === 'THREAD_NOT_FOUND') return { status: 404, code };
  if (code === 'THREAD_MUST_REOPEN') return { status: 409, code };
  if (
    code === 'WHATSAPP_RECIPIENT_CONTEXT_MISSING' ||
    code === 'WHATSAPP_CONNECTION_NOT_MAPPED'
  ) {
    return { status: 409, code };
  }
  if (
    code === 'HUMAN_REPLY_DISPATCH_IN_PROGRESS' ||
    code === 'HUMAN_REPLY_PREVIOUSLY_FAILED' ||
    code === 'HUMAN_REPLY_REQUIRES_REVIEW' ||
    code === 'HUMAN_REPLY_ACCEPTED_PERSISTENCE_INCOMPLETE'
  ) {
    return { status: 409, code };
  }
  if (
    code === 'WHATSAPP_REPLY_TEXT_INVALID' ||
    code === 'HUMAN_REPLY_REQUEST_ID_INVALID' ||
    code === 'HUMAN_REPLY_IDEMPOTENCY_COLLISION'
  ) {
    return { status: 400, code };
  }
  if (code.startsWith('WHATSAPP_PROVIDER_REJECTED:')) {
    return { status: 502, code: 'WHATSAPP_PROVIDER_REJECTED' };
  }
  if (code === 'WHATSAPP_PROVIDER_TIMEOUT') {
    return { status: 504, code };
  }
  return { status: 503, code: 'HUMAN_REPLY_UNAVAILABLE' };
}

export function createConnectInboxHumanReplyHttpHandler(
  options: ConnectInboxHumanReplyHttpHandlerOptions,
) {
  const env = options.env ?? process.env;
  const logger = options.logger ?? console;

  return async function connectInboxHumanReplyHttpHandler(
    req: express.Request,
    res: express.Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    const authorization = bearer(req);
    if (!authorization) {
      return res.status(401).json({ success: false, code: 'AUTH_REQUIRED' });
    }

    const organizationId = safeId(req.body?.organizationId);
    const conversationId = safeId(req.params.conversationId);
    const requestId = safeId(req.body?.requestId);
    const text = safeText(req.body?.text);

    if (!organizationId || !conversationId || !requestId || !text) {
      return res.status(400).json({ success: false, code: 'HUMAN_REPLY_REQUEST_INVALID' });
    }

    const allowedFields = new Set(['organizationId', 'requestId', 'text']);
    if (
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body) ||
      Object.keys(req.body).some((key) => !allowedFields.has(key))
    ) {
      return res.status(400).json({ success: false, code: 'UNKNOWN_FIELD' });
    }

    let resolution: CanonicalContextResolution;
    try {
      resolution = await options.contextProvider.resolve({
        authToken: authorization,
        requestedOrganizationId: organizationId,
      });
    } catch {
      return res.status(503).json({
        success: false,
        code: 'CANONICAL_CONTEXT_UNAVAILABLE',
      });
    }

    if (resolution.status !== 'resolved') {
      const mapped = resolutionError(resolution);
      return res.status(mapped.status).json({ success: false, code: mapped.code });
    }

    if (resolution.context.organizationId !== organizationId) {
      return res.status(409).json({
        success: false,
        code: 'ORGANIZATION_CONTEXT_MISMATCH',
      });
    }

    const authority = evaluateConnectInboxAuthority(resolution.context, 'manage');
    if ('reason' in authority) {
      return res.status(403).json({
        success: false,
        code: authority.reason,
      });
    }

    if (!isWhatsAppHumanReplyConfigured(env)) {
      return res.status(409).json({
        success: false,
        code: 'HUMAN_REPLY_NOT_READY',
      });
    }

    try {
      const result = await options.service.send({
        organizationId,
        conversationId,
        requestId,
        text,
      });

      logger.info('CONNECT_INBOX_HUMAN_REPLY', {
        organizationId,
        conversationId,
        actorUid: resolution.context.actorUid.length > 6
          ? `${resolution.context.actorUid.slice(0, 3)}***${resolution.context.actorUid.slice(-3)}`
          : '***',
        requestId,
        outcome: result.kind,
        deliveryStatus: result.deliveryStatus,
      });

      return res.status(result.kind === 'sent' ? 201 : 200).json({
        success: true,
        kind: result.kind,
        conversationId,
        messageId: result.messageId,
        deliveryStatus: result.deliveryStatus,
      });
    } catch (error) {
      const mapped = publicFailure(error);
      logger.warn?.('CONNECT_INBOX_HUMAN_REPLY_BLOCKED', {
        organizationId,
        conversationId,
        requestId,
        code: mapped.code,
      });
      return res.status(mapped.status).json({
        success: false,
        code: mapped.code,
      });
    }
  };
}
