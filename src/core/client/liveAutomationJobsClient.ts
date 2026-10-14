import type { LiveConnectSession } from './liveConnectSession';
export type InternalAutomationJobView = {
  id: string; sourceApp: string; trigger: string; conversationId: string; occurredAt: string;
  state: 'pending' | 'processing' | 'complete' | 'needs_review'; attempts: number; resultCode: string | null;
};
export async function listInternalAutomationJobs(session: LiveConnectSession, fetchImpl: typeof fetch = fetch): Promise<InternalAutomationJobView[] | null> {
  const r = await fetchImpl(`/api/core/automations/jobs?organizationId=${encodeURIComponent(session.expectedOrganizationId)}`, {
    headers: { Authorization: `Bearer ${session.idToken}` }, cache: 'no-store',
  });
  if (r.status === 404 || r.status === 403) return null;
  if (!r.ok) throw new Error('AUTOMATION_QUEUE_UNAVAILABLE');
  const result = await r.json();
  if (!Array.isArray(result.jobs) || result.jobs.length > 50) throw new Error('INVALID_AUTOMATION_QUEUE');
  return result.jobs.map((j: InternalAutomationJobView) => {
    if (!j || !/^[a-f0-9]{64}$/.test(j.id) || !['musicscale', 'nestfinance', 'nestjourney', 'whatsapp'].includes(j.sourceApp) ||
        !['pending', 'processing', 'complete', 'needs_review'].includes(j.state) || !Number.isInteger(j.attempts) || j.attempts < 0 ||
        typeof j.conversationId !== 'string' || j.conversationId.length > 180 || /[\\/]/.test(j.conversationId) || !Number.isFinite(Date.parse(j.occurredAt))) throw new Error('INVALID_AUTOMATION_QUEUE');
    return { id: j.id, sourceApp: j.sourceApp, trigger: j.trigger, conversationId: j.conversationId, occurredAt: j.occurredAt, state: j.state, attempts: j.attempts, resultCode: j.resultCode };
  });
}
