import type { ConnectRuntimeFirestoreState } from '../runtime/firestoreRuntimeReadiness';

export type InboxActivationState = 'available' | 'controlled' | 'blocked';

export type ConnectInboxReadiness = {
  state: InboxActivationState;
  durableInboxEnabled: boolean;
  storageState: ConnectRuntimeFirestoreState;
  foundations: Array<{
    id:
      | 'thread_state_machine'
      | 'durable_event_store'
      | 'authority'
      | 'message_content_store'
      | 'provider_ingestion'
      | 'human_reply';
    status: 'ready' | 'gated' | 'next';
  }>;
  blockers: string[];
};

function enabled(env: NodeJS.ProcessEnv, key: string): boolean {
  return env[key]?.trim().toLowerCase() === 'true';
}

/**
 * Truthful A8 readiness model.
 *
 * The canonical thread state/event store can exist before message content,
 * provider ingestion and human reply are mounted. Those boundaries are kept
 * separate because the durable thread contract intentionally contains no
 * message body or contact PII.
 */
export function evaluateConnectInboxReadiness(
  env: NodeJS.ProcessEnv,
  storageState: ConnectRuntimeFirestoreState,
): ConnectInboxReadiness {
  const durableInboxEnabled = enabled(env, 'CONNECT_INBOX_DURABLE_ENABLED');
  const messageContentEnabled = enabled(env, 'CONNECT_INBOX_MESSAGE_CONTENT_ENABLED');
  const providerIngestionEnabled = enabled(env, 'CONNECT_WHATSAPP_INGESTION_ENABLED');
  const humanReplyEnabled = enabled(env, 'CONNECT_INBOX_HUMAN_REPLY_ENABLED');
  const storageReady = storageState === 'read_write_confirmed';

  const durableReady = storageReady && durableInboxEnabled;
  const messageContentReady = durableReady && messageContentEnabled;
  const providerIngestionReady = messageContentReady && providerIngestionEnabled;
  const humanReplyReady = providerIngestionReady && humanReplyEnabled;

  const blockers: string[] = [];
  if (!storageReady) blockers.push('durable_storage_not_ready');
  if (!durableInboxEnabled) blockers.push('durable_inbox_disabled');
  if (!messageContentReady) blockers.push('message_content_store_not_mounted');
  if (!providerIngestionReady) blockers.push('provider_ingestion_not_mounted');
  if (!humanReplyReady) blockers.push('human_reply_not_mounted');

  return {
    state: humanReplyReady
      ? 'available'
      : durableReady
        ? 'controlled'
        : 'blocked',
    durableInboxEnabled,
    storageState,
    foundations: [
      { id: 'thread_state_machine', status: 'ready' },
      { id: 'durable_event_store', status: durableReady ? 'ready' : 'gated' },
      { id: 'authority', status: 'ready' },
      { id: 'message_content_store', status: messageContentReady ? 'ready' : durableReady ? 'gated' : 'next' },
      { id: 'provider_ingestion', status: providerIngestionReady ? 'ready' : messageContentReady ? 'gated' : 'next' },
      { id: 'human_reply', status: humanReplyReady ? 'ready' : providerIngestionReady ? 'gated' : 'next' },
    ],
    blockers,
  };
}
