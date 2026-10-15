import type { WhatsAppNormalizedEvent } from '../channels/whatsappOfficial';
import type { WhatsAppConnectionRegistry } from '../channels/whatsappConnectionRegistry';
import { createConversationIdFromChannelIdentity, createMessageEvidenceRef, type ConnectMessageContentStore } from '../inbox/messageContentStore';
import type { WhatsAppAssistReplyService } from '../inbox/whatsappAssistReplyService';
import type { ConnectThreadStore } from '../inbox/threadStore';
import { ConnectThreadCommandService } from '../inbox/threadService';
import type { ConnectInboxOperatorDirectory } from '../inbox/hubFirestoreInboxOperatorDirectory';
import { localeFromText } from '../runtime/whatsappAssistOrchestrator';
import { resolveConnectCoreIntent } from '../runtime/connectCore';
import { CONNECT_PRODUCTS, routingId, type ConnectProduct, type ProductRouteStore } from './productRouting';
import { publicProductSupportReply } from '../agents/productAgentProfiles';
import { defaultAgentSettings, type ProductAgentSettings, type ProductAgentSettingsStore } from '../agents/productAgentSettings';

/** Runs only after durable signed-Meta ingestion; route hints cannot authorize domain data. */
export class WhatsAppProductRouting {
  private readonly commands: ConnectThreadCommandService;
  constructor(private readonly options: {
    registry: WhatsAppConnectionRegistry; routes: ProductRouteStore; messages: ConnectMessageContentStore;
    threads: ConnectThreadStore; replies: Pick<WhatsAppAssistReplyService, 'send'>;
    directory: ConnectInboxOperatorDirectory; owners?: Partial<Record<ConnectProduct, string>>;
    settingsStore?: ProductAgentSettingsStore;
    originSecret?: string; now?: () => Date;
  }) { this.commands = new ConnectThreadCommandService(options.threads, options.now); }
  async route(events: WhatsAppNormalizedEvent[]): Promise<WhatsAppNormalizedEvent[]> {
    const pass: WhatsAppNormalizedEvent[] = [];
    for (const event of events) {
      if (event.kind !== 'message') continue;
      const connection = this.options.registry.resolve(event.phoneNumberId);
      if (!connection) continue;
      const scope = { organizationId: connection.organizationId, conversationId: createConversationIdFromChannelIdentity({
        organizationId: connection.organizationId, connectionRef: connection.connectionRef, channel: 'whatsapp', channelUserId: event.from,
      }) };
      const original = await this.options.messages.getByProviderMessageId({ channel: 'whatsapp', providerMessageId: event.providerMessageId });
      if (!original || original.organizationId !== scope.organizationId || original.conversationId !== scope.conversationId || original.direction !== 'inbound' || original.senderRef !== event.from) throw new Error('PRODUCT_ROUTING_EVIDENCE_MISMATCH');
      const now = (this.options.now ?? (() => new Date()))();
      const age = now.getTime() - Date.parse(original.occurredAt);
      // Old provider retries cannot reopen the Meta service window or produce new outbound replies.
      if (!Number.isFinite(age) || age < -30000 || age >= 24 * 3600000) continue;
      const thread = await this.options.threads.load(scope);
      if (!thread || ['resolved', 'archived'].includes(thread.status)) continue;
      const evidenceRef = createMessageEvidenceRef('whatsapp', event.providerMessageId);
      if (thread.lastEvidenceRef !== evidenceRef) continue;
      const id = routingId(scope.organizationId, event.providerMessageId);
      if (event.messageType !== 'text' || !event.text) {
        if (thread.mode !== 'human' && thread.assignedTo?.type !== 'user') {
          await this.commands.requestHumanReview({ ...scope, requestId: `wa-20-product-media-${id}`, evidenceRef, reasonCode: 'unsupported_message_human_required' });
        }
        continue;
      }
      const decision = await this.options.routes.decide({ ...scope, eventId: id, occurredAt: original.occurredAt, text: original.body ?? '' }, now.getTime(), this.options.originSecret);
      if (!decision || thread.mode === 'human' || thread.assignedTo?.type === 'user') continue;
      const clean = (original.body ?? '').replace(/\[mn-origin:[^\]]*\]/g, '').trim();
      const product = decision.product;
      let settings: ProductAgentSettings | null = null;
      if (decision.kind === 'route' && product) {
        try {
          settings = (await this.options.settingsStore?.read({ organizationId: scope.organizationId, product }))?.settings ?? defaultAgentSettings(product, this.options.owners?.[product]);
        } catch {
          // An unavailable configuration cannot silently re-enable a disabled
          // agent or forward a private query. Preserve the inbound and queue it.
          await this.commands.requestHumanReview({ ...scope, requestId: `wa-20-product-config-${id}`, evidenceRef, reasonCode: 'product_agent_configuration_unavailable' });
          continue;
        }
      }
      if (settings?.enabled && decision.kind === 'route' && product === 'musicscale' && resolveConnectCoreIntent(clean) !== 'unknown') {
        pass.push({ ...event, text: clean });
        continue;
      }
      if (settings?.enabled && decision.kind === 'route' && product) {
        const answer = publicProductSupportReply(product, clean, localeFromText(clean), settings);
        if (answer) {
          await this.options.replies.send({ ...scope, requestId: `product-agent-${id}`, phoneNumberId: event.phoneNumberId, recipientPhone: event.from, text: answer });
          await this.commands.waitForPerson({ ...scope, requestId: `wa-20-product-agent-${id}`, evidenceRef, reasonCode: `product_${product}_public_support_v1_answered` });
          continue;
        }
      }
      if (decision.kind === 'route' && product) {
        const owner = settings?.ownerUid;
        let verifiedOwner = false;
        if (owner) {
          try { verifiedOwner = await this.options.directory.verify({ organizationId: scope.organizationId, uid: owner }); }
          catch { /* Unavailable directory cannot authorize an assignee. Queue for human review. */ }
        }
        if (owner && verifiedOwner) {
          await this.commands.handoff({ ...scope, requestId: `wa-20-product-handoff-${id}`, evidenceRef,
            assigneeType: 'user', assigneeRef: owner, reasonCode: `product_${product}_human_required` });
        } else {
          await this.commands.requestHumanReview({ ...scope, requestId: `wa-20-product-review-${id}`, evidenceRef,
            reasonCode: `product_${product}_owner_unavailable` });
        }
      }
      const locale = localeFromText(clean);
      const labels = {
        'pt-BR': { clarify: 'Sobre qual aplicativo você precisa de ajuda: MusicScale, NestFinance ou NestJourney?', human: 'Sua solicitação sobre {product} precisa de atendimento humano. Ela está registrada nesta conversa para a equipe acompanhar.' },
        'en-US': { clarify: 'Which app do you need help with: MusicScale, NestFinance or NestJourney?', human: 'Your {product} request needs human support. It is recorded in this conversation for the team to follow up.' },
        'es-ES': { clarify: '¿Sobre qué aplicación necesitas ayuda: MusicScale, NestFinance o NestJourney?', human: 'Tu solicitud de {product} necesita atención humana. Está registrada en esta conversación para que el equipo la atienda.' },
      };
      const text = decision.kind === 'clarify' ? labels[locale].clarify
        : labels[locale].human.replace('{product}', CONNECT_PRODUCTS[product!].label);
      await this.options.replies.send({ ...scope, requestId: `product-route-${id}`, phoneNumberId: event.phoneNumberId, recipientPhone: event.from, text });
      if (decision.kind === 'clarify') {
        await this.commands.waitForPerson({ ...scope, requestId: `wa-20-product-clarify-${id}`, evidenceRef, reasonCode: 'product_clarification_required' });
      }
    }
    return pass;
  }
}
