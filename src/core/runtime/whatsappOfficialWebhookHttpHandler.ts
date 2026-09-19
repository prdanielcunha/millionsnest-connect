import express from 'express';
import {
  normalizeWhatsAppWebhookEnvelope,
  verifyWhatsAppSignature,
  verifyWhatsAppWebhookChallenge,
  type WhatsAppNormalizedEvent,
} from '../channels/whatsappOfficial';

export interface WhatsAppWebhookIngestor {
  ingest(events: WhatsAppNormalizedEvent[]): Promise<void>;
}

export interface WhatsAppOfficialWebhookHandlerOptions {
  env?: NodeJS.ProcessEnv;
  ingestor?: WhatsAppWebhookIngestor;
  logger?: {
    info(message: string, meta?: Record<string, unknown>): void;
    warn?(message: string, meta?: Record<string, unknown>): void;
    error?(message: string, meta?: Record<string, unknown>): void;
  };
}

function enabled(env: NodeJS.ProcessEnv, key: string): boolean {
  return env[key]?.trim().toLowerCase() === 'true';
}

function safeSecret(env: NodeJS.ProcessEnv, key: string): string {
  return env[key]?.trim() || '';
}

export function createWhatsAppWebhookVerificationHandler(
  options: WhatsAppOfficialWebhookHandlerOptions,
) {
  const env = options.env ?? process.env;
  return function whatsappWebhookVerificationHandler(
    req: express.Request,
    res: express.Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');

    if (!enabled(env, 'CONNECT_WHATSAPP_WEBHOOK_ENABLED')) {
      return res.status(404).send('not found');
    }

    const verifyToken = safeSecret(env, 'CONNECT_WHATSAPP_WEBHOOK_VERIFY_TOKEN');
    if (!verifyToken) {
      return res.status(503).json({
        success: false,
        code: 'WHATSAPP_VERIFY_TOKEN_MISSING',
      });
    }

    const result = verifyWhatsAppWebhookChallenge(
      req.query as Record<string, unknown>,
      verifyToken,
    );
    if (!result.ok) {
      return res.status(403).send('forbidden');
    }

    return res.status(200).type('text/plain').send(result.challenge);
  };
}

export function createWhatsAppWebhookIngressHandler(
  options: WhatsAppOfficialWebhookHandlerOptions,
) {
  const env = options.env ?? process.env;
  const logger = options.logger ?? console;

  return async function whatsappWebhookIngressHandler(
    req: express.Request,
    res: express.Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');

    if (!enabled(env, 'CONNECT_WHATSAPP_WEBHOOK_ENABLED')) {
      return res.status(404).json({
        success: false,
        code: 'WHATSAPP_WEBHOOK_DISABLED',
      });
    }

    const appSecret = safeSecret(env, 'CONNECT_WHATSAPP_APP_SECRET');
    if (!appSecret) {
      return res.status(503).json({
        success: false,
        code: 'WHATSAPP_APP_SECRET_MISSING',
      });
    }

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : '');

    if (!rawBody.length) {
      return res.status(400).json({
        success: false,
        code: 'WHATSAPP_EMPTY_WEBHOOK_BODY',
      });
    }

    const signatureHeader = typeof req.headers['x-hub-signature-256'] === 'string'
      ? req.headers['x-hub-signature-256']
      : undefined;

    if (!verifyWhatsAppSignature(rawBody, signatureHeader, appSecret)) {
      logger.warn?.('CONNECT_WHATSAPP_WEBHOOK_SIGNATURE_REJECTED', {
        bodyBytes: rawBody.length,
      });
      return res.status(401).json({
        success: false,
        code: 'WHATSAPP_SIGNATURE_INVALID',
      });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({
        success: false,
        code: 'WHATSAPP_WEBHOOK_INVALID_JSON',
      });
    }

    const events = normalizeWhatsAppWebhookEnvelope(payload);

    // Provider may send account-level events we intentionally do not consume.
    // A valid signed envelope with no supported message/status is safe to ack.
    if (events.length === 0) {
      return res.status(200).json({ success: true, accepted: 0 });
    }

    if (!options.ingestor) {
      logger.warn?.('CONNECT_WHATSAPP_WEBHOOK_INGESTION_NOT_READY', {
        eventCount: events.length,
        messageCount: events.filter((event) => event.kind === 'message').length,
        statusCount: events.filter((event) => event.kind === 'status').length,
      });
      // Fail closed instead of acknowledging and silently dropping real messages.
      return res.status(503).json({
        success: false,
        code: 'WHATSAPP_INGESTION_NOT_READY',
      });
    }

    try {
      await options.ingestor.ingest(events);
    } catch (error) {
      logger.error?.('CONNECT_WHATSAPP_WEBHOOK_INGESTION_FAILED', {
        eventCount: events.length,
        error: error instanceof Error ? error.message : 'unknown_error',
      });
      return res.status(503).json({
        success: false,
        code: 'WHATSAPP_INGESTION_FAILED',
      });
    }

    logger.info('CONNECT_WHATSAPP_WEBHOOK_ACCEPTED', {
      eventCount: events.length,
      messageCount: events.filter((event) => event.kind === 'message').length,
      statusCount: events.filter((event) => event.kind === 'status').length,
    });

    return res.status(200).json({
      success: true,
      accepted: events.length,
    });
  };
}
