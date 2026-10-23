import assert from 'node:assert/strict';
import express from 'express';
import { SUPPORT_PRODUCTS, SUPPORT_TOPICS, parseSupportContext, supportMarker } from '../core/routing/supportIntake';
import { createPublicSupportContactHttpHandler } from '../core/routing/publicSupportContactHttpHandler';
import { WhatsAppInboxIngestor } from '../core/inbox/whatsappInboxIngestor';
import { WhatsAppConnectionRegistry } from '../core/channels/whatsappConnectionRegistry';
import { InMemoryConnectThreadStore } from '../core/inbox/threadStore';
import { ConnectThreadCommandService } from '../core/inbox/threadService';
import { createConversationIdFromChannelIdentity, type ConnectMessageContentStore } from '../core/inbox/messageContentStore';

for (const product of Object.keys(SUPPORT_PRODUCTS)) for (const topic of SUPPORT_TOPICS) {
  const context = { product, source: 'app', topic } as Parameters<typeof supportMarker>[0];
  assert.deepEqual(parseSupportContext('hello\n' + supportMarker(context)), context);
}
for (const text of ['[mn-support:v1:__proto__:app:help]', '[mn-support:v1:hub:other:help]', '[mn-support:v2:hub:app:help]', '[mn-support:v1:hub:app:help]\n[mn-support:v1:musicscale:app:error]', 'hello']) assert.equal(parseSupportContext(text), null);
let providerReads = 0;
const bindings = [{ organizationId: 'official-org', phoneNumberId: 'phone-id', connectionRef: 'official', enabled: true }];
const app = express();
app.get('/contact', createPublicSupportContactHttpHandler({ bindings, provider: { async getDisplayPhoneNumber(id) { assert.equal(id, 'phone-id'); providerReads++; return '16505550100'; } } }));
app.get('/ambiguous', createPublicSupportContactHttpHandler({ bindings: [...bindings, { ...bindings[0], phoneNumberId: 'another' }], provider: { async getDisplayPhoneNumber() { throw new Error('must not guess'); } } }));
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const origin = `http://127.0.0.1:${(server.address() as any).port}`;
try {
  const response = await fetch(origin + '/contact?product=hub&source=website');
  assert.equal(response.status, 200); const html = await response.text();
  assert(html.includes('Como podemos ajudar?')); assert(html.includes('name="topic"')); assert.equal(providerReads, 0);
  for (const locale of ['pt-BR', 'en-US', 'es-ES']) {
    const r = await fetch(origin + `/contact?product=musicscale&source=app&topic=error&locale=${locale}&open=1`, { redirect: 'manual' });
    assert.equal(r.status, 302); assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
    const url = new URL(r.headers.get('location')!); assert.equal(url.origin, 'https://wa.me'); assert.equal(url.pathname, '/16505550100');
    assert.deepEqual(parseSupportContext(url.searchParams.get('text')!), { product: 'musicscale', source: 'app', topic: 'error' });
  }
  assert.equal(providerReads, 1, 'bounded cache avoids a provider lookup on every click');
  for (const query of ['product=__proto__', 'product=<script>', 'phone=16505550199', 'organizationId=other-org', 'topic=help&topic=error', 'source=https://evil.test', 'open=https://evil.test']) assert.equal((await fetch(origin + '/contact?' + query)).status, 400, query);
  assert.equal((await fetch(origin + '/ambiguous?open=1')).status, 503);
} finally { server.close(); }

const now = new Date('2026-10-23T12:00:00Z');
const threads = new InMemoryConnectThreadStore();
const registry = new WhatsAppConnectionRegistry(bindings);
const messages: any[] = [];
const store = { async put(message: any) { messages.push(message); } } as unknown as ConnectMessageContentStore;
const ingest = new WhatsAppInboxIngestor(registry, store, threads, () => now);
const scope = { organizationId: 'official-org', conversationId: createConversationIdFromChannelIdentity({ organizationId: 'official-org', connectionRef: 'official', channel: 'whatsapp', channelUserId: 'synthetic-caller' }) };
const event = { kind: 'message' as const, providerMessageId: 'support-1', from: 'synthetic-caller', phoneNumberId: 'phone-id', timestamp: String(+now / 1000), messageType: 'text', text: supportMarker({ product: 'hub', source: 'website', topic: 'access' }) };
await ingest.ingest([event]);
let thread = await threads.load(scope);
assert.deepEqual(thread?.supportContext, { product: 'hub', source: 'website', topic: 'access' });
assert.equal(thread?.mode, 'human'); assert.equal(thread?.status, 'waiting_team'); assert.equal(thread?.assignedTo, undefined);
const count = thread!.sourceEventCount; await ingest.ingest([event]); assert.equal((await threads.load(scope))?.sourceEventCount, count);
const command = new ConnectThreadCommandService(threads, () => now);
await command.assign({ ...scope, requestId: 'wa-20-assign', evidenceRef: 'synthetic', assigneeType: 'user', assigneeRef: 'existing-operator', occurredAt: new Date(+now + 1000) });
await ingest.ingest([{ ...event, providerMessageId: 'support-2', timestamp: String((+now + 2000) / 1000), text: supportMarker({ product: 'musicscale', source: 'app', topic: 'error' }) }]);
thread = await threads.load(scope); assert.equal(thread?.assignedTo?.ref, 'existing-operator'); assert.equal(thread?.supportContext?.product, 'musicscale'); assert.equal(thread?.mode, 'human');
assert.equal((await threads.load({ ...scope, organizationId: 'another-org' })), null);
assert(!(await threads.readEvents(scope)).some(e => JSON.stringify(e).includes('synthetic-caller')), 'no contact PII in routing events');
console.log('Support intake passed: six products, six topics, three locales, public fixed-provider redirect, injection/ambiguity rejection, cached GET-only metadata, durable human queue, retries, existing assignee and tenant isolation. No outbound API exists in this flow.');
