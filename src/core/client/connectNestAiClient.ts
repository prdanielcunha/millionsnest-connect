import { createNestAiClient, type Locale } from '@millionsnest/ai';
import type { LanguageCode } from '../../types';
import type { LiveConnectSession, LiveCoreResponse } from './liveConnectSession';
import type { LiveInboxMessage } from './liveInboxClient';
import { getConnectAppCheckToken } from './connectDirectAuth';

function localeOf(language: LanguageCode): Locale {
  if (language === 'en-US') return 'en';
  if (language === 'es-ES') return 'es';
  return 'pt-BR';
}

function clientFor(session: LiveConnectSession, language: LanguageCode) {
  return createNestAiClient({
    appId: 'connect',
    organizationId: session.expectedOrganizationId,
    locale: localeOf(language),
    getFirebaseIdToken: async () => session.idToken,
    getAppCheckToken: getConnectAppCheckToken,
    baseUrl: 'https://ai.millionsnest.com/v1/',
    hubBaseUrl: 'https://www.millionsnest.com/',
  });
}

export type ConnectMessageClassification = {
  intent: string;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  requiresHuman: boolean;
  confidence: number;
};

export class ConnectNestAiClient {
  constructor(
    private readonly session: LiveConnectSession,
    private readonly language: LanguageCode,
  ) {}

  async classifyMessage(message: string): Promise<ConnectMessageClassification> {
    const response = await clientFor(this.session, this.language).run<ConnectMessageClassification>({
      task: 'connect.message.classify',
      input: { message },
    });
    return response.result;
  }

  async suggestReply(input: {
    conversationId: string;
    messages: LiveInboxMessage[];
    currentDraft?: string;
    operationalContext?: Pick<LiveCoreResponse, 'humanSummary' | 'data'> | null;
  }): Promise<string> {
    const client = clientFor(this.session, this.language);
    const safeMessages = input.messages
      .slice(-20)
      .map((message) => ({
        direction: message.direction,
        occurredAt: message.occurredAt,
        body: typeof message.body === 'string' ? message.body.slice(0, 3000) : '',
      }))
      .filter((message) => message.body);

    let text = '';
    for await (const event of client.stream({
      task: 'connect.reply.suggest',
      input: {
        conversationId: input.conversationId,
        messages: safeMessages,
        currentDraft: String(input.currentDraft || '').slice(0, 4000),
        operationalContext: input.operationalContext ?? null,
        authority: {
          mode: 'suggestion_only',
          sendMessage: false,
          humanReviewRequired: true,
        },
      },
    })) {
      if (event.event === 'delta' && typeof event.data.text === 'string') {
        text += event.data.text;
      }
      if (event.event === 'error') {
        throw new Error(String(event.data.error || 'NESTAI_REPLY_SUGGESTION_FAILED'));
      }
    }

    const suggestion = text.trim();
    if (!suggestion) throw new Error('NESTAI_EMPTY_REPLY_SUGGESTION');
    return suggestion.slice(0, 4096);
  }

  async transcribeAudio(input: {
    audioBase64: string;
    mimeType: 'audio/webm' | 'audio/wav' | 'audio/mpeg' | 'audio/mp4' | 'audio/ogg';
    fileName?: string;
  }): Promise<string> {
    const response = await clientFor(this.session, this.language).transcribe<{ text: string }>(
      'connect.audio.transcribe',
      {
        audioBase64: input.audioBase64,
        mimeType: input.mimeType,
        ...(input.fileName ? { fileName: input.fileName } : {}),
        language: localeOf(this.language).split('-')[0],
      },
    );
    const text = String(response.result?.text || '').trim();
    if (!text) throw new Error('NESTAI_EMPTY_TRANSCRIPTION');
    return text;
  }
}
