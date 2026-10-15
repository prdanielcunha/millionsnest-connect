import { resolveExecutionSecretBundle } from './executionSecretBundle';
import { createNestFinancePendingDocumentsHttpHandler, createNestFinanceEntitiesHttpHandler } from '../core/runtime/nestFinancePendingDocumentsHttpHandler';
import { homologationReadOnly } from './homologationReadOnly';
import { createSupportOriginHttpHandler } from '../core/routing/supportOriginHttpHandler';
import { createSupportDraftHttpHandler } from '../core/routing/supportDraftHttpHandler';
import { FirestoreAutomationJobStore, InternalAutomationWorker, validateAutomationEvent, jobId } from '../core/automations/eventJobs';
import { createAutomationEventHandler, createAutomationWorkerHandler, createAutomationJobsReadHandler } from '../core/automations/automationEventHttp';
import { createConversationIdFromChannelIdentity, createProviderMessageIndexId } from '../core/inbox/messageContentStore';
import { FirestoreProductRouteStore } from '../core/routing/firestoreProductRouteStore';
import { WhatsAppProductRouting } from '../core/routing/whatsappProductRouting';
import { parseProductSupportOwners } from '../core/routing/productRouting';
import { createProductAgentProfilesHandler, createProductAgentSettingsHandler } from '../core/agents/productAgentProfilesHttp';
import { FirestoreProductAgentSettingsStore } from '../core/agents/firestoreProductAgentSettingsStore';
import { FirestorePushStore } from '../core/push/firestorePushStore';
import { InboxPushService, createWebPushSender } from '../core/push/inboxPushService';
import { createPushRouter } from '../core/push/pushHttpRouter';
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
import { createJourneyTemplateDispatchHandler,createJourneyTemplateReadinessHandler,isJourneyTemplateDispatchConfigured } from '../core/runtime/nestJourneyTemplateDispatchHttpHandler';
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
import {
  createConnectInboxConversationListHttpHandler,
  createConnectInboxContactSearchHttpHandler,
  createConnectInboxMessageListHttpHandler,
} from '../core/runtime/connectInboxQueryHttpHandler';
import { createConnectInboxHumanReplyHttpHandler } from '../core/runtime/connectInboxHumanReplyHttpHandler';
import { createConnectOperationalReadinessHttpHandler } from '../core/runtime/connectOperationalReadinessHttpHandler';
import { FirestoreConnectThreadStore } from '../core/inbox/firestoreThreadStore';
import { ReadinessGatedConnectThreadStore } from '../core/inbox/readinessGatedThreadStore';
import type { ConnectThreadStore } from '../core/inbox/threadStore';
import {
  FirestoreMessageContentStore,
} from '../core/inbox/firestoreMessageContentStore';
import type { ConnectMessageContentStore } from '../core/inbox/messageContentStore';
import type { InboxContactProfileStore } from '../core/inbox/inboxContactProfileStore';
import { FirestoreInboxContactProfileStore } from '../core/inbox/firestoreInboxContactProfileStore';
import type { InboxInternalNoteStore } from '../core/inbox/inboxInternalNoteStore';
import { FirestoreInboxInternalNoteStore } from '../core/inbox/firestoreInboxInternalNoteStore';
import { HubFirestoreInboxOperatorDirectory, type ConnectInboxOperatorDirectory } from '../core/inbox/hubFirestoreInboxOperatorDirectory';
import { createConnectInboxOperatorDirectoryHttpHandler } from '../core/runtime/connectInboxOperatorDirectoryHttpHandler';
import { createInboxInternalNoteHttpHandler } from '../core/runtime/connectInboxInternalNoteHttpHandler';
import { WhatsAppInboxIngestor } from '../core/inbox/whatsappInboxIngestor';
import { HumanReplyService } from '../core/inbox/humanReplyService';
import { FirestoreHumanReplyDispatchStore } from '../core/inbox/firestoreHumanReplyDispatchStore';
import {
  createMetaWhatsAppProviderFromEnv,
  isWhatsAppHumanReplyConfigured,
} from '../core/channels/metaWhatsAppProvider';
import {
  WhatsAppConnectionRegistry,
  parseWhatsAppConnectionBindings,
} from '../core/channels/whatsappConnectionRegistry';
import { FirestoreWhatsAppChannelIdentityBindingStore } from '../core/channels/firestoreWhatsAppChannelIdentityBindingStore';
import { FirestoreAssistReplyDispatchStore } from '../core/inbox/firestoreAssistReplyDispatchStore';
import { WhatsAppAssistReplyService } from '../core/inbox/whatsappAssistReplyService';
import {
  FirebaseCustomTokenExchanger,
  HubChannelGrantHttpClient,
} from '../core/runtime/hubChannelGrantHttpClient';
import { WhatsAppAssistOrchestrator } from '../core/runtime/whatsappAssistOrchestrator';
import { createConnectChannelLinkConfirmHttpHandler } from '../core/runtime/connectChannelLinkHttpHandler';
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
  inboxContactProfileStore?: InboxContactProfileStore;
  inboxInternalNoteStore?: InboxInternalNoteStore;
  inboxOperatorDirectory?: ConnectInboxOperatorDirectory;
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
  const env = resolveExecutionSecretBundle(options.env ?? process.env);
  if (env.CONNECT_HOMOLOGATION_READ_ONLY === 'true') app.use(homologationReadOnly);
  const releaseSha = env.CONNECT_RELEASE_SHA?.trim();
  const storageReadinessProbeEnabled =
    env.CONNECT_STORAGE_READINESS_PROBE_ENABLED?.trim().toLowerCase() === 'true';
  const durableInboxEnabled =
    env.CONNECT_INBOX_DURABLE_ENABLED?.trim().toLowerCase() === 'true';
  const messageContentEnabled =
    env.CONNECT_INBOX_MESSAGE_CONTENT_ENABLED?.trim().toLowerCase() === 'true';
  const whatsappIngestionEnabled =
    env.CONNECT_WHATSAPP_INGESTION_ENABLED?.trim().toLowerCase() === 'true';
  const whatsappAssistEnabled =
    env.CONNECT_WHATSAPP_ASSIST_ENABLED?.trim().toLowerCase() === 'true';
  let core = options.core ?? null;
  let handler: ReturnType<typeof createConnectCoreHttpHandler> | null = core
    ? createConnectCoreHttpHandler(core)
    : null;

  let sessionHandler: ReturnType<typeof createConnectSessionHttpHandler> | null = null;
  let outboundValidationHandler: ReturnType<typeof createOutboundDeliveryHttpHandler> | null = null;
  let journeyFollowupHandler: ReturnType<typeof createNestJourneyFollowupContextHttpHandler> | null = null;
  let journeyTemplateHandler: ReturnType<typeof createJourneyTemplateDispatchHandler> | null = null;
  let journeyTemplateReadinessHandler: ReturnType<typeof createJourneyTemplateReadinessHandler> | null = null;
  let channelReadinessHandler: ReturnType<typeof createConnectChannelReadinessHttpHandler> | null = null;
  const whatsappWebhookVerificationHandler = createWhatsAppWebhookVerificationHandler({ env, logger });
  let whatsappWebhookIngressHandler = createWhatsAppWebhookIngressHandler({ env, logger });
  let whatsappIngestor: WhatsAppInboxIngestor | null = null;
  let inboxPush: InboxPushService | null = null;
  let productRouting: WhatsAppProductRouting | null = null;
  let productAgentProfilesHandler: ReturnType<typeof createProductAgentProfilesHandler> | null = null;
  let productAgentSettingsHandler: ReturnType<typeof createProductAgentSettingsHandler> | null = null;
  let supportOriginHandler: ReturnType<typeof createSupportOriginHttpHandler> | null = null;
  let supportDraftHandler: ReturnType<typeof createSupportDraftHttpHandler> | null = null;
  let automationJobs: FirestoreAutomationJobStore | null = null;
  let automationWorker: InternalAutomationWorker | null = null;
  let automationEventHandler: ReturnType<typeof createAutomationEventHandler> | null = null;
  let automationJobsReadHandler: ReturnType<typeof createAutomationJobsReadHandler> | null = null;
  let automationWorkerHandler: ReturnType<typeof createAutomationWorkerHandler> | null = null;
  let pushRouter: express.Router | null = null;
  let whatsappAssistOrchestrator: WhatsAppAssistOrchestrator | null = null;
  let channelLinkConfirmHandler: ReturnType<typeof createConnectChannelLinkConfirmHttpHandler> | null = null;
  let radarCloudSyncRouter: ReturnType<typeof createRadarCloudSyncRouter> | null = null;
  let personalRadarRouter: ReturnType<typeof createPersonalRadarRouter> | null = null;
  let personalSourcesRouter: ReturnType<typeof createPersonalSourcesRouter> | null = null;
  let personalIntelligenceRouter: ReturnType<typeof createPersonalIntelligenceRouter> | null = null;
  let inboxReadHandler: ReturnType<typeof createConnectInboxThreadReadHttpHandler> | null = null;
  let inboxCommandHandler: ReturnType<typeof createConnectInboxThreadCommandHttpHandler> | null = null;
  let inboxConversationListHandler: ReturnType<typeof createConnectInboxConversationListHttpHandler> | null = null;
  let inboxContactSearchHandler: ReturnType<typeof createConnectInboxContactSearchHttpHandler> | null = null;
  let inboxMessageListHandler: ReturnType<typeof createConnectInboxMessageListHttpHandler> | null = null;
  let inboxHumanReplyHandler: ReturnType<typeof createConnectInboxHumanReplyHttpHandler> | null = null;
  let inboxNoteHandler: ReturnType<typeof createInboxInternalNoteHttpHandler> | null = null;
  let inboxOperatorDirectoryHandler: ReturnType<typeof createConnectInboxOperatorDirectoryHttpHandler> | null = null;
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
      const operatorDirectory = options.inboxOperatorDirectory
        ?? new HubFirestoreInboxOperatorDirectory({ projectId, fetchImpl: options.fetchImpl });
      inboxOperatorDirectoryHandler = createConnectInboxOperatorDirectoryHttpHandler({
        contextProvider: inboxContextProvider, directory: operatorDirectory,
      });
      inboxReadHandler = createConnectInboxThreadReadHttpHandler({
        contextProvider: inboxContextProvider,
        store: gatedStore,
      });
      inboxCommandHandler = createConnectInboxThreadCommandHttpHandler({
        contextProvider: inboxContextProvider,
        store: gatedStore,
        operatorDirectory,
      });

      const messageStore = messageContentEnabled
        ? options.inboxMessageContentStore
          ?? new FirestoreMessageContentStore({
            projectId,
            fetchImpl: options.fetchImpl,
          })
        : null;

      if (messageStore) {
        // Default-off privacy gate. The operator must first configure Firestore
        // TTL on expiresAt and explicitly confirm retention before enabling.
        const contactProfilesEnabled =
          env.CONNECT_INBOX_CONTACT_PROFILE_ENABLED?.trim().toLowerCase() === 'true' &&
          env.CONNECT_INBOX_CONTACT_TTL_CONFIRMED?.trim().toLowerCase() === 'true';
        const internalNotesEnabled =
          env.CONNECT_INBOX_INTERNAL_NOTES_ENABLED?.trim().toLowerCase() === 'true' &&
          env.CONNECT_INBOX_INTERNAL_NOTES_TTL_CONFIRMED?.trim().toLowerCase() === 'true';
        inboxNoteHandler = internalNotesEnabled
          ? createInboxInternalNoteHttpHandler({
              contextProvider: inboxContextProvider,
              threadStore: gatedStore,
              noteStore: options.inboxInternalNoteStore
                ?? new FirestoreInboxInternalNoteStore({ projectId, fetchImpl: options.fetchImpl }),
            })
          : null;

        const contactProfileStore = contactProfilesEnabled
          ? options.inboxContactProfileStore
            ?? new FirestoreInboxContactProfileStore({
              projectId,
              fetchImpl: options.fetchImpl,
            })
          : undefined;
        inboxConversationListHandler = createConnectInboxConversationListHttpHandler({
          contextProvider: inboxContextProvider,
          threadStore: gatedStore,
          messageStore,
          contactProfileStore,
        });
        inboxContactSearchHandler = createConnectInboxContactSearchHttpHandler({
          contextProvider: inboxContextProvider,
          threadStore: gatedStore,
          messageStore,
          contactProfileStore,
        });
        inboxMessageListHandler = createConnectInboxMessageListHttpHandler({
          contextProvider: inboxContextProvider,
          threadStore: gatedStore,
          messageStore,
        });

        let registry: WhatsAppConnectionRegistry | null = null;
        if (whatsappIngestionEnabled || isWhatsAppHumanReplyConfigured(env) || isJourneyTemplateDispatchConfigured(env)) {
          registry = options.whatsappConnectionRegistry
            ?? new WhatsAppConnectionRegistry(parseWhatsAppConnectionBindings(env));
        }

        if (registry && (env.CONNECT_WEB_PUSH_ENABLED === 'true' || env.CONNECT_WEB_PUSH_TEST_MODE === 'true') && env.CONNECT_WEB_PUSH_TTL_CONFIRMED === 'true' && env.CONNECT_WEB_PUSH_STORAGE_PRIVATE_CONFIRMED === 'true') {
          try {
            const publicKey = env.CONNECT_WEB_PUSH_PUBLIC_KEY || '';
            const sender = createWebPushSender(publicKey, env.CONNECT_WEB_PUSH_PRIVATE_KEY || '', env.CONNECT_WEB_PUSH_SUBJECT || '');
            const pushStore = new FirestorePushStore(projectId, options.fetchImpl);
            if (env.CONNECT_WEB_PUSH_ENABLED === 'true') inboxPush = new InboxPushService(pushStore, gatedStore, operatorDirectory, sender, registry, undefined, logger);
            pushRouter = createPushRouter(inboxContextProvider, pushStore, publicKey, gatedStore, { sender, deliveryMode: env.CONNECT_WEB_PUSH_ENABLED === 'true' ? 'live' : 'test' });
          } catch {
            logger.warn?.('CONNECT_WEB_PUSH_CONFIGURATION_INVALID');
          }
        }

        if (registry && whatsappIngestionEnabled) {
          if (registry.size > 0) {
            whatsappIngestor = new WhatsAppInboxIngestor(
              registry,
              messageStore,
              gatedStore,
              undefined,
              contactProfileStore,
            );
          } else {
            logger.warn?.('CONNECT_WHATSAPP_INGESTION_BINDING_MISSING');
          }
        }

        const officialWhatsAppProvider =
          registry && registry.size > 0 && isWhatsAppHumanReplyConfigured(env)
            ? createMetaWhatsAppProviderFromEnv(env, options.fetchImpl)
            : null;

        if(hubOrigin && registry && registry.size>0 && inboxContextProvider
          && isJourneyTemplateDispatchConfigured(env)){
          try{
            const templateOptions={
              contextProvider:inboxContextProvider,
              hubOrigin,registry,
              provider:createMetaWhatsAppProviderFromEnv(env,options.fetchImpl),
              dispatchStore:new FirestoreHumanReplyDispatchStore({
                projectId,fetchImpl:options.fetchImpl,
              }),
              messageStore,
              env,fetchImpl:options.fetchImpl,
            };
            journeyTemplateHandler=createJourneyTemplateDispatchHandler(templateOptions);
            journeyTemplateReadinessHandler=createJourneyTemplateReadinessHandler(templateOptions);
          }catch(error){
            logger.warn?.('NESTJOURNEY_TEMPLATE_DISPATCH_NOT_READY',{
              code:error instanceof Error?error.message:'CONFIGURATION_ERROR',
            });
            journeyTemplateHandler=null;
            journeyTemplateReadinessHandler=null;
          }
        }


        let humanReplyService: HumanReplyService | undefined;
        if (officialWhatsAppProvider && env.CONNECT_SUPPORT_DRAFT_ENABLED === 'true' && env.CONNECT_SUPPORT_ORIGIN_SECRET && env.CONNECT_SUPPORT_ORIGIN_SECRET.length >= 32) {
          supportDraftHandler = createSupportDraftHttpHandler({ contextProvider: inboxContextProvider, secret: env.CONNECT_SUPPORT_ORIGIN_SECRET,
            bindings: parseWhatsAppConnectionBindings(env), provider: officialWhatsAppProvider });
        }
        if (registry && registry.size > 0 && officialWhatsAppProvider) {
          humanReplyService = new HumanReplyService({
            registry,
            messageStore,
            dispatchStore: new FirestoreHumanReplyDispatchStore({
              projectId,
              fetchImpl: options.fetchImpl,
            }),
            threadStore: gatedStore,
            provider: officialWhatsAppProvider,
          });
        }

        if (whatsappAssistEnabled && registry && registry.size > 0 && officialWhatsAppProvider) {
          const firebaseApiKey = env.CONNECT_FIREBASE_API_KEY?.trim();
          // The Meta webhook verify token is an operator-chosen challenge value and
          // is not guaranteed to have cryptographic length/entropy. Use the Meta
          // app secret as the root material; downstream HMAC purposes separate
          // channel identity, link signing and binding encryption keys.
          const linkRootSecret = env.CONNECT_WHATSAPP_APP_SECRET?.trim();
          const publicOrigin = env.CONNECT_PUBLIC_ORIGIN?.trim() || 'https://connect.millionsnest.com';

          if (!hubOrigin || !firebaseApiKey || !linkRootSecret) {
            logger.warn?.('CONNECT_WHATSAPP_ASSIST_CONFIGURATION_MISSING', {
              hubOrigin: Boolean(hubOrigin),
              firebaseApiKey: Boolean(firebaseApiKey),
              linkRootSecret: Boolean(linkRootSecret),
            });
          } else {
            try {
              if (!core) {
                core = createConnectCoreRuntime({
                  env,
                  logger,
                  fetchImpl: options.fetchImpl,
                });
                handler = createConnectCoreHttpHandler(core);
              }

              const assistReplyService = new WhatsAppAssistReplyService({
                messageStore,
                dispatchStore: new FirestoreAssistReplyDispatchStore({
                  projectId,
                  fetchImpl: options.fetchImpl,
                }),
                provider: officialWhatsAppProvider,
              });

              if (env.CONNECT_PRODUCT_ROUTING_ENABLED === 'true' && env.CONNECT_PRODUCT_ROUTING_STORAGE_PRIVATE_CONFIRMED === 'true' && env.CONNECT_PRODUCT_ROUTING_TTL_CONFIRMED === 'true') {
                if (!env.CONNECT_SUPPORT_ORIGIN_SECRET || env.CONNECT_SUPPORT_ORIGIN_SECRET.length < 32) throw new Error('PRODUCT_ROUTING_ORIGIN_SECRET_REQUIRED');
                const owners = parseProductSupportOwners(env.CONNECT_PRODUCT_SUPPORT_OWNERS_JSON);
                if (env.CONNECT_PRODUCT_AGENT_SETTINGS_ENABLED === 'true' && env.CONNECT_PRODUCT_AGENT_SETTINGS_PRIVATE_CONFIRMED !== 'true') throw new Error('PRODUCT_AGENT_SETTINGS_PRIVATE_STORAGE_REQUIRED');
                const settingsStore = env.CONNECT_PRODUCT_AGENT_SETTINGS_ENABLED === 'true' && env.CONNECT_PRODUCT_AGENT_SETTINGS_PRIVATE_CONFIRMED === 'true'
                  ? new FirestoreProductAgentSettingsStore(projectId, options.fetchImpl, undefined, undefined, env.CONNECT_SUPPORT_ORIGIN_SECRET) : undefined;
                const agentOptions = { contextProvider: inboxContextProvider, directory: operatorDirectory, owners, settingsStore,
                  settingsEditable: env.CONNECT_PRODUCT_AGENT_SETTINGS_EDITING_ENABLED === 'true' };
                productAgentProfilesHandler = createProductAgentProfilesHandler(agentOptions);
                productAgentSettingsHandler = createProductAgentSettingsHandler(agentOptions);
                productRouting = new WhatsAppProductRouting({
                  registry, routes: new FirestoreProductRouteStore(projectId, options.fetchImpl),
                  messages: messageStore, threads: gatedStore, replies: assistReplyService,
                  directory: operatorDirectory, owners, settingsStore, originSecret: env.CONNECT_SUPPORT_ORIGIN_SECRET,
                });
                if (env.CONNECT_SUPPORT_ORIGIN_SECRET && env.CONNECT_SUPPORT_ORIGIN_SECRET.length >= 32) {
                  supportOriginHandler = createSupportOriginHttpHandler(inboxContextProvider, env.CONNECT_SUPPORT_ORIGIN_SECRET);
                }
              }

              whatsappAssistOrchestrator = new WhatsAppAssistOrchestrator({
                registry,
                bindingStore: new FirestoreWhatsAppChannelIdentityBindingStore({
                  projectId,
                  encryptionRootSecret: linkRootSecret,
                  fetchImpl: options.fetchImpl,
                }),
                messageStore,
                hubClient: new HubChannelGrantHttpClient({
                  hubOrigin,
                  fetchImpl: options.fetchImpl,
                }),
                tokenExchanger: new FirebaseCustomTokenExchanger({
                  apiKey: firebaseApiKey,
                  fetchImpl: options.fetchImpl,
                }),
                core,
                replyService: assistReplyService,
                resumeGuard: productRouting ? async event => (await productRouting!.route([event])).length === 1 : undefined,
                linkRootSecret,
                publicOrigin,
                logger,
              });
              channelLinkConfirmHandler = createConnectChannelLinkConfirmHttpHandler({
                orchestrator: whatsappAssistOrchestrator,
                logger,
              });
            } catch (error) {
              logger.error?.('CONNECT_WHATSAPP_ASSIST_CONFIGURATION_ERROR', {
                error: error instanceof Error ? error.message : 'unknown_error',
              });
              whatsappAssistOrchestrator = null;
              productRouting = null;
              productAgentProfilesHandler = null;
              productAgentSettingsHandler = null;
              supportOriginHandler = null;
              channelLinkConfirmHandler = null;
            }
          }
        }

        if (inboxPush && env.CONNECT_AUTOMATION_EXECUTION_ENABLED === 'true' && env.CONNECT_AUTOMATION_STORAGE_PRIVATE_CONFIRMED === 'true' && env.CONNECT_AUTOMATION_TTL_CONFIRMED === 'true') {
          try {
            const workerSecret = env.CONNECT_AUTOMATION_WORKER_SECRET || '';
            if (workerSecret.length < 32) throw new Error('AUTOMATION_WORKER_SECRET_REQUIRED');
            const keys = JSON.parse(env.CONNECT_AUTOMATION_SOURCE_KEYS_JSON || '{}');
            if (!keys || typeof keys !== 'object' || Array.isArray(keys) || Object.entries(keys).some(([k, v]) => !['musicscale', 'nestfinance', 'nestjourney'].includes(k) || typeof v !== 'string' || v.length < 32)) throw new Error('AUTOMATION_SOURCE_KEYS_INVALID');
            automationJobs = new FirestoreAutomationJobStore(projectId, options.fetchImpl);
            automationWorker = new InternalAutomationWorker(automationJobs, async event => {
              const thread = await gatedStore.load({ organizationId: event.organizationId, conversationId: event.conversationId });
              if (!thread) return 'needs_review';
              let outcome;
              if (event.sourceApp === 'whatsapp') {
                const original = await messageStore.get({ organizationId: event.organizationId, conversationId: event.conversationId, messageId: event.messageId! });
                if (!original || original.direction !== 'inbound' || !original.recipientRef || !original.senderRef) return 'needs_review';
                outcome = await inboxPush!.afterIngest([{ kind: 'message', phoneNumberId: original.recipientRef, providerMessageId: original.providerMessageId, from: original.senderRef, messageType: original.messageType, timestamp: String(Math.floor(Date.parse(original.occurredAt) / 1000)), text: original.body }]);
              } else {
                // Internal operator alert only: no financial/pastoral data read or outbound Meta send.
                if (!await operatorDirectory.verify({ organizationId: event.organizationId, uid: event.recipientUid! })) return 'needs_review';
                outcome = await inboxPush!.notifyAutomation({ organizationId: event.organizationId, conversationId: event.conversationId, eventId: jobId(event), recipientUid: event.recipientUid! });
              }
              return outcome.failed > 0 ? 'needs_review' : 'complete';
            });
            automationEventHandler = createAutomationEventHandler(automationJobs, keys);
            automationJobsReadHandler = createAutomationJobsReadHandler(automationJobs, inboxContextProvider);
            automationWorkerHandler = createAutomationWorkerHandler(automationWorker, workerSecret);
          } catch {
            automationJobs = null; automationWorker = null; automationEventHandler = null; automationWorkerHandler = null; automationJobsReadHandler = null;
            logger.warn?.('CONNECT_AUTOMATION_CONFIGURATION_INVALID');
          }
        }

        if (whatsappIngestor) {
          whatsappWebhookIngressHandler = createWhatsAppWebhookIngressHandler({
            env,
            logger,
            ingestor: whatsappIngestor,
            afterIngest: async (events) => {
              // Assist runs first so a resolved conversation never produces a stale alert.
              if (whatsappAssistOrchestrator) {
                try {
                  const routed = productRouting ? await productRouting.route(events) : events;
                  await whatsappAssistOrchestrator.afterIngest(routed);
                }
                catch { logger.warn?.('CONNECT_WHATSAPP_ASSIST_POST_INGEST_FAILED'); }
              }
              if (inboxPush) {
                try {
                  if (automationJobs && automationWorker && registry) {
                    for (const event of events) {
                      if (event.kind !== 'message') continue;
                      const binding = registry.resolve(event.phoneNumberId); if (!binding) continue;
                      const conversationId = createConversationIdFromChannelIdentity({ organizationId: binding.organizationId, connectionRef: binding.connectionRef, channel: 'whatsapp', channelUserId: event.from });
                      const messageId = createProviderMessageIndexId('whatsapp', event.providerMessageId);
                      await automationJobs.enqueue(validateAutomationEvent({ schemaVersion: 1, sourceApp: 'whatsapp', trigger: 'inbox.message_received', eventId: messageId, organizationId: binding.organizationId, conversationId, messageId, occurredAt: new Date(Number(event.timestamp) * 1000).toISOString() }, 'whatsapp', Date.now()), new Date());
                    }
                    await automationWorker.run(10);
                  } else await inboxPush.afterIngest(events);
                } catch { logger.warn?.('CONNECT_WEB_PUSH_POST_INGEST_FAILED'); }
              }
            },
          });
        }

        inboxHumanReplyHandler = createConnectInboxHumanReplyHttpHandler({
          contextProvider: inboxContextProvider,
          service: humanReplyService,
          env,
          logger,
        });
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

  app.get('/api/core/automations/jobs', (req, res) => {
    if (!automationJobsReadHandler) { res.status(404).json({ code: 'AUTOMATION_EXECUTION_DISABLED' }); return; }
    return automationJobsReadHandler(req, res);
  });
  app.post('/api/core/automations/events/:sourceApp', express.raw({ type: 'application/json', limit: '16kb' }), (req, res) => {
    if (!automationEventHandler) { res.status(404).json({ code: 'AUTOMATION_EXECUTION_DISABLED' }); return; }
    return automationEventHandler(req, res);
  });
  app.post('/api/core/automations/worker', express.raw({ type: 'application/json', limit: '1kb' }), (req, res) => {
    if (!automationWorkerHandler) { res.status(404).json({ code: 'AUTOMATION_EXECUTION_DISABLED' }); return; }
    return automationWorkerHandler(req, res);
  });

  app.use(express.json({ limit: '32kb' }));
  const financePendingDocuments = inboxContextProvider && env.CONNECT_NESTFINANCE_PENDING_DOCUMENTS_ENABLED === 'true'
    ? createNestFinancePendingDocumentsHttpHandler({ contextProvider: inboxContextProvider, fetchImpl: options.fetchImpl as typeof fetch,
      audit: event => logger.info?.('CONNECT_FINANCE_TOOL_AUDIT', event) }) : null;
  const financeEntities = inboxContextProvider && env.CONNECT_NESTFINANCE_PENDING_DOCUMENTS_ENABLED === 'true'
    ? createNestFinanceEntitiesHttpHandler({ contextProvider: inboxContextProvider, fetchImpl: options.fetchImpl as typeof fetch,
      audit: event => logger.info?.('CONNECT_FINANCE_TOOL_AUDIT', event) }) : null;
  app.post('/api/core/tools/nestfinance/entities', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!financeEntities) return res.status(404).json({ code: 'FINANCE_TOOL_DISABLED' });
    return financeEntities(req, res);
  });
  app.post('/api/core/tools/nestfinance/pending-documents', (req, res) => {
    if (!financePendingDocuments) { res.status(404).json({ code: 'FINANCE_TOOL_DISABLED' }); return; }
    return financePendingDocuments(req, res);
  });
  app.post('/api/core/support/draft', (req, res) => {
    if (!supportDraftHandler) { res.status(404).json({ code: 'SUPPORT_DRAFT_DISABLED' }); return; }
    return supportDraftHandler(req, res);
  });
  app.get('/api/core/agents/product-profiles', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!productAgentProfilesHandler) return res.status(404).json({ code: 'PRODUCT_AGENTS_DISABLED' });
    return productAgentProfilesHandler(req, res);
  });
  app.put('/api/core/agents/product-profiles/:product', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!productAgentSettingsHandler) return res.status(404).json({ code: 'AGENT_SETTINGS_DISABLED' });
    return productAgentSettingsHandler(req, res);
  });
  app.post('/api/core/support/origin', (req, res) => {
    if (!supportOriginHandler) { res.status(404).json({ code: 'SUPPORT_ORIGIN_DISABLED' }); return; }
    return supportOriginHandler(req, res);
  });
  app.use('/api/core/inbox/push', (req, res, next) => {
    if (!pushRouter) { res.status(404).json({ code: 'PUSH_DISABLED' }); return; }
    return pushRouter(req, res, next);
  });

  app.post('/api/core/channel-link/confirm', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!whatsappAssistEnabled) {
      return res.status(404).json({
        success: false,
        code: 'WHATSAPP_ASSIST_DISABLED',
      });
    }
    if (!channelLinkConfirmHandler) {
      return res.status(503).json({
        success: false,
        code: 'WHATSAPP_ASSIST_CONFIGURATION_MISSING',
      });
    }
    return channelLinkConfirmHandler(req, res);
  });

  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      service: 'millionsnest-connect-core',
      protocolVersion: '1.0.0',
      releaseSha: releaseSha || undefined,
      productRouting: {
        requested: env.CONNECT_PRODUCT_ROUTING_ENABLED === 'true',
        mounted: productRouting !== null,
      },
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

  app.get('/api/core/inbox/operators', async (req, res) => {
    if (!inboxOperatorDirectoryHandler) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({ success: false, code: 'INBOX_DIRECTORY_UNAVAILABLE' });
    }
    return inboxOperatorDirectoryHandler(req, res);
  });

  app.get('/api/core/inbox/conversations/search', async (req, res) => {
    if (!inboxContactSearchHandler) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({ success: false, code: 'INBOX_SEARCH_UNAVAILABLE' });
    }
    return inboxContactSearchHandler(req, res);
  });

  app.get('/api/core/inbox/conversations', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!durableInboxEnabled || !messageContentEnabled) {
      return res.status(404).json({
        success: false,
        code: 'INBOX_QUERY_DISABLED',
      });
    }
    if (!inboxConversationListHandler) {
      return res.status(503).json({
        success: false,
        code: 'INBOX_RUNTIME_CONFIGURATION_MISSING',
      });
    }
    return inboxConversationListHandler(req, res);
  });

  // Private notes have no provider dispatch path, ever. Both IAM and
  // retention gates must be explicitly activated before these routes exist.
  app.get('/api/core/inbox/threads/:conversationId/notes', async (req, res) => {
    if (!inboxNoteHandler) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ success: false, code: 'INBOX_INTERNAL_NOTES_DISABLED' });
    }
    return inboxNoteHandler(req, res);
  });
  app.post('/api/core/inbox/threads/:conversationId/notes', async (req, res) => {
    if (!inboxNoteHandler) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ success: false, code: 'INBOX_INTERNAL_NOTES_DISABLED' });
    }
    return inboxNoteHandler(req, res);
  });

  app.post('/api/core/inbox/threads/:conversationId/reply', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!durableInboxEnabled || !messageContentEnabled) {
      return res.status(404).json({
        success: false,
        code: 'INBOX_QUERY_DISABLED',
      });
    }
    if (!inboxHumanReplyHandler) {
      return res.status(503).json({
        success: false,
        code: 'INBOX_RUNTIME_CONFIGURATION_MISSING',
      });
    }
    return inboxHumanReplyHandler(req, res);
  });

  app.get('/api/core/inbox/threads/:conversationId/messages', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!durableInboxEnabled || !messageContentEnabled) {
      return res.status(404).json({
        success: false,
        code: 'INBOX_QUERY_DISABLED',
      });
    }
    if (!inboxMessageListHandler) {
      return res.status(503).json({
        success: false,
        code: 'INBOX_RUNTIME_CONFIGURATION_MISSING',
      });
    }
    return inboxMessageListHandler(req, res);
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

  app.get('/api/core/nestjourney/followup/template-readiness',async (req,res)=>{
    if(!journeyTemplateReadinessHandler){
      res.setHeader('Cache-Control','no-store');
      return res.status(200).json({success:true,ready:false});
    }
    return journeyTemplateReadinessHandler(req,res);
  });

  app.post('/api/core/nestjourney/followup/send-template',async (req,res)=>{
    if(!journeyTemplateHandler){
      res.setHeader('Cache-Control','no-store');
      return res.status(409).json({success:false,code:'OFFICIAL_TEMPLATE_NOT_CONFIGURED'});
    }
    return journeyTemplateHandler(req,res);
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
