import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createInternalAlertExecutor } from '../core/automations/internalAlertExecutor';
import { createConnectServer } from '../server/createConnectServer';
import { InMemoryConnectThreadStore } from '../core/inbox/threadStore';
import { ConnectThreadCommandService } from '../core/inbox/threadService';
import { createMessageEvidenceRef, createProviderMessageIndexId, type ConnectMessageContentRecord } from '../core/inbox/messageContentStore';
import type { InternalAutomationEvent } from '../core/automations/eventJobs';
import { WhatsAppConnectionRegistry } from '../core/channels/whatsappConnectionRegistry';

const scope = { organizationId: 'org-a', conversationId: 'conversation-a' };
const threads = new InMemoryConnectThreadStore();
const commands = new ConnectThreadCommandService(threads);
const evidenceRef = createMessageEvidenceRef('whatsapp', 'provider-event-1');
await commands.open({ ...scope, requestId: 'open-event-1', channel: 'whatsapp', evidenceRef });
const messageId = createProviderMessageIndexId('whatsapp', 'provider-event-1');
const event: InternalAutomationEvent = { ...scope, schemaVersion: 1, sourceApp: 'whatsapp', trigger: 'inbox.message_received',
  eventId: messageId, messageId, occurredAt: new Date().toISOString() };
const original: ConnectMessageContentRecord = { ...scope, schemaVersion: 1, messageId, channel: 'whatsapp', direction: 'inbound',
  providerMessageId: 'provider-event-1', senderRef: 'synthetic-sender', recipientRef: 'synthetic-phone-id',
  messageType: 'text', body: 'synthetic message not copied to jobs', occurredAt: event.occurredAt, recordedAt: event.occurredAt,
  deliveryStatus: 'received', evidenceRef };
let record: ConnectMessageContentRecord | null = original;
let member = true, calls = 0;
const messages = { async get(input: typeof scope & { messageId: string }) { assert.equal(input.organizationId, event.organizationId); return record; } };
const directory = { async verify(input: { organizationId: string; uid: string }) { assert.equal(input.organizationId, scope.organizationId); return member; } };
const withoutPush = createInternalAlertExecutor({ threads, messages, directory });
assert.equal(await withoutPush(event), 'needs_review', 'missing physical push creates honest internal review');
assert.equal((await threads.load(scope))?.status, 'new', 'review queue does not mutate the customer conversation');
for (const patch of [{ organizationId: 'org-b' }, { conversationId: 'other' }, { direction: 'outbound' },
  { channel: 'inapp' }, { providerMessageId: 'other-provider-id' }, { recipientRef: '' }] as const) {
  record = { ...original, ...patch };
  assert.equal(await withoutPush(event), 'needs_review', 'invalid stored source is never delivered');
}
record = original;
const appEvent: InternalAutomationEvent = { ...event, sourceApp: 'nestjourney', trigger: 'followup.due', recipientUid: 'caregiver' };
assert.equal(await withoutPush(appEvent), 'needs_review', 'authorized operator event can await human review without push');
const withPush = createInternalAlertExecutor({ threads, messages, directory, push: {
  async afterIngest(events) { calls++; assert.equal(events[0].kind, 'message'); return { accepted: 1, failed: 0 }; },
  async notifyAutomation(input) { calls++; assert.equal(input.recipientUid, 'caregiver'); return { accepted: 1, failed: 0 }; },
} });
member = false;
assert.equal(await withPush(appEvent), 'needs_review'); assert.equal(calls, 0, 'revoked operator never reaches push');
member = true;
assert.equal(await withPush(event), 'complete'); assert.equal(calls, 1);
assert.equal(await withPush(appEvent), 'complete'); assert.equal(calls, 2);
const failedPush = createInternalAlertExecutor({ threads, messages, directory, push: {
  async afterIngest() { return { accepted: 0, failed: 1 }; }, async notifyAutomation() { return { accepted: 0, failed: 1 }; },
} });
assert.equal(await failedPush(event), 'needs_review', 'ambiguous delivery requires review, never claimed delivered');
await commands.recordPersonReply({ ...scope, requestId: 'later-message', evidenceRef: createMessageEvidenceRef('whatsapp', 'later-provider-event') });
assert.equal(await withPush(event), 'complete'); assert.equal(calls, 2, 'superseded message does not generate a stale alert');
await commands.waitForPerson({ ...scope, requestId: 'operator-replied', evidenceRef: 'operator-evidence' });
assert.equal(await withoutPush(event), 'complete', 'operator response suppresses old queued alert');
assert.equal(await withoutPush({ ...event, organizationId: 'org-other' }), 'needs_review');

const secret = 'synthetic-distinct-worker-secret-at-least-32-characters';
// Actual production composition must mount the protected queue independently of
// all P0 delivery/VAPID flags, while failing closed for every storage/key gate.
for (const [change, expected] of [
  [{}, 401], [{ CONNECT_INTERNAL_ALERT_QUEUE_ENABLED: 'true', CONNECT_AUTOMATION_EXECUTION_ENABLED: 'false' }, 401],
  [{ CONNECT_AUTOMATION_STORAGE_PRIVATE_CONFIRMED: 'false' }, 404],
  [{ CONNECT_AUTOMATION_TTL_CONFIRMED: 'false' }, 404], [{ CONNECT_AUTOMATION_EXECUTION_ENABLED: 'false' }, 404],
  [{ CONNECT_AUTOMATION_WORKER_SECRET: 'short' }, 404],
  [{ CONNECT_AUTOMATION_SOURCE_KEYS_JSON: JSON.stringify({ nestjourney: secret }) }, 404],
  [{ CONNECT_AUTOMATION_SOURCE_KEYS_JSON: JSON.stringify({ nestjourney: 'same-source-secret-with-32-characters', musicscale: 'same-source-secret-with-32-characters' }) }, 404],
] as Array<[Record<string, string>, number]>) {
  let externalCalls = 0;
  const app = createConnectServer({ env: { CONNECT_INBOX_DURABLE_ENABLED: 'true', CONNECT_INBOX_MESSAGE_CONTENT_ENABLED: 'true',
    CONNECT_AUTOMATION_EXECUTION_ENABLED: 'true', CONNECT_AUTOMATION_STORAGE_PRIVATE_CONFIRMED: 'true',
    CONNECT_AUTOMATION_TTL_CONFIRMED: 'true', CONNECT_AUTOMATION_WORKER_SECRET: secret, ...change },
    inboxContextProvider: { async resolve() { throw new Error('AUTH_NOT_EXPECTED'); } },
    fetchImpl: async () => { externalCalls++; throw new Error('EXTERNAL_NOT_EXPECTED'); },
    logger: { info() {}, warn() {}, error() {} },
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    assert.equal((await fetch(base + '/api/core/automations/jobs?organizationId=org-a')).status, expected);
    for (const path of ['worker', 'events/nestjourney']) assert.equal((await fetch(base + '/api/core/automations/' + path,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, expected);
    assert.equal(externalCalls, 0, 'unauthorized requests never touch external services');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}
// Full HTTP composition, real ingestor + Firestore job adapter + worker. Only
// external storage/identity are synthetic; no Meta request or customer data.
{
  const docs = new Map<string, any>(), contents = new Map<string, ConnectMessageContentRecord>();
  let version = 0, failQueue = false;
  const external: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('metadata.google.internal')) return Response.json({ access_token: 'synthetic-runtime-token' });
    assert(url.startsWith('https://firestore.googleapis.com/'), 'no push/Meta/domain requests');
    if (failQueue) return new Response('{}', { status: 503 });
    const parsed = new URL(url), name = parsed.pathname.replace('/v1/', '');
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.endsWith(':commit')) {
      for (const write of body.writes) {
        const current = docs.get(write.update.name);
        if (write.currentDocument.exists === false && current || write.currentDocument.updateTime && write.currentDocument.updateTime !== current?.updateTime) return new Response('{}', { status: 409 });
      }
      for (const write of body.writes) docs.set(write.update.name, { ...write.update, updateTime: String(++version) });
      return Response.json({});
    }
    if (url.endsWith(':runQuery')) {
      const query = body.structuredQuery, filter = query.where.fieldFilter;
      return Response.json([...docs.values()].filter(d => d.name.includes('/' + query.from[0].collectionId + '/') &&
        d.fields[filter.field.fieldPath]?.stringValue === filter.value.stringValue).slice(0, query.limit).map(document => ({ document })));
    }
    if (init?.method === 'PATCH') {
      if (parsed.searchParams.get('currentDocument.updateTime') !== docs.get(name)?.updateTime) return new Response('{}', { status: 412 });
      docs.set(name, { name, fields: body.fields, updateTime: String(++version) }); return Response.json({});
    }
    return docs.has(name) ? Response.json(docs.get(name)) : new Response('{}', { status: 404 });
  };
  const inboundThreads = new InMemoryConnectThreadStore();
  const warnings: string[] = [];
  const app = createConnectServer({ env: { CONNECT_INBOX_DURABLE_ENABLED: 'true', CONNECT_INBOX_MESSAGE_CONTENT_ENABLED: 'true',
    CONNECT_WHATSAPP_INGESTION_ENABLED: 'true', CONNECT_WHATSAPP_WEBHOOK_ENABLED: 'true', CONNECT_WHATSAPP_APP_SECRET: secret,
    CONNECT_AUTOMATION_EXECUTION_ENABLED: 'false', CONNECT_INTERNAL_ALERT_QUEUE_ENABLED: 'true', CONNECT_AUTOMATION_STORAGE_PRIVATE_CONFIRMED: 'true',
    CONNECT_AUTOMATION_TTL_CONFIRMED: 'true', CONNECT_AUTOMATION_WORKER_SECRET: secret }, fetchImpl: external,
    inboxStore: inboundThreads,
    inboxMessageContentStore: {
      async put(record) { const current = contents.get(record.messageId); if (current) return { kind: 'duplicate', record: current }; contents.set(record.messageId, record); return { kind: 'created', record }; },
      async get(input) { const r = contents.get(input.messageId); return r?.organizationId === input.organizationId && r.conversationId === input.conversationId ? r : null; },
      async getByProviderMessageId(input) { return [...contents.values()].find(r => r.channel === input.channel && r.providerMessageId === input.providerMessageId) ?? null; },
      async listConversation(input) { return [...contents.values()].filter(r => r.organizationId === input.organizationId && r.conversationId === input.conversationId); },
      async updateDeliveryStatus() { return null; },
    },
    whatsappConnectionRegistry: new WhatsAppConnectionRegistry([{ organizationId: 'org-a', phoneNumberId: 'synthetic-phone-id', connectionRef: 'official', enabled: true }]),
    inboxOperatorDirectory: { async list() { return []; }, async verify() { return false; } },
    inboxContextProvider: { async resolve({ requestedOrganizationId }) { return { status: 'resolved', context: {
      organizationId: 'org-a', actorUid: 'operator', globalAccess: false, systemRole: null, organizationRole: 'owner',
      permissions: [], capabilities: [], appAccess: { musicscale: false },
    } }; } },
    inboxStorageReadinessProbe: async () => ({ state: 'read_write_confirmed', source: 'runtime_metadata', permissions: { read: true, list: true, create: true, update: true } }),
    logger: { info() {}, warn(code) { warnings.push(code); }, error(code) { warnings.push(code); } },
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const receivedAt = String(Math.floor(Date.now() / 1000));
    const ingest = async (id: string, valid = true) => {
      const raw = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: {
        metadata: { phone_number_id: 'synthetic-phone-id' }, messages: [{ id, from: '5543000000000', timestamp: receivedAt, type: 'text', text: { body: 'synthetic inbound body' } }],
      } }] }] });
      return fetch(base + '/api/channels/whatsapp/webhook', { method: 'POST', body: raw, headers: {
        'Content-Type': 'application/json', 'x-hub-signature-256': 'sha256=' + (valid ? createHmac('sha256', secret).update(raw).digest('hex') : '0'.repeat(64)),
      } });
    };
    assert.equal((await ingest('wamid.queue-1', false)).status, 401); assert.equal(docs.size, 0);
    for (let i = 0; i < 3; i++) assert.equal((await ingest('wamid.queue-1')).status, 200);
    const jobs = [...docs.values()].filter(d => d.name.includes('/connectAutomationJobs/'));
    assert.equal(jobs.length, 1, 'real duplicate webhook creates one durable job');
    const job = JSON.parse(jobs[0].fields.recordJson.stringValue);
    assert.equal(job.state, 'needs_review'); assert.equal(job.attempts, 1);
    assert.equal(contents.size, 1); assert(!JSON.stringify(job).includes('synthetic inbound body'));
    const read = await fetch(base + '/api/core/automations/jobs?organizationId=org-a', { headers: { Authorization: 'Bearer synthetic' } });
    assert.equal(read.status, 200); assert.equal((await read.json() as any).jobs[0].state, 'needs_review');
    assert.equal((await fetch(base + '/api/core/automations/jobs?organizationId=org-b', { headers: { Authorization: 'Bearer synthetic' } })).status, 403);
    failQueue = true;
    assert.equal((await ingest('wamid.queue-storage-failed')).status, 200, 'queue outage cannot lose or reject durable Inbox message');
    assert.equal(contents.size, 2); assert(warnings.includes('CONNECT_AUTOMATION_POST_INGEST_FAILED'));
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}
console.log('Internal alert queue: no-push review, canonical scope, real HTTP signed webhook -> durable job, duplicates, storage failure and tenant authorization passed');
