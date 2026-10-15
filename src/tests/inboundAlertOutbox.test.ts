import assert from 'node:assert/strict';
import { FirestoreMessageContentStore } from '../core/inbox/firestoreMessageContentStore';
import { createConversationIdFromChannelIdentity, createMessageEvidenceRef, createProviderMessageIndexId, type ConnectMessageContentRecord } from '../core/inbox/messageContentStore';
import { FirestoreInboundAlertCatchup } from '../core/automations/inboundAlertOutbox';
import { jobId, type InternalAutomationEvent } from '../core/automations/eventJobs';

const clock = new Date('2026-10-15T16:00:00.000Z');
const registry = { resolve(phone: string) { return phone === 'canonical-phone' ? { organizationId: 'org-a', connectionRef: 'official' } : null; } };
const conversationId = createConversationIdFromChannelIdentity({
  organizationId: 'org-a', connectionRef: 'official', channel: 'whatsapp', channelUserId: 'canonical-sender',
});
const message = (id: string, overrides: Partial<ConnectMessageContentRecord> = {}): ConnectMessageContentRecord => ({
  schemaVersion: 1, organizationId: 'org-a', conversationId, messageId: createProviderMessageIndexId('whatsapp', id),
  channel: 'whatsapp', direction: 'inbound', providerMessageId: id, senderRef: 'canonical-sender',
  recipientRef: 'canonical-phone', messageType: 'text', body: 'SECRET_PII_NEVER_IN_JOB',
  occurredAt: '2026-10-15T15:59:00Z', recordedAt: clock.toISOString(), deliveryStatus: 'received',
  evidenceRef: createMessageEvidenceRef('whatsapp', id), ...overrides,
});
const docs = new Map<string, any>(); let generation = 0; let queueDown = false;
const fetchImpl: typeof fetch = async (input, init) => {
  const u = new URL(String(input)), method = init?.method || 'GET';
  const suffix = decodeURIComponent(u.pathname.split('/documents')[1] || '');
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const version = () => String(++generation);
  const resource = (key: string) => 'projects/millionsnest/databases/(default)/documents' + key;
  if (method === 'POST' && suffix === ':commit') {
    for (const write of body.writes) {
      const key = write.update.name.replace('projects/millionsnest/databases/(default)/documents', '');
      const current = docs.get(key);
      if (write.currentDocument.exists === false && current ||
        write.currentDocument.updateTime && current?.updateTime !== write.currentDocument.updateTime) return new Response('{}', { status: 409 });
    }
    for (const write of body.writes) {
      const key = write.update.name.replace('projects/millionsnest/databases/(default)/documents', '');
      docs.set(key, { name: resource(key), fields: write.update.fields, updateTime: version() });
    }
    return Response.json({});
  }
  if (method === 'POST' && suffix === ':runQuery') {
    const filter = body.structuredQuery.where.fieldFilter;
    return Response.json([...docs.values()].filter(d =>
      d.name.includes('/connectProviderMessageIndex/') &&
      d.fields[filter.field.fieldPath]?.stringValue === filter.value.stringValue
    ).slice(0, body.structuredQuery.limit).map(document => ({ document })));
  }
  if (method === 'PATCH') {
    const old = docs.get(suffix);
    if (!old || old.updateTime !== u.searchParams.get('currentDocument.updateTime')) return new Response('{}', { status: 412 });
    docs.set(suffix, { name: resource(suffix), fields: body.fields, updateTime: version() });
    return Response.json({});
  }
  if (method === 'GET' && suffix === '/connectProviderMessageIndex') {
    const list = [...docs.entries()].filter(([key]) => key.startsWith('/connectProviderMessageIndex/') && key.split('/').length === 3)
      .sort(([a], [b]) => a.localeCompare(b)).map(([, val]) => val);
    const start = Number(u.searchParams.get('pageToken') || 0), size = Number(u.searchParams.get('pageSize') || 10);
    const next = start + size;
    return Response.json({ documents: list.slice(start, next), ...(next < list.length ? { nextPageToken: String(next) } : {}) });
  }
  if (method === 'GET') return docs.has(suffix) ? Response.json(docs.get(suffix)) : new Response('{}', { status: 404 });
  throw Error('UNEXPECTED_FIRESTORE_OP_' + method + '_' + suffix);
};
const canonical = new Map<string, ConnectMessageContentRecord>();
const queued = new Map<string, InternalAutomationEvent>();
let queueAttempts = 0;
const jobs = { async enqueue(event: InternalAutomationEvent) {
  queueAttempts++;
  if (queueDown) throw Error('AUTOMATION_STORAGE_UNAVAILABLE');
  const id = jobId(event), existing = queued.get(id);
  if (existing && JSON.stringify(existing) !== JSON.stringify(event)) throw Error('AUTOMATION_EVENT_ID_COLLISION');
  queued.set(id, event);
  return existing ? 'duplicate' as const : 'created' as const;
} };
const catchup = new FirestoreInboundAlertCatchup({
  projectId: 'millionsnest', registry: registry as any,
  messages: { async get(scope) { const rec = canonical.get(scope.messageId);
    return rec && rec.organizationId === scope.organizationId && rec.conversationId === scope.conversationId ? rec : null; } },
  jobs, fetchImpl, tokenProvider: { async getAccessToken() { return 'synthetic-metadata-token'; } }, now: () => clock,
});
const writer = new FirestoreMessageContentStore({ projectId: 'millionsnest', fetchImpl,
  tokenProvider: { async getAccessToken() { return 'synthetic-metadata-token'; } } });
const first = message('wamid.outbox-a'); canonical.set(first.messageId, first);
assert.equal((await writer.put(first)).kind, 'created');
const firstIndex = () => docs.get('/connectProviderMessageIndex/' + first.messageId);
assert.equal(firstIndex().fields.alertOutboxStatus.stringValue, 'pending', 'message and outbox are in the same commit');
assert.equal(docs.size, 2, 'no new collection; existing provider index reused');
queueDown = true;
let result = await catchup.run(2);
assert.equal(result.retry, 1); assert.equal(result.recovered, 0); assert.equal(firstIndex().fields.alertOutboxAttempts.integerValue, '1');
queueDown = false;
result = await catchup.run(2);
assert.equal(result.recovered, 1); assert.equal(queued.size, 1); assert.equal(firstIndex().fields.alertOutboxStatus.stringValue, 'queued');
await catchup.run(2);
assert.equal(queued.size, 1, 'legacy rescan and repeat worker never double-enqueue');
assert(!JSON.stringify([...queued.values()]).includes('SECRET_PII_NEVER_IN_JOB'));

const legacy = message('wamid.pre-upgrade'); canonical.set(legacy.messageId, legacy);
docs.set('/connectProviderMessageIndex/' + legacy.messageId, {
  name: 'projects/millionsnest/databases/(default)/documents/connectProviderMessageIndex/' + legacy.messageId,
  updateTime: String(++generation),
  fields: { channel: { stringValue: 'whatsapp' }, organizationId: { stringValue: legacy.organizationId },
    conversationId: { stringValue: legacy.conversationId }, messageId: { stringValue: legacy.messageId } },
});
await catchup.run(10);
assert.equal(queued.size, 2, 'pre-upgrade persisted message recovered via durable legacy cursor');
assert.equal(docs.get('/connectProviderMessageIndex/' + legacy.messageId).fields.alertOutboxStatus.stringValue, 'queued');

const bad = message('wamid.forbidden-scope', { recipientRef: 'foreign-binding' }); canonical.set(bad.messageId, bad);
await writer.put(bad);
await catchup.run(10);
assert.equal(docs.get('/connectProviderMessageIndex/' + bad.messageId).fields.alertOutboxStatus.stringValue, 'needs_review');
assert.equal(queued.size, 2, 'foreign tenant binding never produces a job');

const exhausted = message('wamid.retry-exhausted'); canonical.set(exhausted.messageId, exhausted);
await writer.put(exhausted);
queueDown = true;
for (let i = 0; i < 3; i++) await catchup.run(10);
assert.equal(docs.get('/connectProviderMessageIndex/' + exhausted.messageId).fields.alertOutboxStatus.stringValue, 'needs_review');
assert.equal(docs.get('/connectProviderMessageIndex/' + exhausted.messageId).fields.alertOutboxAttempts.integerValue, '3');
queueDown = false;
await catchup.run(10);
assert.equal(queued.size, 2, 'exhausted record cannot auto-retry or send');

console.log('Inbound outbox: atomic marker, bounded retry, tenant binding, no PII, legacy catch-up, idempotent enqueue and review passed');
