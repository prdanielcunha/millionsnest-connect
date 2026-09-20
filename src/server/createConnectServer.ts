import express from 'express';
import {
  ConnectCoreService,
  type CanonicalContextProvider,
} from '../core/runtime/connectCore';
import { createConnectCoreHttpHandler } from '../core/runtime/connectCoreHttpHandler';
import { createConnectCoreRuntime } from '../core/runtime/connectCoreRuntimeFactory';
import { createConnectSessionHttpHandler } from '../core/runtime/connectSessionHttpHandler';
import { HubSessionContextHttpProvider } from '../core/runtime/hubSessionContextHttpProvider';
import { createOutboundDeliveryHttpHandler } from '../core/runtime/outboundDeliveryHttpHandler';
import { createNestJourneyFollowupContextHttpHandler } from '../core/runtime/nestJourneyFollowupContextHttpHandler';
import { createConnectChannelReadinessHttpHandler } from '../core/runtime/connectChannelReadinessHttpHandler';
import {
  createWhatsAppWebhookIngressHandler,
  createWhatsAppWebhookVerificationHandler,
} from '../core/runtime/whatsappOfficialWebhookHttpHandler';
import {
  probeConnectRuntimeFirestoreReadiness,
  type ConnectRuntimeFirestoreReadiness,
} from '../core/runtime/firestoreRuntimeReadiness';
import {
  createConnectInboxThreadCommandHttpHandler,
  createConnectInboxThreadReadHttpHandler,
} from '../core/runtime/connectInboxThreadHttpHandler';
import { createConnectInboxReadinessHttpHandler } from '../core/runtime/connectInboxReadinessHttpHandler';
import { createConnectOperationalReadinessHttpHandler } from '../core/runtime/connectOperationalReadinessHttpHandler';
import { FirestoreConnectThreadStore } from '../core/inbox/firestoreThreadStore';
import { ReadinessGatedConnectThreadStore } from '../core/inbox/readinessGatedThreadStore';
import type { ConnectThreadStore } from '../core/inbox/threadStore';
import {
  FirestoreMessageContentStore,
} from '../core/inbox/firestoreMessageContentStore';
import type { ConnectMessageContentStore } from '../core/inbox/messageContentStore';
import { WhatsAppInboxIngestor } from '../core/inbox/whatsappInboxIngestor';
import {
  WhatsAppConnectionRegistry,
  parseWhatsAppConnectionBindings,
} from '../core/channels/whatsappConnectionRegistry';
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
  inboxContextProvider?: CanonicalContextProvider;
  inboxStore?: ConnectThreadStore;
  inboxMessageContentStore?: ConnectMessageContentStore;
  whatsappConnectionRegistry?: WhatsAppConnectionRegistry;
  inboxStorageReadinessProbe?: () => Promise<ConnectRuntimeFirestoreReadiness>;
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
  const storageReadinessProbeEnabled =
    env.CONNECT_STORAGE_READINESS_PROBE_ENABLED?.trim().toLowerCase() === 'true';
  const durableInboxEnabled =
    env.CONNECT_INBOX_DURABLE_ENABLED?.trim().toLowerCase() === 'true';
  const messageContentEnabled =
    env.CONNECT_INBOX_MESSAGE_CONTENT_ENABLED?.trim().toLowerCase() === 'true';
  const whatsappIngestionEnabled =
    env.CONNECT_WHATSAPP_INGESTION_ENABLED?.trim().toLowerCase() === 'true';
  let core = options.core ?? null;
  let handler: ReturnType<typeof createConnectCoreHttpHandler> | null = core
    ? createConnectCoreHttpHandler(core)
    : null;

  let sessionHandler: ReturnType<typeof createConnectSessionHttpHandler> | null = null;
  let outboundValidationHandler: ReturnType<typeof createOutboundDeliveryHttpHandler> | null = null;
  let journeyFollowupHandler: ReturnType<typeof createNestJourneyFollowupContextHttpHandler> | null = null;
  let channelReadinessHandler: ReturnType<typeof createConnectChannelReadinessHttpHandler> | null = null;
  const whatsappWebhookVerificationHandler = createWhatsAppWebhookVerificationHandler({ env, logger });
  let whatsappWebhookIngressHandler = createWhatsAppWebhookIngressHandler({ env, logger });
  let radarCloudSyncRouter: ReturnType<typeof createRadarCloudSyncRouter> | null = null;
  let personalRadarRouter: ReturnType<typeof createPersonalRadarRouter> | null = null;
  let personalSourcesRouter: ReturnType<typeof createPersonalSourcesRouter> | null = null;
  let personalIntelligenceRouter: ReturnType<typeof createPersonalIntelligenceRouter> | null = null;
  let inboxReadHandler: ReturnType<typeof createConnectInboxThreadReadHttpHandler> | null = null;
  let inboxCommandHandler: ReturnType<typeof createConnectInboxThreadCommandHttpHandler> | null = null;
  let inboxReadinessHandler: ReturnType<typeof createConnectInboxReadinessHttpHandler> | null = null;
  let operationalReadinessHandler: ReturnType<typeof createConnectOperationalReadinessHttpHandler> | null = null;
  let inboxContextProvider = options.inboxContextProvider ?? null;
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
      if (!inboxContextProvider) {
        inboxContextProvider = personalContextProvider;
      }
      inboxReadinessHandler = createConnectInboxReadinessHttpHandler({
        contextProvider: personalContextProvider,
        env,
        storageReadinessProbe: options.inboxStorageReadinessProbe,
      });
      operationalReadinessHandler = createConnectOperationalReadinessHttpHandler({
        contextProvider: personalContextProvider,
        env,
        storageReadinessProbe: options.inboxStorageReadinessProbe,
      });
      outboundValidationHandler = createOutboundDeliveryHttpHandler({
        contextProvider: personalContextProvider,
        env,
        logger,
      });
      journeyFollowupHandler = createNestJourneyFollowupContextHttpHandler({
        contextProvider: personalContextProvider,
        hubOrigin,
        fetchImpl: options.fetchImpl,
      });
      channelReadinessHandler = createConnectChannelReadinessHttpHandler({
        contextProvider: personalContextProvider,
        env,
        storageReadinessProbe: options.inboxStorageReadinessProbe,
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

  if (durableInboxEnabled && inboxContextProvider) {
    try {
      const projectId =
        env.FIREBASE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || 'millionsnest';
      const durableStore = options.inboxStore ?? new FirestoreConnectThreadStore({
        projectId,
        fetchImpl: options.fetchImpl,
      });
      const readinessProbe = options.inboxStorageReadinessProbe ?? (() =>
        probeConnectRuntimeFirestoreReadiness({
          projectId,
          fetchImpl: options.fetchImpl,
        }));
      const gatedStore = new ReadinessGatedConnectThreadStore(
        durableStore,
        readinessProbe,
      );
      inboxReadHandler = createConnectInboxThreadReadHttpHandler({
        contextProvider: inboxContextProvider,
        store: gatedStore,
      });
      inboxCommandHandler = createConnectInboxThreadCommandHttpHandler({
        contextProvider: inboxContextProvider,
        store: gatedStore,
      });

      if (messageContentEnabled && whatsappIngestionEnabled) {
        const messageStore = options.inboxMessageContentStore
          ?? new FirestoreMessageContentStore({
            projectId,
            fetchImpl: options.fetchImpl,
          });
        const registry = options.whatsappConnectionRegistry
          ?? new WhatsAppConnectionRegistry(parseWhatsAppConnectionBindings(env));

        if (registry.size > 0) {
          const ingestor = new WhatsAppInboxIngestor(
            registry,
            messageStore,
            gatedStore,
          );
          whatsappWebhookIngressHandler = createWhatsAppWebhookIngressHandler({
            env,
            logger,
            ingestor,
          });
        } else {
          logger.warn?.('CONNECT_WHATSAPP_INGESTION_BINDING_MISSING');
        }
      }
    } catch (error) {
      logger.error?.('CONNECT_INBOX_CONFIGURATION_ERROR', {
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

  // Meta webhook signature validation must receive the exact raw request bytes.
  // Keep these routes ahead of the global JSON parser.
  app.get('/api/channels/whatsapp/webhook', whatsappWebhookVerificationHandler);
  app.post(
    '/api/channels/whatsapp/webhook',
    express.raw({ type: 'application/json', limit: '256kb' }),
    whatsappWebhookIngressHandler,
  );

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

  app.get('/api/health/storage-readiness', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    if (!storageReadinessProbeEnabled) {
      return res.status(404).json({
        success: false,
        code: 'STORAGE_READINESS_PROBE_DISABLED',
      });
    }

    const readiness = await probeConnectRuntimeFirestoreReadiness({
      projectId: env.FIREBASE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || 'millionsnest',
      fetchImpl: options.fetchImpl,
    });

    return res.status(200).json({
      success: true,
      service: 'millionsnest-connect-core',
      storageReadiness: readiness.state,
      source: readiness.source,
    });
  });

  app.get('/api/core/operations/readiness', async (req, res) => {
    if (!operationalReadinessHandler) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({
        success: false,
        code: 'CORE_CONFIGURATION_MISSING',
      });
    }
    return operationalReadinessHandler(req, res);
  });

  app.get('/api/core/inbox/readiness', async (req, res) => {
    if (!inboxReadinessHandler) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({
        success: false,
        code: 'CORE_CONFIGURATION_MISSING',
      });
    }
    return inboxReadinessHandler(req, res);
  });

  app.get('/api/core/inbox/threads/:conversationId', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!durableInboxEnabled) {
      return res.status(404).json({
        success: false,
        code: 'INBOX_DURABLE_DISABLED',
      });
    }
    if (!inboxReadHandler) {
      return res.status(503).json({
        success: false,
        code: 'INBOX_RUNTIME_CONFIGURATION_MISSING',
      });
    }
    return inboxReadHandler(req, res);
  });

  app.post('/api/core/inbox/threads/:conversationId/actions', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!durableInboxEnabled) {
      return res.status(404).json({
        success: false,
        code: 'INBOX_DURABLE_DISABLED',
      });
    }
    if (!inboxCommandHandler) {
      return res.status(503).json({
        success: false,
        code: 'INBOX_RUNTIME_CONFIGURATION_MISSING',
      });
    }
    return inboxCommandHandler(req, res);
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

  app.get('/api/core/channels/readiness', async (req, res) => {
    if (!channelReadinessHandler) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({
        success: false,
        code: 'CORE_CONFIGURATION_MISSING',
      });
    }
    return channelReadinessHandler(req, res);
  });

  app.get('/api/core/nestjourney/followup', async (req, res) => {
    if (!journeyFollowupHandler) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({
        success: false,
        code: 'CORE_CONFIGURATION_MISSING',
      });
    }
    return journeyFollowupHandler(req, res);
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
