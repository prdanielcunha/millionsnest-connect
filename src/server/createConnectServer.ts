import express from 'express';
import { ConnectCoreService } from '../core/runtime/connectCore';
import { createConnectCoreHttpHandler } from '../core/runtime/connectCoreHttpHandler';
import { createConnectCoreRuntime } from '../core/runtime/connectCoreRuntimeFactory';
import { createConnectSessionHttpHandler } from '../core/runtime/connectSessionHttpHandler';
import { HubSessionContextHttpProvider } from '../core/runtime/hubSessionContextHttpProvider';
import { createOutboundDeliveryHttpHandler } from '../core/runtime/outboundDeliveryHttpHandler';
import { FirestorePersonalVault } from '../personal/storage/firestorePersonalVault';
import { PersonalRadarService } from '../personal/radar/personalRadarService';
import { createPersonalRadarRouter } from '../personal/radar/personalRadarHttp';
import { RadarCloudSyncService } from '../personal/radar/radarCloudSyncService';
import { createRadarCloudSyncRouter } from '../personal/radar/radarCloudSyncHttp';
import { PersonalSourcesService } from '../personal/sources/personalSourcesService';
import { createPersonalSourcesRouter } from '../personal/sources/personalSourcesHttp';
import { PersonalIntelligenceService } from '../personal/intelligence/personalIntelligenceService';
import { createPersonalIntelligenceRouter } from '../personal/intelligence/personalIntelligenceHttp';

export interface CreateConnectServerOptions {
  core?: ConnectCoreService;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  logger?: {
    info(message: string, meta?: Record<string, unknown>): void;
    warn?(message: string, meta?: Record<string, unknown>): void;
    error?(message: string, meta?: Record<string, unknown>): void;
  };
}

/**
 * MillionsNest Connect server composition root.
 *
 * Hub remains the identity/RBAC authority, MusicScale revalidates its own reads,
 * and Personal Sources use the caller's Firebase bearer against owner-scoped
 * Firestore Rules. Relationship Intelligence stays inside that same owner-only
 * vault and never auto-promotes personal contacts into an organization CRM.
 */
export function createConnectServer(options: CreateConnectServerOptions = {}) {
  const app = express();
  const logger = options.logger ?? console;
  const env = options.env ?? process.env;
  const releaseSha = env.CONNECT_RELEASE_SHA?.trim();
  let core = options.core ?? null;
  let handler: ReturnType<typeof createConnectCoreHttpHandler> | null = core
    ? createConnectCoreHttpHandler(core)
    : null;

  let sessionHandler: ReturnType<typeof createConnectSessionHttpHandler> | null = null;
  let outboundValidationHandler: ReturnType<typeof createOutboundDeliveryHttpHandler> | null = null;
  let radarCloudSyncRouter: ReturnType<typeof createRadarCloudSyncRouter> | null = null;
  let personalRadarRouter: ReturnType<typeof createPersonalRadarRouter> | null = null;
  let personalSourcesRouter: ReturnType<typeof createPersonalSourcesRouter> | null = null;
  let personalIntelligenceRouter: ReturnType<typeof createPersonalIntelligenceRouter> | null = null;
  const hubOrigin = env.MILLIONSNEST_HUB_ORIGIN?.trim();
  if (hubOrigin) {
    try {
      sessionHandler = createConnectSessionHttpHandler({
        hubOrigin,
        fetchImpl: options.fetchImpl,
      });

      const personalContextProvider = new HubSessionContextHttpProvider({
        hubOrigin,
        fetchImpl: options.fetchImpl
          ? ((input: string, init: any) => options.fetchImpl!(input, init) as any)
          : undefined,
      });
      outboundValidationHandler = createOutboundDeliveryHttpHandler({
        contextProvider: personalContextProvider,
        env,
        logger,
      });
      const vault = new FirestorePersonalVault({
        projectId: env.FIREBASE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || 'millionsnest',
        fetchImpl: options.fetchImpl,
      });
      const personalRadar = new PersonalRadarService(
        personalContextProvider,
        vault,
        Date.now,
        logger,
      );
      const radarCloudSync = new RadarCloudSyncService(
        personalContextProvider,
        vault,
        Date.now,
        logger,
      );
      const personalSources = new PersonalSourcesService(
        personalContextProvider,
        vault,
        personalRadar,
        Date.now,
        logger,
      );
      const personalIntelligence = new PersonalIntelligenceService(
        personalContextProvider,
        vault,
        personalSources,
        env,
        Date.now,
      );
      radarCloudSyncRouter = createRadarCloudSyncRouter(radarCloudSync, personalRadar);
      personalRadarRouter = createPersonalRadarRouter(personalRadar);
      personalSourcesRouter = createPersonalSourcesRouter(personalSources);
      personalIntelligenceRouter = createPersonalIntelligenceRouter(personalIntelligence);
    } catch (error) {
      logger.error?.('CONNECT_SESSION_CONFIGURATION_ERROR', {
        error: error instanceof Error ? error.message : 'unknown_error',
      });
    }
  }

  app.disable('x-powered-by');

  if (personalSourcesRouter) {
    app.use('/api/personal/v2', personalSourcesRouter);
  }
  if (personalIntelligenceRouter) {
    app.use('/api/personal/intelligence', personalIntelligenceRouter);
  }
  if (radarCloudSyncRouter) {
    app.use('/api/personal', radarCloudSyncRouter);
  }
  if (personalRadarRouter) {
    app.use('/api/personal', personalRadarRouter);
  }
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      service: 'millionsnest-connect-core',
      protocolVersion: '1.0.0',
      releaseSha: releaseSha || undefined,
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

  app.post('/api/core/outbound/validate', async (req, res) => {
    if (!outboundValidationHandler) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({
        status: 'blocked',
        code: 'CORE_CONFIGURATION_MISSING',
        dispatch: 'not_implemented',
      });
    }
    return outboundValidationHandler(req, res);
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
