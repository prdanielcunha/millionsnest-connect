import type { LiveConnectSession } from './liveConnectSession';

export type LiveChannelStatus = 'active' | 'blocked' | 'planned';

export type LiveChannelReadinessItem = {
  id: 'inapp' | 'whatsapp' | 'instagram' | 'telegram';
  name: string;
  status: LiveChannelStatus;
  configured: boolean;
  receiveReady: boolean;
  sendReady: boolean;
  blockers: string[];
  capabilities: string[];
};

export type LiveChannelReadiness = {
  organizationId: string;
  storageState: 'read_write_confirmed' | 'read_only' | 'denied_or_missing' | 'unknown';
  channels: LiveChannelReadinessItem[];
};

async function parseResponse(response: Response): Promise<any> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    const error = new Error(body?.humanSummary || body?.code || 'CHANNEL_READINESS_FAILED');
    (error as any).code = body?.code || 'CHANNEL_READINESS_FAILED';
    throw error;
  }
  return body;
}

export class LiveChannelClient {
  constructor(private readonly session: LiveConnectSession) {}

  async getReadiness(): Promise<LiveChannelReadiness> {
    const response = await fetch(
      `/api/core/channels/readiness?organizationId=${encodeURIComponent(this.session.expectedOrganizationId)}`,
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
    const body = await parseResponse(response);
    return {
      organizationId: String(body.organizationId || this.session.expectedOrganizationId),
      storageState: body.storageState || 'unknown',
      channels: Array.isArray(body.channels) ? body.channels : [],
    };
  }
}
