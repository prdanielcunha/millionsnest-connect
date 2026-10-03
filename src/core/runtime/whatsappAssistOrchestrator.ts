import { createHash } from 'node:crypto';
import type { WhatsAppInboundMessage } from '../channels/whatsappOfficial';
import type { WhatsAppConnectionRegistry } from '../channels/whatsappConnectionRegistry';
import {
  createWhatsAppChannelIdentityHash,
  deriveWhatsAppLinkToken,
  hashWhatsAppLinkToken,
  type WhatsAppChannelIdentityStore,
} from '../channels/whatsappChannelIdentityStore';
import { createConversationIdFromChannelIdentity } from '../inbox/messageContentStore';
import type { WhatsAppSystemReplyService } from '../inbox/whatsappSystemReplyService';
import type { ConnectCoreService } from './connectCore';
import type { ChannelDelegationTokenProvider } from './channelDelegationTokenProvider';

export type WhatsAppAssistOutcome =
  | 'ignored_non_text'
  | 'link_required'
  | 'answered'
  | 'unsupported'
  | 'denied'
  | 'failed';

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

function safeOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('CONNECT_PUBLIC_ORIGIN_INVALID');
  }
  return url.origin;
}

function inferLocale(text: string): 'pt-BR' | 'en' | 'es' {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\b(my|next|schedule|chords|songs|repertoire|attendance|sunday)\b/.test(normalized)) return 'en';
  if (/\b(mi|proxima|escala|canciones|repertorio|acordes|asistencia|domingo)\b/.test(normalized)) return 'es';
  return 'pt-BR';
}

function linkMessage(locale: 'pt-BR' | 'en' | 'es', link: string): string {
  if (locale === 'en') {
    return `To access your church information securely, confirm your MillionsNest account here: ${link}\n\nThe link expires in 30 minutes. After linking, come back here and send your question again.`;
  }
  if (locale === 'es') {
    return `Para acceder de forma segura a la información de tu iglesia, confirma tu cuenta MillionsNest aquí: ${link}\n\nEl enlace vence en 30 minutos. Después vuelve aquí y envía tu pregunta nuevamente.`;
  }
  return `Para acessar com segurança as informações da sua igreja, confirme sua conta MillionsNest aqui: ${link}\n\nO link expira em 30 minutos. Depois volte aqui e envie sua pergunta novamente.`;
}

function unsupportedMessage(locale: 'pt-BR' | 'en' | 'es'): string {
  if (locale === 'en') {
    return 'I can help with your next schedule, Sunday repertoire, attendance status and song charts. Try: “What is my next schedule?”';
  }
  if (locale === 'es') {
    return 'Puedo ayudarte con tu próxima escala, repertorio del domingo, estado de asistencia y cifras. Prueba: “¿Cuál es mi próxima escala?”';
  }
  return 'Posso ajudar com sua próxima escala, repertório de domingo, status de presença e cifras. Experimente: “Qual é minha próxima escala?”';
}

function deniedMessage(locale: 'pt-BR' | 'en' | 'es'): string {
  if (locale === 'en') return 'I could not confirm access to this church in MusicScale. Open MillionsNest to review your account or ask an administrator for access.';
  if (locale === 'es') return 'No pude confirmar tu acceso a esta iglesia en MusicScale. Abre MillionsNest para revisar tu cuenta o solicita acceso a un administrador.';
  return 'Não consegui confirmar seu acesso a esta igreja no MusicScale. Abra o MillionsNest para revisar sua conta ou peça acesso a um administrador.';
}

function failedMessage(locale: 'pt-BR' | 'en' | 'es'): string {
  if (locale === 'en') return 'I could not complete that lookup right now. Your message is saved in Connect; please try again in a moment.';
  if (locale === 'es') return 'No pude completar esa consulta ahora. Tu mensaje quedó guardado en Connect; inténtalo de nuevo en un momento.';
  return 'Não consegui concluir essa consulta agora. Sua mensagem ficou registrada no Connect; tente novamente em instantes.';
}

/**
 * Bridges a durable inbound WhatsApp message into Connect Core.
 *
 * Unknown channel identities receive a one-time account-link URL. Linked
 * identities obtain a short-lived Firebase ID token from Hub delegation and
 * then travel through the exact same Hub + Tool Gateway + MusicScale path as
 * in-app requests. No roles, tenant permissions or user bearer tokens are
 * stored in the channel binding.
 */
export class WhatsAppAssistOrchestrator {
  private readonly publicOrigin: string;
  private readonly now: () => Date;

  constructor(private readonly options: {
    registry: WhatsAppConnectionRegistry;
    identityStore: WhatsAppChannelIdentityStore;
    delegationTokenProvider: ChannelDelegationTokenProvider;
    core: ConnectCoreService;
    replyService: WhatsAppSystemReplyService;
    appSecret: string;
    publicOrigin: string;
    now?: () => Date;
  }) {
    this.publicOrigin = safeOrigin(options.publicOrigin);
    this.now = options.now ?? (() => new Date());
  }

  async handle(event: WhatsAppInboundMessage): Promise<WhatsAppAssistOutcome> {
    if (event.messageType !== 'text' || !event.text?.trim()) {
      return 'ignored_non_text';
    }

    const connection = this.options.registry.resolve(event.phoneNumberId);
    if (!connection) throw new Error('WHATSAPP_CONNECTION_NOT_MAPPED');

    const conversationId = createConversationIdFromChannelIdentity({
      organizationId: connection.organizationId,
      channel: 'whatsapp',
      connectionRef: connection.connectionRef,
      channelUserId: event.from,
    });
    const locale = inferLocale(event.text);
    const identityHash = createWhatsAppChannelIdentityHash({
      organizationId: connection.organizationId,
      phoneNumberId: event.phoneNumberId,
      senderRef: event.from,
    });
    const identity = await this.options.identityStore.resolve({
      organizationId: connection.organizationId,
      phoneNumberId: event.phoneNumberId,
      senderRef: event.from,
    });
    const inboundKey = digest(event.providerMessageId);

    if (!identity) {
      const linkToken = deriveWhatsAppLinkToken({
        appSecret: this.options.appSecret,
        organizationId: connection.organizationId,
        channelIdentityHash: identityHash,
        providerMessageId: event.providerMessageId,
      });
      const now = this.now();
      await this.options.identityStore.putChallenge({
        schemaVersion: 1,
        challengeHash: hashWhatsAppLinkToken(linkToken),
        organizationId: connection.organizationId,
        channelIdentityHash: identityHash,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(),
      });

      const link = `${this.publicOrigin}/link/whatsapp?token=${encodeURIComponent(linkToken)}`;
      await this.options.replyService.send({
        organizationId: connection.organizationId,
        conversationId,
        businessPhoneNumberId: event.phoneNumberId,
        recipientPhone: event.from,
        requestId: `assist-link-${inboundKey}`,
        text: linkMessage(locale, link),
      });
      return 'link_required';
    }

    let responseText = '';
    let outcome: WhatsAppAssistOutcome = 'failed';

    try {
      const idToken = await this.options.delegationTokenProvider.getFirebaseIdToken({
        actorUid: identity.actorUid,
        organizationId: connection.organizationId,
        channelIdentityRef: `wa:${identity.channelIdentityHash.slice(0, 32)}`,
      });

      const result = await this.options.core.handleMessage({
        requestId: `wa-assist-${inboundKey}`,
        correlationId: `wa-${inboundKey}`,
        authToken: `Bearer ${idToken}`,
        requestedOrganizationId: connection.organizationId,
        channel: {
          type: 'whatsapp',
          conversationId,
        },
        locale,
        text: event.text,
      });

      if (result.status === 'success') {
        responseText = result.humanSummary;
        outcome = 'answered';
      } else if (result.status === 'unsupported') {
        responseText = unsupportedMessage(locale);
        outcome = 'unsupported';
      } else if (result.status === 'denied' || result.status === 'needs_context') {
        responseText = deniedMessage(locale);
        outcome = 'denied';
      } else {
        responseText = failedMessage(locale);
        outcome = 'failed';
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (
        code === 'CHANNEL_DELEGATION_ACCESS_DENIED' ||
        code === 'CHANNEL_DELEGATION_IDENTITY_MISMATCH'
      ) {
        responseText = deniedMessage(locale);
        outcome = 'denied';
      } else {
        responseText = failedMessage(locale);
        outcome = 'failed';
      }
    }

    await this.options.replyService.send({
      organizationId: connection.organizationId,
      conversationId,
      businessPhoneNumberId: event.phoneNumberId,
      recipientPhone: event.from,
      requestId: `assist-answer-${inboundKey}`,
      text: responseText,
    });

    return outcome;
  }
}
