import type { CanonicalContextProvider } from '../runtime/connectCore';
import { evaluateConnectInboxAuthority } from '../inbox/inboxAuthority';
import type express from 'express';
import { validateAutomationEvent, verifyAutomationSignature, type AutomationJobStore, type InternalAutomationWorker } from './eventJobs';
export function createAutomationEventHandler(store: AutomationJobStore, keys: Record<string, string>, now = () => new Date()) {
  return async (req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const source = String(req.params.sourceApp);
    if (!['musicscale', 'nestfinance', 'nestjourney'].includes(source)) { res.status(404).json({ code: 'EVENT_SOURCE_NOT_CONFIGURED' }); return; }
    const raw = req.body;
    if (!Buffer.isBuffer(raw) || !verifyAutomationSignature(raw, source, req.headers['x-connect-timestamp'], req.headers['x-connect-signature'], keys[source], +now())) {
      res.status(401).json({ code: 'INVALID_EVENT_SIGNATURE' }); return;
    }
    let event;
    try { event = validateAutomationEvent(JSON.parse(raw.toString('utf8')), source, +now()); }
    catch { res.status(400).json({ code: 'INVALID_AUTOMATION_EVENT' }); return; }
    try { const result = await store.enqueue(event, now()); res.status(202).json({ accepted: true, duplicate: result === 'duplicate' }); }
    catch (e) { res.status(e instanceof Error && e.message === 'AUTOMATION_EVENT_ID_COLLISION' ? 409 : 503).json({ code: 'AUTOMATION_EVENT_NOT_ACCEPTED' }); }
  };
}
export function createAutomationWorkerHandler(worker: InternalAutomationWorker, secret: string, now = () => new Date(),
  catchup?: { run(limit: number): Promise<{ scanned: number; recovered: number; review: number; retry: number }> }) {
  return async (req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!Buffer.isBuffer(req.body) || !verifyAutomationSignature(req.body, 'worker', req.headers['x-connect-timestamp'], req.headers['x-connect-signature'], secret, +now())) {
      res.status(401).json({ code: 'WORKER_AUTH_REQUIRED' }); return;
    }
    let limit: number;
    try {
      const body = JSON.parse(req.body.toString('utf8'));
      if (Object.keys(body).some(k => k !== 'limit') || !Number.isInteger(body.limit) || body.limit < 1 || body.limit > 10) throw new Error();
      limit = body.limit;
    } catch { res.status(400).json({ code: 'INVALID_WORKER_BATCH' }); return; }
    try {
      // Authenticated only. Durable Inbox reconciliation precedes existing
      // leased-job execution; any failure leaves messages for the next run.
      const recovery = catchup ? await catchup.run(limit) : null;
      res.json({ ...await worker.run(limit), ...(recovery ? { recovery } : {}) });
    } catch { res.status(503).json({ code: 'AUTOMATION_WORKER_UNAVAILABLE' }); }
  };
}

export function createAutomationJobsReadHandler(store: AutomationJobStore, contextProvider: CanonicalContextProvider) {
  return async (req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const organizationId = req.query.organizationId, authToken = req.headers.authorization;
    if (typeof authToken !== 'string' || !/^Bearer\s+\S+$/i.test(authToken)) { res.status(401).json({ code: 'AUTH_REQUIRED' }); return; }
    if (typeof organizationId !== 'string' || !organizationId || organizationId.length > 180 || /[\\/]/.test(organizationId)) { res.status(400).json({ code: 'ORGANIZATION_REQUIRED' }); return; }
    try {
      const result = await contextProvider.resolve({ authToken, requestedOrganizationId: organizationId });
      if (result.status !== 'resolved' || result.context.organizationId !== organizationId || !evaluateConnectInboxAuthority(result.context, 'manage').allowed) { res.status(403).json({ code: 'AUTOMATION_ACCESS_DENIED' }); return; }
      const jobs = await store.listForOrganization(organizationId);
      res.json({ jobs: jobs.map(job => ({ id: job.id, sourceApp: job.event.sourceApp, trigger: job.event.trigger, conversationId: job.event.conversationId,
        occurredAt: job.event.occurredAt, state: job.state, attempts: job.attempts, resultCode: job.resultCode ?? null })) });
    } catch { res.status(503).json({ code: 'AUTOMATION_STORAGE_UNAVAILABLE' }); }
  };
}
