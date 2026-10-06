import { createHash } from 'node:crypto';
import {
  buildWhatsAppChannelLinkUrl,
  createWhatsAppChannelLinkToken,
  deriveWhatsAppChannelIdentityRef,
  verifyWhatsAppChannelLinkToken,
} from '../channels/channelIdentityLink';
import type {
  WhatsAppChannelIdentityBindingStore,
} from '../channels/firestoreWhatsAppChannelIdentityBindingStore';
import type { WhatsAppConnectionRegistry } from '../channels/whatsappConnectionRegistry';
import type { WhatsAppNormalizedEvent } from '../channels/whatsappOfficial';
import {
  createConversationIdFromChannelIdentity,
  type ConnectMessageContentRecord,
  type ConnectMessageContentStore,
} from '../inbox/messageContentStore';
import type { WhatsAppAssistReplyService } from '../inbox/whatsappAssistReplyService';
import {
  resolveConnectCoreIntent,
  type ConnectCoreResponse,
  type ConnectCoreService,
} from './connectCore';
import {
  FirebaseCustomTokenExchanger,
  HubChannelGrantError,
  type HubChannelGrantHttpClient,
} from './hubChannelGrantHttpClient';

type SupportedLocale = 'pt-BR' | 'en-US' | 'es-ES';

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

function requestId(kind: 'link' | 'answer', providerMessageId: string): string {
  return `wa-assist-${kind}-${digest(providerMessageId)}`;
}

function localeFromText(text: string): SupportedLocale {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  if (
    /\b(what|my|next|schedule|songs|playing|confirmed|chords|chart)\b/.test(normalized)
  ) return 'en-US';
  if (
    /\b(cual|mi|proxima|escala|canciones|asistencia|confirmado|confirmada|acordes)\b/.test(normalized)
  ) return 'es-ES';
  return 'pt-BR';
}

function linkPrompt(locale: SupportedLocale, link: string): string {
  if (locale === 'en-US') {
    return [
      'To access your MusicScale information here, securely link this WhatsApp to your MillionsNest account:',
      link,
      '',
      'This link expires in 15 minutes. After confirmation, I will continue this request automatically.',
    ].join('\n');
  }
  if (locale === 'es-ES') {
    return [
      'Para consultar tu información de MusicScale por aquí, vincula de forma segura este WhatsApp a tu cuenta MillionsNest:',
      link,
      '',
      'El enlace vence en 15 minutos. Después de confirmar, continuaré esta solicitud automáticamente.',
    ].join('\n');
  }
  return [
    'Para consultar informações do seu MusicScale por aqui, vincule com segurança este WhatsApp à sua conta MillionsNest:',
    link,
    '',
    'O link expira em 15 minutos. Depois da confirmação, eu continuo este pedido automaticamente.',
  ].join('\n');
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeText(value: unknown, max = 240): string {
  return typeof value === 'string'
    ? value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max)
    : '';
}

function trustedMusicScaleDeepLink(value: string | undefined): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'musicscale.millionsnest.com') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function formatCoreResponse(response: ConnectCoreResponse, locale: SupportedLocale): string {
  const summary = safeText(response.humanSummary, 700) ||
    (locale === 'en-US'
      ? 'I finished the request.'
      : locale === 'es-ES'
        ? 'Terminé la solicitud.'
        : 'Concluí a consulta.');

  if (response.status !== 'success') return summary;

  const lines = [summary];
  const data = object(response.data);

  if (response.intent === 'get_next_schedule' && data) {
    const date = safeText(data.date, 32);
    const time = safeText(data.time, 32);
    const functionNames = Array.isArray(data.functionNames)
      ? data.functionNames.map((value) => safeText(value, 80)).filter(Boolean).slice(0, 8)
      : [];
    if (date || time) {
      lines.push('', [date, time].filter(Boolean).join(' · '));
    }
    if (functionNames.length > 0) {
      lines.push(functionNames.join(' · '));
    }
  }

  if (response.intent === 'get_next_schedule_repertoire' && data) {
    const repertoire = Array.isArray(data.repertoire) ? data.repertoire : [];
    const songs = repertoire
      .slice(0, 20)
      .flatMap((entry, index) => {
        const song = object(entry);
        if (!song) return [];
        const title = safeText(song.title, 160);
        if (!title) return [];
        const key = safeText(song.scheduledKey, 24);
        return [`${index + 1}. ${title}${key ? ` — ${key}` : ''}`];
      });
    if (songs.length > 0) lines.push('', ...songs);
  }

  if (response.intent === 'get_next_schedule_presence' && data) {
    const presence = object(data.presence);
    const status = safeText(presence?.status, 32);
    const labels: Record<SupportedLocale, Record<string, string>> = {
      'pt-BR': {
        pending: 'Presença: pendente',
        accepted: 'Presença: confirmada',
        maybe: 'Presença: talvez',
        declined: 'Presença: não vou',
        mixed: 'Presença: respostas divergentes',
      },
      'en-US': {
        pending: 'Attendance: pending',
        accepted: 'Attendance: confirmed',
        maybe: 'Attendance: maybe',
        declined: 'Attendance: cannot attend',
        mixed: 'Attendance: mixed responses',
      },
      'es-ES': {
        pending: 'Asistencia: pendiente',
        accepted: 'Asistencia: confirmada',
        maybe: 'Asistencia: tal vez',
        declined: 'Asistencia: no asistiré',
        mixed: 'Asistencia: respuestas diferentes',
      },
    };
    if (status && labels[locale][status]) lines.push('', labels[locale][status]);
  }

  const deepLink = trustedMusicScaleDeepLink(response.deepLink);
  if (deepLink) {
    const label = locale === 'en-US'
      ? 'Open in MusicScale'
      : locale === 'es-ES'
        ? 'Abrir en MusicScale'
        : 'Abrir no MusicScale';
    lines.push('', `${label}: ${deepLink}`);
  }

  return lines.join('\n').slice(0, 4096);
}

function supportedForWhatsApp(intent: ReturnType<typeof resolveConnectCoreIntent>): boolean {
  return intent === 'get_next_schedule' ||
    intent === 'get_next_schedule_repertoire' ||
    intent === 'get_next_schedule_presence' ||
    intent === 'get_next_schedule_chart';
}

export class WhatsAppAssistOrchestrator {
  private readonly now: () => Date;

  constructor(private readonly options: {
    registry: WhatsAppConnectionRegistry;
    bindingStore: WhatsAppChannelIdentityBindingStore;
    messageStore: ConnectMessageContentStore;
    hubClient: HubChannelGrantHttpClient;
    tokenExchanger: FirebaseCustomTokenExchanger;
    core: ConnectCoreService;
    replyService: WhatsAppAssistReplyService;
    linkRootSecret: string;
    publicOrigin: string;
    now?: () => Date;
    logger?: {
      info(message: string, meta?: Record<string, unknown>): void;
      warn?(message: string, meta?: Record<string, unknown>): void;
      error?(message: string, meta?: Record<string, unknown>): void;
    };
  }) {
    this.now = options.now ?? (() => new Date());
  }

  async afterIngest(events: WhatsAppNormalizedEvent[]): Promise<void> {
    for (const event of events) {
      if (event.kind !== 'message' || event.messageType !== 'text' || !event.text?.trim()) continue;
      const intent = resolveConnectCoreIntent(event.text);
      if (!supportedForWhatsApp(intent)) continue;
      await this.processMessage(event);
    }
  }

  async confirmLink(input: {
    token: string;
    authToken: string;
    targetOrganizationId: string;
  }): Promise<{
    success: true;
    targetOrganizationId: string;
    answerTriggered: boolean;
  }> {
    const payload = verifyWhatsAppChannelLinkToken({
      token: input.token,
      rootSecret: this.options.linkRootSecret,
      nowMs: this.now().getTime(),
    });

    const original = await this.options.messageStore.getByProviderMessageId({
      channel: 'whatsapp',
      providerMessageId: payload.providerMessageId,
    });
    if (!original || !this.originalMatchesLink(original, payload)) {
      throw new Error('WHATSAPP_LINK_EVIDENCE_MISMATCH');
    }

    const grant = await this.options.hubClient.createGrant({
      authToken: input.authToken,
      channelIdentityRef: payload.channelIdentityRef,
      organizationId: input.targetOrganizationId,
    });

    await this.options.bindingStore.put({
      schemaVersion: 1,
      channelOrganizationId: payload.channelOrganizationId,
      channelIdentityRef: payload.channelIdentityRef,
      grantRef: grant.grantRef,
      grantSecret: grant.grantSecret,
      targetOrganizationId: grant.organizationId,
      linkedAtMs: this.now().getTime(),
      expiresAtMs: grant.expiresAt,
    });

    let answerTriggered = false;
    if (
      original.senderRef &&
      original.recipientRef &&
      original.messageType === 'text' &&
      original.body
    ) {
      await this.processMessage({
        kind: 'message',
        providerMessageId: original.providerMessageId,
        from: original.senderRef,
        phoneNumberId: original.recipientRef,
        timestamp: String(Math.floor(new Date(original.occurredAt).getTime() / 1000)),
        messageType: 'text',
        text: original.body,
      });
      answerTriggered = true;
    }

    return {
      success: true,
      targetOrganizationId: grant.organizationId,
      answerTriggered,
    };
  }

  private originalMatchesLink(
    original: ConnectMessageContentRecord,
    payload: ReturnType<typeof verifyWhatsAppChannelLinkToken>,
  ): boolean {
    if (
      original.organizationId !== payload.channelOrganizationId ||
      original.conversationId !== payload.conversationId ||
      original.direction !== 'inbound' ||
      original.channel !== 'whatsapp' ||
      !original.senderRef ||
      !original.recipientRef
    ) return false;

    const identityRef = deriveWhatsAppChannelIdentityRef({
      providerUserId: original.senderRef,
      phoneNumberId: original.recipientRef,
      rootSecret: this.options.linkRootSecret,
    });
    return identityRef === payload.channelIdentityRef;
  }

  private async processMessage(
    event: Extract<WhatsAppNormalizedEvent, { kind: 'message' }>,
  ): Promise<void> {
    const connection = this.options.registry.resolve(event.phoneNumberId);
    if (!connection || !event.text) return;

    const conversationId = createConversationIdFromChannelIdentity({
      organizationId: connection.organizationId,
      channel: 'whatsapp',
      connectionRef: connection.connectionRef,
      channelUserId: event.from,
    });
    const locale = localeFromText(event.text);
    const channelIdentityRef = deriveWhatsAppChannelIdentityRef({
      providerUserId: event.from,
      phoneNumberId: event.phoneNumberId,
      rootSecret: this.options.linkRootSecret,
    });

    const binding = await this.options.bindingStore.get({
      channelOrganizationId: connection.organizationId,
      channelIdentityRef,
    });

    if (!binding || binding.expiresAtMs <= this.now().getTime()) {
      await this.sendLinkPrompt({
        event,
        channelOrganizationId: connection.organizationId,
        conversationId,
        channelIdentityRef,
        locale,
      });
      return;
    }

    let session;
    try {
      session = await this.options.hubClient.exchangeGrant({
        grantRef: binding.grantRef,
        grantSecret: binding.grantSecret,
      });
    } catch (error) {
      if (error instanceof HubChannelGrantError && (error.status === 401 || error.status === 403)) {
        await this.sendLinkPrompt({
          event,
          channelOrganizationId: connection.organizationId,
          conversationId,
          channelIdentityRef,
          locale,
        });
        return;
      }
      throw error;
    }

    if (session.organizationId !== binding.targetOrganizationId) {
      throw new Error('CHANNEL_SESSION_ORGANIZATION_MISMATCH');
    }

    const idToken = await this.options.tokenExchanger.exchange({
      customToken: session.customToken,
      expectedUid: session.userId,
    });
    const coreRequestId = `wa-core-${digest(event.providerMessageId)}`;
    const response = await this.options.core.handleMessage({
      requestId: coreRequestId,
      correlationId: coreRequestId,
      authToken: idToken,
      requestedOrganizationId: session.organizationId,
      channel: {
        type: 'whatsapp',
        conversationId,
      },
      locale,
      text: event.text,
    });

    await this.options.replyService.send({
      organizationId: connection.organizationId,
      conversationId,
      requestId: requestId('answer', event.providerMessageId),
      phoneNumberId: event.phoneNumberId,
      recipientPhone: event.from,
      text: formatCoreResponse(response, locale),
    });

    this.options.logger?.info('CONNECT_WHATSAPP_ASSIST_COMPLETED', {
      intent: response.intent,
      result: response.status,
      channelOrganizationId: connection.organizationId,
      targetOrganizationId: session.organizationId,
    });
  }

  private async sendLinkPrompt(input: {
    event: Extract<WhatsAppNormalizedEvent, { kind: 'message' }>;
    channelOrganizationId: string;
    conversationId: string;
    channelIdentityRef: string;
    locale: SupportedLocale;
  }) {
    const token = createWhatsAppChannelLinkToken({
      channelIdentityRef: input.channelIdentityRef,
      channelOrganizationId: input.channelOrganizationId,
      conversationId: input.conversationId,
      providerMessageId: input.event.providerMessageId,
      rootSecret: this.options.linkRootSecret,
      nowMs: this.now().getTime(),
    });
    const link = buildWhatsAppChannelLinkUrl(this.options.publicOrigin, token);

    await this.options.replyService.send({
      organizationId: input.channelOrganizationId,
      conversationId: input.conversationId,
      requestId: requestId('link', input.event.providerMessageId),
      phoneNumberId: input.event.phoneNumberId,
      recipientPhone: input.event.from,
      text: linkPrompt(input.locale, link),
    });

    this.options.logger?.info('CONNECT_WHATSAPP_ASSIST_LINK_REQUIRED', {
      channelOrganizationId: input.channelOrganizationId,
    });
  }
}
