import express from 'express';
import { HubChannelGrantError } from './hubChannelGrantHttpClient';
import type { WhatsAppAssistOrchestrator } from './whatsappAssistOrchestrator';

function bearer(req: express.Request): string {
  const raw = req.headers.authorization;
  if (typeof raw !== 'string' || !/^Bearer\s+\S+$/i.test(raw.trim())) return '';
  return raw.trim().replace(/^Bearer\s+/i, '');
}

function clean(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function createConnectChannelLinkConfirmHttpHandler(options: {
  orchestrator: WhatsAppAssistOrchestrator;
  logger?: {
    info(message: string, meta?: Record<string, unknown>): void;
    warn?(message: string, meta?: Record<string, unknown>): void;
    error?(message: string, meta?: Record<string, unknown>): void;
  };
}) {
  return async function connectChannelLinkConfirmHttpHandler(
    req: express.Request,
    res: express.Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');

    const authToken = bearer(req);
    if (!authToken) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        humanSummary: 'Entre na sua conta MillionsNest para vincular este WhatsApp.',
      });
    }

    const token = clean(req.body?.token, 4096);
    const organizationId = clean(req.body?.organizationId, 180);
    if (!token || !organizationId || organizationId.includes('/') || organizationId.includes('\\')) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_LINK_REQUEST',
        humanSummary: 'O pedido de vinculação é inválido.',
      });
    }

    try {
      const result = await options.orchestrator.confirmLink({
        token,
        authToken,
        targetOrganizationId: organizationId,
      });
      return res.status(200).json({
        ...result,
        humanSummary: result.answerTriggered
          ? 'WhatsApp vinculado. Estou continuando sua solicitação por lá.'
          : 'WhatsApp vinculado com segurança à sua conta.',
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'CHANNEL_LINK_FAILED';

      if (error instanceof HubChannelGrantError) {
        const status = error.status === 401 ? 401 : error.status === 403 ? 403 : 503;
        return res.status(status).json({
          success: false,
          code: error.code,
          humanSummary: status === 403
            ? 'Sua conta não possui acesso à organização selecionada.'
            : status === 401
              ? 'Sua sessão expirou. Entre novamente para vincular este WhatsApp.'
              : 'Não consegui confirmar a vinculação agora. Tente novamente.',
        });
      }

      if (code === 'WHATSAPP_LINK_TOKEN_EXPIRED') {
        return res.status(410).json({
          success: false,
          code,
          humanSummary: 'Este link expirou. Envie novamente sua pergunta pelo WhatsApp para receber um novo link.',
        });
      }

      if (
        code === 'WHATSAPP_LINK_TOKEN_INVALID' ||
        code === 'WHATSAPP_LINK_EVIDENCE_MISMATCH'
      ) {
        return res.status(400).json({
          success: false,
          code,
          humanSummary: 'Este link de vinculação não é válido.',
        });
      }

      options.logger?.error?.('CONNECT_WHATSAPP_CHANNEL_LINK_FAILED', {
        code: code.slice(0, 180),
      });
      return res.status(503).json({
        success: false,
        code: 'CHANNEL_LINK_FAILED',
        humanSummary: 'Não consegui vincular este WhatsApp agora. Tente novamente.',
      });
    }
  };
}
