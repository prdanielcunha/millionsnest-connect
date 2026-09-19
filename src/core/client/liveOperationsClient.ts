import type { LiveConnectSession } from './liveConnectSession';

export type OperationalGateState = 'ready' | 'controlled' | 'blocked';

export type OperationalReadiness = {
  organizationId: string;
  releaseSha?: string;
  generatedAt: string;
  overall: OperationalGateState;
  storageState: 'read_write_confirmed' | 'read_only' | 'denied_or_missing' | 'unknown';
  gates: Array<{
    id: 'core' | 'tool_gateway' | 'structured_audit' | 'canonical_facts' | 'channels' | 'inbox' | 'automations' | 'rollback';
    status: OperationalGateState;
    detail: string;
  }>;
  flags: {
    durableInbox: boolean;
    whatsappWebhook: boolean;
    whatsappOutboundValidation: boolean;
  };
};

export class LiveOperationsClient {
  constructor(private readonly session: LiveConnectSession) {}

  async getReadiness(): Promise<OperationalReadiness> {
    const response = await fetch(
      `/api/core/operations/readiness?organizationId=${encodeURIComponent(this.session.expectedOrganizationId)}`,
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
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.success === false) {
      const error = new Error(body?.code || 'OPERATIONS_READINESS_FAILED');
      (error as any).code = body?.code || 'OPERATIONS_READINESS_FAILED';
      throw error;
    }
    return body as OperationalReadiness;
  }
}
