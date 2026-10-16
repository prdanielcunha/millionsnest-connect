import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { validateAutomationEvent, verifyAutomationSignature, jobId, InternalAutomationWorker, FirestoreAutomationJobStore, type InternalAutomationEvent, type AutomationJob, type AutomationJobStore } from '../core/automations/eventJobs';
import { createAutomationEventHandler, createAutomationWorkerHandler, createAutomationJobsReadHandler } from '../core/automations/automationEventHttp';
const now = new Date('2026-10-14T12:00:00Z'), secret = 'test-worker-secret-with-at-least-32-characters';
const rawEvent = { schemaVersion: 1, sourceApp: 'nestfinance', eventId: 'event-1', organizationId: 'org-a', conversationId: 'thread-a', recipientUid: 'operator-a', trigger: 'document.pending', occurredAt: now.toISOString() };
const event = validateAutomationEvent(rawEvent, 'nestfinance', +now);
assert.throws(() => validateAutomationEvent({ ...rawEvent, body: 'private-data' }, 'nestfinance', +now));
assert.throws(() => validateAutomationEvent(rawEvent, 'musicscale', +now));
assert.throws(() => validateAutomationEvent({ ...rawEvent, trigger: 'send_commercial_campaign' }, 'nestfinance', +now));
assert.throws(() => validateAutomationEvent({ ...rawEvent, organizationId: '../org-b' }, 'nestfinance', +now));
const raw = Buffer.from(JSON.stringify(rawEvent)), timestamp = String(+now);
function signature(body: Buffer, source: string) { return createHmac('sha256', secret).update(source + '\n' + timestamp + '\n').update(body).digest('hex'); }
assert(verifyAutomationSignature(raw, 'nestfinance', timestamp, signature(raw, 'nestfinance'), secret, +now));
assert(!verifyAutomationSignature(raw, 'musicscale', timestamp, signature(raw, 'nestfinance'), secret, +now));
assert(!verifyAutomationSignature(raw, 'nestfinance', timestamp, signature(raw, 'nestfinance'), secret, +now + 300001));
assert(!verifyAutomationSignature(Buffer.from('{}'), 'nestfinance', timestamp, signature(raw, 'nestfinance'), secret, +now));
const jobs = new Map<string, AutomationJob>(); let executed = 0;
const store: AutomationJobStore = {
  async enqueue(e, date) {
    const id = jobId(e), current = jobs.get(id);
    if (current) { if (JSON.stringify(current.event) !== JSON.stringify(e)) throw new Error('AUTOMATION_EVENT_ID_COLLISION'); return 'duplicate'; }
    jobs.set(id, { id, event: e, state: 'pending', attempts: 0, availableAt: date.toISOString() }); return 'created';
  },
  async listForOrganization(org) { return [...jobs.values()].filter(j => j.event.organizationId === org); },
  async pending() { return [...jobs.values()].filter(j => ['pending', 'processing'].includes(j.state)); },
  async lease(candidate, date) {
    const current = jobs.get(candidate.id)!;
    if (current.state !== 'pending' || Date.parse(current.availableAt) > +date) return null;
    const leased = { ...current, state: 'processing' as const, attempts: current.attempts + 1, leaseToken: 'lease-' + current.attempts };
    jobs.set(candidate.id, leased); return leased;
  },
  async finish(job, state, code, date) {
    const current = jobs.get(job.id)!;
    assert.equal(current.leaseToken, job.leaseToken);
    jobs.set(job.id, { ...current, state, resultCode: code, availableAt: new Date(+date + 30000).toISOString() });
  },
};
const worker = new InternalAutomationWorker(store, async () => { executed++; return 'complete'; }, () => now);
await Promise.all(Array.from({ length: 20 }, () => store.enqueue(event, now))); assert.equal(jobs.size, 1);
await Promise.all(Array.from({ length: 20 }, () => worker.run(10))); assert.equal(executed, 1); assert.equal(jobs.get(jobId(event))?.state, 'complete');
await assert.rejects(() => store.enqueue({ ...event, conversationId: 'other-thread' }, now), /ID_COLLISION/);
assert.notEqual(jobId(event), jobId({ ...event, organizationId: 'org-b' }));
for (const sourceApp of ['musicscale', 'nestjourney'] as const) {
  const e = { ...event, sourceApp, trigger: sourceApp === 'musicscale' ? 'scale.published' : 'followup.due' };
  await store.enqueue(e, now); await worker.run(10);
}
assert.equal(executed, 3);
let clock = now; const failedEvent = { ...event, eventId: 'retry-event' };
await store.enqueue(failedEvent, now);
const retryWorker = new InternalAutomationWorker(store, async () => { throw new Error('PRE_PROVIDER_STORAGE_FAILURE'); }, () => clock);
for (let attempt = 0; attempt < 3; attempt++) { await retryWorker.run(10); clock = new Date(+clock + 60000); }
assert.equal(jobs.get(jobId(failedEvent))?.state, 'needs_review'); assert.equal(jobs.get(jobId(failedEvent))?.attempts, 3);
const ambiguous = { ...event, eventId: 'ambiguous-event' }; await store.enqueue(ambiguous, now);
await new InternalAutomationWorker(store, async () => 'needs_review', () => now).run(10);
assert.equal(jobs.get(jobId(ambiguous))?.state, 'needs_review');

function response() { return { statusCode: 200, payload: undefined as unknown, setHeader() {}, status(s: number) { this.statusCode = s; return this; }, json(v: unknown) { this.payload = v; return this; } }; }
const handler = createAutomationEventHandler(store, { nestfinance: secret }, () => now);
let res = response(); await handler({ params: { sourceApp: 'nestfinance' }, headers: {}, body: raw } as any, res as any); assert.equal(res.statusCode, 401);
res = response(); await handler({ params: { sourceApp: 'nestfinance' }, headers: { 'x-connect-timestamp': timestamp, 'x-connect-signature': signature(raw, 'nestfinance') }, body: raw } as any, res as any); assert.equal(res.statusCode, 202);
const workerBody = Buffer.from('{"limit":10}'); const workerHandler = createAutomationWorkerHandler(worker, secret, () => now);
res = response(); await workerHandler({ headers: { 'x-connect-timestamp': timestamp, 'x-connect-signature': signature(workerBody, 'worker') }, body: workerBody } as any, res as any); assert.equal(res.statusCode, 200);
res = response(); await workerHandler({ headers: { 'x-connect-timestamp': timestamp, 'x-connect-signature': signature(workerBody, 'nestfinance') }, body: workerBody } as any, res as any); assert.equal(res.statusCode, 401);
// Real adapter commits quota + new job atomically, and rejects exhausted tenant budget.
let writes: any;
const fs = new FirestoreAutomationJobStore('millionsnest', async (url, init) => {
  if (String(url).endsWith(':commit')) { writes = JSON.parse(String(init?.body)).writes; return new Response('{}'); }
  return new Response('{}', { status: 404 });
}, { async getAccessToken() { return 'runtime-only'; } });
assert.equal(await fs.enqueue(event, now), 'created'); assert.equal(writes.length, 2); assert(writes.every((w: any) => w.currentDocument.exists === false));
const limited = new FirestoreAutomationJobStore('millionsnest', async url => String(url).includes('connectAutomationBudgets')
  ? new Response(JSON.stringify({ updateTime: 'time', fields: { organizationId: { stringValue: 'org-a' }, count: { integerValue: '100' } } }))
  : new Response('{}', { status: 404 }), { async getAccessToken() { return 'runtime-only'; } });
await assert.rejects(() => limited.enqueue(event, now), /DAILY_LIMIT/);
console.log('Internal worker: authenticated app events, 20 duplicates => 1 action, cross-app/tenant keys, leases, bounded retry, human review, no commercial triggers and atomic daily quota passed.');

const readHandler = createAutomationJobsReadHandler(store, { async resolve() { return { status: 'resolved', context: {
  actorUid: 'operator-a', organizationId: 'org-a', organizationRole: 'admin', globalAccess: false, systemRole: null, permissions: [], capabilities: [], appAccess: { musicscale: false },
} }; } });
res = response(); await readHandler({ query: { organizationId: 'org-b' }, headers: { authorization: 'Bearer test' } } as any, res as any); assert.equal(res.statusCode, 403);
res = response(); await readHandler({ query: { organizationId: 'org-a' }, headers: { authorization: 'Bearer test' } } as any, res as any); assert.equal(res.statusCode, 200);
assert(!JSON.stringify(res.payload).includes('recipientUid')); assert(!JSON.stringify(res.payload).includes('leaseToken'));


// Regression: a state-only Firestore query returns records by document name.
// The first page may be entirely deferred jobs; a ready event beyond the
// initial page must remain processable without changing Hub-owned indexes.
{
  const deferred = Array.from({ length: 25 }, (_, i): AutomationJob => ({
    id: 'future-' + i, event, state: 'pending', attempts: 0,
    availableAt: new Date(+now + 86400000).toISOString(),
  }));
  const ready: AutomationJob = { id: 'ready-after-first-page', event, state: 'pending',
    attempts: 0, availableAt: new Date(+now - 1000).toISOString() };
  const expired: AutomationJob = { id: 'expired-processing-lease', event,
    state: 'processing', attempts: 1,
    availableAt: new Date(+now - 2000).toISOString(),
    leaseToken: 'expired', leaseExpiresAt: new Date(+now - 1000).toISOString() };
  const pendingDocuments = [...deferred, ready];
  const queriedOffsets: number[] = [];
  const pages = new FirestoreAutomationJobStore('millionsnest', async (_url, init) => {
    assert.equal(init?.method, 'POST');
    const query = JSON.parse(String(init.body)).structuredQuery;
    assert.equal(query.where.fieldFilter.field.fieldPath, 'state');
    assert.equal(query.limit, 25);
    const start = query.offset ?? 0;
    queriedOffsets.push(start);
    const candidates = query.where.fieldFilter.value.stringValue === 'pending'
      ? pendingDocuments : [expired];
    return Response.json(candidates.slice(start, start + query.limit)
      .map(job => ({ document: { fields: { recordJson: { stringValue: JSON.stringify(job) } } } })));
  }, { async getAccessToken() { return 'runtime-only'; } });
  const available = await pages.pending(2, now);
  assert.deepEqual(available.map(job => job.id), ['expired-processing-lease', 'ready-after-first-page']);
  assert(queriedOffsets.includes(25), 'ready jobs after the blocked first page must be discovered');
  const early = await pages.pending(1, new Date(+now - 2 * 86400000));
  assert.equal(early.length, 0, 'future jobs never execute before their due time');
}

const exhaustedJob: AutomationJob = { id: jobId(event), event, state: 'processing', attempts: 3, availableAt: now.toISOString(), leaseToken: 'old', leaseExpiresAt: new Date(+now - 1000).toISOString() };
let writtenState = '';
const exhaustedStore = new FirestoreAutomationJobStore('millionsnest', async (_url, init) => {
  if (init?.method === 'PATCH') { writtenState = JSON.parse(String(init.body)).fields.state.stringValue; return new Response('{}'); }
  return new Response(JSON.stringify({ updateTime: 'version', fields: { recordJson: { stringValue: JSON.stringify(exhaustedJob) } } }));
}, { async getAccessToken() { return 'runtime-only'; } });
assert.equal(await exhaustedStore.lease(exhaustedJob, now), null); assert.equal(writtenState, 'needs_review', 'expired third lease cannot execute a fourth external attempt');
