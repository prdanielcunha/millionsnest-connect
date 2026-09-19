import { evaluateConnectChannelReadiness } from '../channels/channelReadiness';
import { evaluateConnectInboxReadiness } from '../inbox/inboxReadiness';
import type { ConnectRuntimeFirestoreState } from '../runtime/firestoreRuntimeReadiness';

export type OperationalGateState = 'ready' | 'controlled' | 'blocked';

export type ConnectOperationalReadiness = {
  releaseSha?: string;
  generatedAt: string;
  overall: OperationalGateState;
  storageState: ConnectRuntimeFirestoreState;
  gates: Array<{
    id:
      | 'core'
      | 'tool_gateway'
      | 'structured_audit'
      | 'canonical_facts'
      | 'channels'
      | 'inbox'
      | 'automations'
      | 'rollback';
    status: OperationalGateState;
    detail: string;
  }>;
  flags: {
    durableInbox: boolean;
    whatsappWebhook: boolean;
    whatsappOutboundValidation: boolean;
  };
};

function enabled(env: NodeJS.ProcessEnv, key: string): boolean {
  return env[key]?.trim().toLowerCase() === 'true';
}

export function evaluateConnectOperationalReadiness(
  env: NodeJS.ProcessEnv,
  storageState: ConnectRuntimeFirestoreState,
  now: Date = new Date(),
): ConnectOperationalReadiness {
  const channels = evaluateConnectChannelReadiness(env, storageState);
  const inbox = evaluateConnectInboxReadiness(env, storageState);
  const inapp = channels.channels.find((item) => item.id === 'inapp');
  const whatsapp = channels.channels.find((item) => item.id === 'whatsapp');

  const gates: ConnectOperationalReadiness['gates'] = [
    {
      id: 'core',
      status: inapp?.status === 'active' ? 'ready' : 'blocked',
      detail: inapp?.status === 'active' ? 'hub_and_core_configured' : 'core_context_not_configured',
    },
    {
      id: 'tool_gateway',
      status: inapp?.capabilities.includes('musicscale_read') ? 'ready' : 'blocked',
      detail: inapp?.capabilities.includes('musicscale_read') ? 'musicscale_read_vertical_live' : 'musicscale_read_vertical_unavailable',
    },
    {
      id: 'structured_audit',
      status: 'ready',
      detail: 'pii_minimized_structured_logs',
    },
    {
      id: 'canonical_facts',
      status: 'ready',
      detail: 'tool_actions_emit_canonical_facts',
    },
    {
      id: 'channels',
      status: whatsapp?.sendReady ? 'ready' : 'controlled',
      detail: whatsapp?.sendReady ? 'official_channels_operational' : 'whatsapp_dispatch_not_ready',
    },
    {
      id: 'inbox',
      status: inbox.state === 'available' ? 'ready' : inbox.state,
      detail: inbox.state === 'available' ? 'inbox_available' : 'inbox_activation_gated',
    },
    {
      id: 'automations',
      status: 'controlled',
      detail: 'control_plane_live_worker_not_mounted',
    },
    {
      id: 'rollback',
      status: 'ready',
      detail: 'feature_flags_and_immutable_release',
    },
  ];

  const overall: OperationalGateState = gates.some((gate) => gate.status === 'blocked')
    ? 'blocked'
    : gates.some((gate) => gate.status === 'controlled')
      ? 'controlled'
      : 'ready';

  return {
    releaseSha: env.CONNECT_RELEASE_SHA?.trim() || undefined,
    generatedAt: now.toISOString(),
    overall,
    storageState,
    gates,
    flags: {
      durableInbox: enabled(env, 'CONNECT_INBOX_DURABLE_ENABLED'),
      whatsappWebhook: enabled(env, 'CONNECT_WHATSAPP_WEBHOOK_ENABLED'),
      whatsappOutboundValidation: enabled(env, 'CONNECT_WHATSAPP_OUTBOUND_VALIDATION_ENABLED'),
    },
  };
}
