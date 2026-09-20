import type { LiveConnectSession } from './liveConnectSession';

export type LiveInboxReadiness = {
  organizationId: string;
  authoritySource: string;
  state: 'available' | 'controlled' | 'blocked';
  durableInboxEnabled: boolean;
  storageState: 'read_write_confirmed' | 'read_only' | 'denied_or_missing' | 'unknown';
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

export type LiveInboxConversation = {
  schemaVersion: 1;
  organizationId: string;
  conversationId: string;
  status: 'new' | 'in_progress' | 'waiting_person' | 'waiting_team' | 'resolved' | 'archived';
  mode: 'automatic' | 'approval' | 'human';
  automationPaused: boolean;
  assignedTo?: { type: 'user' | 'team'; ref: string };
  openedAt: string;
  updatedAt: string;
  lastEventId: string;
  sourceEventCount: number;
  lastEvidenceRef: string;
};

export type LiveInboxMessage = {
  messageId: string;
  channel: string;
  direction: 'inbound' | 'outbound';
  messageType: string;
  body: string | null;
  occurredAt: string;
  deliveryStatus: 'received' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  deliveryUpdatedAt: string | null;
};

async function parse(response: Response): Promise<any> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    const error = new Error(body?.humanSummary || body?.code || 'INBOX_READINESS_FAILED');
    (error as any).code = body?.code || 'INBOX_READINESS_FAILED';
    throw error;
  }
  return body;
}

export class LiveInboxClient {
  constructor(private readonly session: LiveConnectSession) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.session.idToken}`,
      'X-Organization-Id': this.session.expectedOrganizationId,
      Accept: 'application/json',
    };
  }

  async listConversations(limit = 50): Promise<LiveInboxConversation[]> {
    const response = await fetch(
      `/api/core/inbox/conversations?organizationId=${encodeURIComponent(this.session.expectedOrganizationId)}&limit=${Math.max(1, Math.min(limit, 100))}`,
      {
        method: 'GET',
        headers: this.headers(),
        cache: 'no-store',
      },
    );
    const body = await parse(response);
    return Array.isArray(body.conversations) ? body.conversations : [];
  }

  async listMessages(conversationId: string, limit = 100): Promise<LiveInboxMessage[]> {
    const response = await fetch(
      `/api/core/inbox/threads/${encodeURIComponent(conversationId)}/messages?organizationId=${encodeURIComponent(this.session.expectedOrganizationId)}&limit=${Math.max(1, Math.min(limit, 200))}`,
      {
        method: 'GET',
        headers: this.headers(),
        cache: 'no-store',
      },
    );
    const body = await parse(response);
    return Array.isArray(body.messages) ? body.messages : [];
  }

  async getReadiness(): Promise<LiveInboxReadiness> {
    const response = await fetch(
      `/api/core/inbox/readiness?organizationId=${encodeURIComponent(this.session.expectedOrganizationId)}`,
      {
        method: 'GET',
        headers: this.headers(),
        cache: 'no-store',
      },
    );
    const body = await parse(response);
    return {
      organizationId: String(body.organizationId || this.session.expectedOrganizationId),
      authoritySource: String(body.authoritySource || ''),
      state: body.state || 'blocked',
      durableInboxEnabled: body.durableInboxEnabled === true,
      storageState: body.storageState || 'unknown',
      foundations: Array.isArray(body.foundations) ? body.foundations : [],
      blockers: Array.isArray(body.blockers) ? body.blockers : [],
    };
  }
}
