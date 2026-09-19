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
  const storageReady = storageState === 'read_write_confirmed';

  const blockers: string[] = [];
  if (!storageReady) blockers.push('durable_storage_not_ready');
  if (!durableInboxEnabled) blockers.push('durable_inbox_disabled');
  blockers.push('message_content_store_not_mounted');
  blockers.push('provider_ingestion_not_mounted');
  blockers.push('human_reply_not_mounted');

  return {
    state: storageReady && durableInboxEnabled ? 'controlled' : 'blocked',
    durableInboxEnabled,
    storageState,
    foundations: [
      { id: 'thread_state_machine', status: 'ready' },
      { id: 'durable_event_store', status: storageReady && durableInboxEnabled ? 'ready' : 'gated' },
      { id: 'authority', status: 'ready' },
      { id: 'message_content_store', status: 'next' },
      { id: 'provider_ingestion', status: 'next' },
      { id: 'human_reply', status: 'next' },
    ],
    blockers,
  };
}
