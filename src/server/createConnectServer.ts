import express from 'express';
import { ConnectCoreService } from '../core/runtime/connectCore';
import { createConnectCoreHttpHandler } from '../core/runtime/connectCoreHttpHandler';
import { createConnectCoreRuntime } from '../core/runtime/connectCoreRuntimeFactory';
import { createConnectSessionHttpHandler } from '../core/runtime/connectSessionHttpHandler';

export interface CreateConnectServerOptions {
  core?: ConnectCoreService;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  logger?: {
    info(message: string, meta?: Record<string, unknown>): void;
    error?(message: string, meta?: Record<string, unknown>): void;
  };
}

/**
 * Minimal API server for the first real Connect Core in-app vertical.
 *
 * The live browser receives only a Firebase identity token. Hub remains the
 * canonical source for tenant/RBAC context and every MusicScale read is still
 * revalidated by the downstream app.
 */
export function createConnectServer(options: CreateConnectServerOptions = {}) {
  const app = express();
  const logger = options.logger ?? console;
  const env = options.env ?? process.env;
  let core = options.core ?? null;
  let handler: ReturnType<typeof createConnectCoreHttpHandler> | null = core
    ? createConnectCoreHttpHandler(core)
    : null;

  let sessionHandler: ReturnType<typeof createConnectSessionHttpHandler> | null = null;
  const hubOrigin = env.MILLIONSNEST_HUB_ORIGIN?.trim();
  if (hubOrigin) {
    try {
      sessionHandler = createConnectSessionHttpHandler({
        hubOrigin,
        fetchImpl: options.fetchImpl,
      });
    } catch (error) {
      logger.error?.('CONNECT_SESSION_CONFIGURATION_ERROR', {
        error: error instanceof Error ? error.message : 'unknown_error',
      });
    }
  }

  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      service: 'millionsnest-connect-core',
      protocolVersion: '1.0.0',
    });
  });

  app.get('/api/core/session', async (req, res) => {
    if (!sessionHandler) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({
        success: false,
        code: 'CORE_CONFIGURATION_MISSING',
        humanSummary: 'O Connect Core ainda não está configurado neste ambiente.',
      });
    }
    return sessionHandler(req, res);
  });

  app.post('/api/core/message', async (req, res) => {
    if (!handler) {
      try {
        core = createConnectCoreRuntime({
          env,
          logger,
          fetchImpl: options.fetchImpl,
        });
        handler = createConnectCoreHttpHandler(core);
      } catch (error) {
        logger.error?.('CONNECT_CORE_CONFIGURATION_ERROR', {
          error: error instanceof Error ? error.message : 'unknown_error',
        });
        res.setHeader('Cache-Control', 'no-store');
        return res.status(503).json({
          status: 'failed',
          code: 'CORE_CONFIGURATION_MISSING',
          humanSummary: 'O Connect Core ainda não está configurado neste ambiente.',
        });
      }
    }

    return handler(req, res);
  });

  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({
        status: 'failed',
        code: 'PAYLOAD_TOO_LARGE',
        humanSummary: 'A mensagem enviada é grande demais.',
      });
    }
    if (error instanceof SyntaxError) {
      return res.status(400).json({
        status: 'failed',
        code: 'INVALID_JSON_BODY',
        humanSummary: 'O corpo da requisição é inválido.',
      });
    }

    logger.error?.('CONNECT_CORE_HTTP_ERROR', {
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    return res.status(500).json({
      status: 'failed',
      code: 'INTERNAL_ERROR',
      humanSummary: 'O Connect encontrou um erro inesperado.',
    });
  });

  return app;
}
