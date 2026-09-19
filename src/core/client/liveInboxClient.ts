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

  async getReadiness(): Promise<LiveInboxReadiness> {
    const response = await fetch(
      `/api/core/inbox/readiness?organizationId=${encodeURIComponent(this.session.expectedOrganizationId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.session.idToken}`,
          'X-Organization-Id': this.session.expectedOrganizationId,
          Accept: 'application/json',
        },
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
