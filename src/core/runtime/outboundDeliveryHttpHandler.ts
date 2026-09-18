import express from 'express';
import type { CanonicalContextProvider } from './connectCore';
import {
  buildOutboundDeliveryAuditRecord,
  evaluateOutboundDelivery,
  type OutboundDeliveryRequest,
} from '../services/outboundDelivery';

export interface OutboundDeliveryHttpHandlerOptions {
  contextProvider: CanonicalContextProvider;
  env?: NodeJS.ProcessEnv;
  logger?: {
    info(message: string, meta?: Record<string, unknown>): void;
    warn?(message: string, meta?: Record<string, unknown>): void;
    error?(message: string, meta?: Record<string, unknown>): void;
  };
}

function bearerFromRequest(req: express.Request): string {
  const value = req.headers.authorization;
  return typeof value === 'string' && /^Bearer\s+\S+$/i.test(value.trim())
    ? value.trim()
    : '';
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function safeText(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLength)
    : '';
}

/**
 * Validation-only outbound boundary.
 *
 * This endpoint never dispatches a provider message. It proves identity,
 * tenant, NestLocal app access, channel enablement and provider policy before
 * a later dispatch boundary is introduced.
 */
export function createOutboundDeliveryHttpHandler(
  options: OutboundDeliveryHttpHandlerOptions,
) {
  const env = options.env ?? process.env;
  const logger = options.logger ?? console;

  return async function outboundDeliveryHttpHandler(
    req: express.Request,
    res: express.Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    const authorization = bearerFromRequest(req);
    if (!authorization) {
      return res.status(401).json({
        status: 'blocked',
        code: 'AUTH_REQUIRED',
        dispatch: 'not_implemented',
      });
    }

    if (!plainRecord(req.body)) {
      return res.status(400).json({
        status: 'blocked',
        code: 'INVALID_REQUEST',
        dispatch: 'not_implemented',
      });
    }

    const organizationId = safeText(req.body.organizationId, 256);
    const sourceApp = safeText(req.body.sourceApp, 80).toLowerCase();
    if (!organizationId || organizationId.includes('/') || organizationId.includes('\\')) {
      return res.status(400).json({
        status: 'blocked',
        code: 'INVALID_REQUEST',
        dispatch: 'not_implemented',
      });
    }

    let resolution;
    try {
      resolution = await options.contextProvider.resolve({
        authToken: authorization,
        requestedOrganizationId: organizationId,
      });
    } catch {
      return res.status(503).json({
        status: 'blocked',
        code: 'CANONICAL_CONTEXT_UNAVAILABLE',
        dispatch: 'not_implemented',
      });
    }

    if (resolution.status !== 'resolved') {
      const status =
        resolution.status === 'identity_required'
          ? 401
          : resolution.status === 'organization_required'
            ? 409
            : 403;
      return res.status(status).json({
        status: 'blocked',
        code:
          resolution.status === 'identity_required'
            ? 'IDENTITY_REQUIRED'
            : resolution.status === 'organization_required'
              ? 'ORGANIZATION_REQUIRED'
              : 'CANONICAL_ACCESS_DENIED',
        dispatch: 'not_implemented',
      });
    }

    const { context } = resolution;
    if (context.organizationId !== organizationId) {
      return res.status(409).json({
        status: 'blocked',
        code: 'TENANT_MISMATCH',
        dispatch: 'not_implemented',
      });
    }

    if (context.appAccess.nestlocal !== true) {
      return res.status(403).json({
        status: 'blocked',
        code: 'NESTLOCAL_ACCESS_DENIED',
        dispatch: 'not_implemented',
      });
    }

    const request = req.body as unknown as OutboundDeliveryRequest;
    const channelValidationEnabled =
      env.CONNECT_WHATSAPP_OUTBOUND_VALIDATION_ENABLED?.trim().toLowerCase() === 'true';

    const authority = {
      organizationId: context.organizationId,
      sourceApp: 'nestlocal',
      capabilities: channelValidationEnabled ? ['channels.whatsapp.send'] : [],
    };

    const decision = evaluateOutboundDelivery(authority, request);
    const audit = buildOutboundDeliveryAuditRecord(authority, request, decision);

    logger.info('CONNECT_OUTBOUND_VALIDATION', {
      ...audit,
      actor: context.actorUid.length > 6
        ? `${context.actorUid.slice(0, 3)}***${context.actorUid.slice(-3)}`
        : '***',
      validationOnly: true,
      providerPolicy: decision.providerPolicy
        ? {
            resourceId: decision.providerPolicy.resourceId,
            status: decision.providerPolicy.status,
            reason: decision.providerPolicy.reason,
            financialCostBrl: decision.providerPolicy.financialCostBrl,
          }
        : undefined,
    });

    return res.status(200).json({
      status: decision.status,
      reason: decision.reason,
      providerPolicy: decision.providerPolicy,
      dispatch: 'not_implemented',
      validationOnly: true,
      validated: {
        organizationId: context.organizationId,
        sourceApp,
        channel: safeText(req.body.channel, 40),
        category: safeText(req.body.category, 80),
        templateName: safeText(req.body.templateName, 512),
        consentEvidenceRef: safeText(req.body.consentEvidenceRef, 260),
        idempotencyKey: safeText(req.body.idempotencyKey, 220),
      },
    });
  };
}
