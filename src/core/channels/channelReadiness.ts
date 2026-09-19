import type { ConnectRuntimeFirestoreState } from '../runtime/firestoreRuntimeReadiness';

export type ChannelOperationalStatus = 'active' | 'blocked' | 'planned';

export type ChannelReadinessItem = {
  id: 'inapp' | 'whatsapp' | 'instagram' | 'telegram';
  name: string;
  status: ChannelOperationalStatus;
  configured: boolean;
  receiveReady: boolean;
  sendReady: boolean;
  blockers: string[];
  capabilities: string[];
};

export type ConnectChannelReadiness = {
  storageState: ConnectRuntimeFirestoreState;
  channels: ChannelReadinessItem[];
};

function enabled(env: NodeJS.ProcessEnv, key: string): boolean {
  return env[key]?.trim().toLowerCase() === 'true';
}

function present(env: NodeJS.ProcessEnv, key: string): boolean {
  return Boolean(env[key]?.trim());
}

export function evaluateConnectChannelReadiness(
  env: NodeJS.ProcessEnv,
  storageState: ConnectRuntimeFirestoreState,
): ConnectChannelReadiness {
  const inAppConfigured = present(env, 'MILLIONSNEST_HUB_ORIGIN') && present(env, 'MUSICSCALE_ORIGIN');

  const whatsappSecretsConfigured = [
    'CONNECT_WHATSAPP_WEBHOOK_VERIFY_TOKEN',
    'CONNECT_WHATSAPP_APP_SECRET',
    'CONNECT_WHATSAPP_ACCESS_TOKEN',
    'CONNECT_WHATSAPP_PHONE_NUMBER_ID',
  ].every((key) => present(env, key));

  const whatsappWebhookEnabled = enabled(env, 'CONNECT_WHATSAPP_WEBHOOK_ENABLED');
  const durableInboxEnabled = enabled(env, 'CONNECT_INBOX_DURABLE_ENABLED');
  const storageReady = storageState === 'read_write_confirmed';

  const whatsappBlockers: string[] = [];
  if (!whatsappSecretsConfigured) whatsappBlockers.push('provider_credentials_missing');
  if (!whatsappWebhookEnabled) whatsappBlockers.push('webhook_disabled');
  if (!durableInboxEnabled) whatsappBlockers.push('durable_inbox_disabled');
  if (!storageReady) whatsappBlockers.push('durable_storage_not_ready');
  // Provider dispatch intentionally remains separate from receive readiness.
  whatsappBlockers.push('provider_dispatch_not_implemented');

  const receiveReady =
    whatsappSecretsConfigured &&
    whatsappWebhookEnabled &&
    durableInboxEnabled &&
    storageReady;

  return {
    storageState,
    channels: [
      {
        id: 'inapp',
        name: 'Connect In-App',
        status: inAppConfigured ? 'active' : 'blocked',
        configured: inAppConfigured,
        receiveReady: inAppConfigured,
        sendReady: inAppConfigured,
        blockers: inAppConfigured ? [] : ['core_context_not_configured'],
        capabilities: ['assist', 'tool_gateway', 'musicscale_read'],
      },
      {
        id: 'whatsapp',
        name: 'WhatsApp Business Platform',
        status: receiveReady ? 'active' : 'blocked',
        configured: whatsappSecretsConfigured,
        receiveReady,
        // The current outbound boundary is validation-only by design.
        sendReady: false,
        blockers: whatsappBlockers,
        capabilities: [
          'official_webhook_contract',
          'signature_validation',
          'channel_normalization',
          'outbound_validation_only',
        ],
      },
      {
        id: 'instagram',
        name: 'Instagram',
        status: 'planned',
        configured: false,
        receiveReady: false,
        sendReady: false,
        blockers: ['adapter_not_implemented'],
        capabilities: [],
      },
      {
        id: 'telegram',
        name: 'Telegram Bot API',
        status: 'planned',
        configured: false,
        receiveReady: false,
        sendReady: false,
        blockers: ['adapter_not_implemented'],
        capabilities: [],
      },
    ],
  };
}
