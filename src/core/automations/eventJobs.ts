import { createHash, createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { GoogleMetadataAccessTokenProvider, type ConnectRuntimeAccessTokenProvider } from '../inbox/firestoreThreadStore';
export type InternalAutomationEvent = {
  schemaVersion: 1; sourceApp: 'whatsapp' | 'musicscale' | 'nestfinance' | 'nestjourney';
  eventId: string; organizationId: string; conversationId: string; occurredAt: string;
  trigger: string; recipientUid?: string; messageId?: string;
};
const triggers = { musicscale: ['scale.published', 'scale.presence_pending'], nestfinance: ['document.pending'], nestjourney: ['followup.due'], whatsapp: ['inbox.message_received'] };
export function jobId(event: InternalAutomationEvent) { return createHash('sha256').update(JSON.stringify([event.sourceApp, event.organizationId, event.eventId])).digest('hex'); }
export function validateAutomationEvent(raw: unknown, sourceApp: string, now: number): InternalAutomationEvent {
  const e = raw as InternalAutomationEvent;
  if (!e || Object.keys(e).some(k => !['schemaVersion', 'sourceApp', 'eventId', 'organizationId', 'conversationId', 'occurredAt', 'trigger', 'recipientUid', 'messageId'].includes(k)) || e.schemaVersion !== 1 ||
      !Object.hasOwn(triggers, sourceApp) || e.sourceApp !== sourceApp || !triggers[e.sourceApp].includes(e.trigger)) throw new Error('INVALID_AUTOMATION_EVENT');
  for (const value of [e.eventId, e.organizationId, e.conversationId, e.sourceApp === 'whatsapp' ? e.messageId : e.recipientUid]) {
    if (typeof value !== 'string' || !value || value.length > 180 || /[\\/\u0000-\u001f]/.test(value)) throw new Error('INVALID_AUTOMATION_SCOPE');
  }
  const time = Date.parse(e.occurredAt);
  if (!Number.isFinite(time) || time > now + 30000 || time < now - 7 * 86400000) throw new Error('AUTOMATION_EVENT_EXPIRED');
  return { schemaVersion: 1, sourceApp: e.sourceApp, eventId: e.eventId, organizationId: e.organizationId, conversationId: e.conversationId,
    occurredAt: new Date(time).toISOString(), trigger: e.trigger, ...(e.sourceApp === 'whatsapp' ? { messageId: e.messageId } : { recipientUid: e.recipientUid }) };
}
export function verifyAutomationSignature(raw: Buffer, source: string, timestamp: unknown, signature: unknown, secret: string | undefined, now: number): boolean {
  if (!secret || secret.length < 32 || typeof timestamp !== 'string' || !/^\d{13}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300000 || typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(source + '\n' + timestamp + '\n').update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
export type AutomationJob = { id: string; event: InternalAutomationEvent; state: 'pending' | 'processing' | 'complete' | 'needs_review'; attempts: number; availableAt: string; leaseToken?: string; leaseExpiresAt?: string; resultCode?: string };
export interface AutomationJobStore {
  enqueue(event: InternalAutomationEvent, now: Date): Promise<'created' | 'duplicate'>;
  listForOrganization(organizationId: string): Promise<AutomationJob[]>;
  pending(limit: number): Promise<AutomationJob[]>;
  lease(job: AutomationJob, now: Date): Promise<AutomationJob | null>;
  finish(job: AutomationJob, state: AutomationJob['state'], code: string, now: Date): Promise<void>;
}
function fingerprint(event: InternalAutomationEvent) { return createHash('sha256').update(JSON.stringify(event)).digest('hex'); }
export class FirestoreAutomationJobStore implements AutomationJobStore {
  private readonly base: string; private readonly token: ConnectRuntimeAccessTokenProvider;
  constructor(project: string, private readonly fetchImpl: typeof fetch = fetch, token?: ConnectRuntimeAccessTokenProvider) {
    if (!/^[a-z0-9][a-z0-9-]{4,62}[a-z0-9]$/.test(project)) throw new Error('INVALID_FIRESTORE_PROJECT_ID');
    this.base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
    this.token = token ?? new GoogleMetadataAccessTokenProvider({ fetchImpl });
  }
  private async request(path: string, init: RequestInit = {}) {
    return this.fetchImpl(this.base + path, { ...init, signal: AbortSignal.timeout(8000), headers: { Authorization: `Bearer ${await this.token.getAccessToken()}`, 'Content-Type': 'application/json' } });
  }
  private fields(job: AutomationJob, now: Date) { return { organizationId: { stringValue: job.event.organizationId }, state: { stringValue: job.state }, recordJson: { stringValue: JSON.stringify(job) }, eventFingerprint: { stringValue: fingerprint(job.event) }, expiresAt: { timestampValue: new Date(+now + 30 * 86400000).toISOString() } }; }
  private async read(id: string): Promise<{ job: AutomationJob; updateTime: string } | null> {
    const r = await this.request(`/connectAutomationJobs/${id}`); if (r.status === 404) return null;
    if (!r.ok) throw new Error('AUTOMATION_STORAGE_UNAVAILABLE');
    const d = await r.json() as { updateTime: string; fields: { recordJson: { stringValue: string } } };
    return { job: JSON.parse(d.fields.recordJson.stringValue), updateTime: d.updateTime };
  }
  async enqueue(event: InternalAutomationEvent, now: Date) {
    const id = jobId(event), job: AutomationJob = { id, event, state: 'pending', attempts: 0, availableAt: now.toISOString() };
    const duplicate = async () => {
      const existing = await this.read(id);
      if (!existing) return false;
      if (fingerprint(existing.job.event) !== fingerprint(event)) throw new Error('AUTOMATION_EVENT_ID_COLLISION');
      return true;
    };
    if (await duplicate()) return 'duplicate' as const;
    const budgetId = createHash('sha256').update(JSON.stringify([event.organizationId, now.toISOString().slice(0, 10)])).digest('hex');
    const budgetPath = `/connectAutomationBudgets/${budgetId}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      const budgetResponse = await this.request(budgetPath);
      if (!budgetResponse.ok && budgetResponse.status !== 404) throw new Error('AUTOMATION_STORAGE_UNAVAILABLE');
      const budget = budgetResponse.ok ? await budgetResponse.json() as { updateTime: string; fields: { organizationId: { stringValue: string }; count: { integerValue: string } } } : null;
      if (budget && budget.fields.organizationId.stringValue !== event.organizationId) throw new Error('AUTOMATION_BUDGET_SCOPE_MISMATCH');
      const count = budget ? Number(budget.fields.count.integerValue) : 0;
      if (!Number.isInteger(count) || count < 0 || count >= 100) throw new Error('AUTOMATION_DAILY_LIMIT');
      const root = this.base.replace('https://firestore.googleapis.com/v1/', '');
      const r = await this.request(':commit', { method: 'POST', body: JSON.stringify({ writes: [
        { update: { name: `${root}/connectAutomationJobs/${id}`, fields: this.fields(job, now) }, currentDocument: { exists: false } },
        { update: { name: root + budgetPath, fields: { organizationId: { stringValue: event.organizationId }, count: { integerValue: String(count + 1) }, expiresAt: { timestampValue: new Date(+now + 3 * 86400000).toISOString() } } }, currentDocument: budget ? { updateTime: budget.updateTime } : { exists: false } },
      ] }) });
      if (r.ok) return 'created' as const;
      if (![409, 412].includes(r.status)) throw new Error('AUTOMATION_STORAGE_UNAVAILABLE');
      if (await duplicate()) return 'duplicate' as const;
    }
    throw new Error('AUTOMATION_CONCURRENT_ENQUEUE');
  }
  async listForOrganization(organizationId: string): Promise<AutomationJob[]> {
    const r = await this.request(':runQuery', { method: 'POST', body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'connectAutomationJobs' }], where: { fieldFilter: { field: { fieldPath: 'organizationId' }, op: 'EQUAL', value: { stringValue: organizationId } } }, limit: 50,
    } }) });
    if (!r.ok) throw new Error('AUTOMATION_STORAGE_UNAVAILABLE');
    const rows = await r.json() as Array<{ document?: { fields: { recordJson: { stringValue: string } } } }>;
    return rows.flatMap(row => row.document ? [JSON.parse(row.document.fields.recordJson.stringValue) as AutomationJob] : []).filter(job => job.event.organizationId === organizationId);
  }
  async pending(limit: number): Promise<AutomationJob[]> {
    const jobs: AutomationJob[] = [];
    // Single-field filters avoid requiring an undisclosed composite index.
    for (const state of ['pending', 'processing']) {
      const r = await this.request(':runQuery', { method: 'POST', body: JSON.stringify({ structuredQuery: {
        from: [{ collectionId: 'connectAutomationJobs' }], where: { fieldFilter: { field: { fieldPath: 'state' }, op: 'EQUAL', value: { stringValue: state } } }, limit: Math.min(25, limit),
      } }) });
      if (!r.ok) throw new Error('AUTOMATION_STORAGE_UNAVAILABLE');
      const rows = await r.json() as Array<{ document?: { fields: { recordJson: { stringValue: string } } } }>;
      for (const row of rows) if (row.document) jobs.push(JSON.parse(row.document.fields.recordJson.stringValue));
    }
    return jobs;
  }
  async lease(job: AutomationJob, now: Date) {
    const current = await this.read(job.id);
    if (!current || ['complete', 'needs_review'].includes(current.job.state) || Date.parse(current.job.availableAt) > +now || current.job.state === 'processing' && Date.parse(current.job.leaseExpiresAt || '') > +now) return null;
    if (current.job.attempts >= 3) {
      const reviewed: AutomationJob = { ...current.job, state: 'needs_review', resultCode: 'lease_retry_limit_reached' };
      const r = await this.request(`/connectAutomationJobs/${job.id}?currentDocument.updateTime=${encodeURIComponent(current.updateTime)}`, { method: 'PATCH', body: JSON.stringify({ fields: this.fields(reviewed, now) }) });
      if (!r.ok && ![409, 412].includes(r.status)) throw new Error('AUTOMATION_STORAGE_UNAVAILABLE');
      return null;
    }
    const next: AutomationJob = { ...current.job, state: 'processing', attempts: current.job.attempts + 1, leaseToken: randomUUID(), leaseExpiresAt: new Date(+now + 120000).toISOString() };
    const r = await this.request(`/connectAutomationJobs/${job.id}?currentDocument.updateTime=${encodeURIComponent(current.updateTime)}`, { method: 'PATCH', body: JSON.stringify({ fields: this.fields(next, now) }) });
    if ([409, 412].includes(r.status)) return null;
    if (!r.ok) throw new Error('AUTOMATION_STORAGE_UNAVAILABLE');
    return next;
  }
  async finish(job: AutomationJob, state: AutomationJob['state'], code: string, now: Date) {
    const current = await this.read(job.id);
    if (!current || current.job.leaseToken !== job.leaseToken || current.job.state !== 'processing') throw new Error('AUTOMATION_LEASE_LOST');
    const next = { ...current.job, state, resultCode: code, availableAt: new Date(+now + Math.min(3600000, 30000 * 2 ** job.attempts)).toISOString() };
    const r = await this.request(`/connectAutomationJobs/${job.id}?currentDocument.updateTime=${encodeURIComponent(current.updateTime)}`, { method: 'PATCH', body: JSON.stringify({ fields: this.fields(next, now) }) });
    if (!r.ok) throw new Error('AUTOMATION_STORAGE_UNAVAILABLE');
  }
}
export class InternalAutomationWorker {
  constructor(private readonly store: AutomationJobStore, private readonly execute: (event: InternalAutomationEvent) => Promise<'complete' | 'needs_review'>, private readonly now = () => new Date()) {}
  async run(limit = 10) {
    let processed = 0;
    const batchLimit = Number.isInteger(limit) ? Math.max(1, Math.min(limit, 10)) : 10;
    for (const candidate of await this.store.pending(batchLimit)) {
      if (processed >= batchLimit) break;
      const job = await this.store.lease(candidate, this.now()); if (!job) continue;
      processed++;
      try {
        const result = await this.execute(job.event);
        await this.store.finish(job, result, result === 'complete' ? 'internal_action_evaluated' : 'human_review_required', this.now());
      } catch {
        await this.store.finish(job, job.attempts >= 3 ? 'needs_review' : 'pending', job.attempts >= 3 ? 'retry_limit_reached' : 'safe_retry_pending', this.now());
      }
    }
    return { processed };
  }
}
