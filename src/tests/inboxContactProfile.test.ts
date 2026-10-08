import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  filterAuthorizedInboxContactProfiles,
  makeInboxContactProfile,
  sanitizeInboxContactName,
  type InboxContactProfile,
  type InboxContactProfileStore,
} from '../core/inbox/inboxContactProfileStore';
import { normalizeWhatsAppWebhookEnvelope } from '../core/channels/whatsappOfficial';
import { WhatsAppConnectionRegistry } from '../core/channels/whatsappConnectionRegistry';
import { WhatsAppInboxIngestor } from '../core/inbox/whatsappInboxIngestor';
import { InMemoryConnectThreadStore } from '../core/inbox/threadStore';
import { createConnectInboxConversationListHttpHandler } from '../core/runtime/connectInboxQueryHttpHandler';
import type { ConnectMessageContentStore, ConnectMessageContentRecord } from '../core/inbox/messageContentStore';
import type { CanonicalContextProvider } from '../core/runtime/connectCore';

assert.equal(sanitizeInboxContactName('   Ana   Maria  '), 'Ana Maria');
assert.equal(sanitizeInboxContactName('Ana +55 (43) 99999-8888'), '', 'phone-like names are not displayed');
assert.equal(sanitizeInboxContactName('5511999999999'), '', 'raw number cannot become a label');
assert.equal(sanitizeInboxContactName('X'), '');
const observed = '2026-10-08T12:00:00.000Z';
const profile = makeInboxContactProfile({
  organizationId: 'org-a', conversationId: 'thread-a',
  displayName: 'Ana Maria', observedAt: observed,
});
assert.equal(profile.source, 'whatsapp_profile');
assert.ok(new Date(profile.expiresAt).getTime() - new Date(observed).getTime() === 90*86400000);
assert.throws(() => makeInboxContactProfile({
  organizationId: 'org-a', conversationId: 'thread-a', displayName: 'Ana', observedAt: observed,
}, 91), /INBOX_CONTACT_RETENTION_INVALID/);

const profiles: InboxContactProfile[] = [
  profile,
  { ...profile, organizationId: 'org-b', displayName: 'Nome de outra organização' },
  { ...profile, conversationId: 'hidden-thread', displayName: 'Outro contato' },
  { ...profile, expiresAt: '2026-09-01T00:00:00.000Z', displayName: 'Expirado' },
  { ...profile, source: 'untrusted' as any, displayName: 'Origem desconhecida' },
];
const results = filterAuthorizedInboxContactProfiles(profiles, 'org-a', ['thread-a'], new Date('2026-10-08T13:00:00Z'));
assert.equal(results.length, 1);
assert.equal(results[0].displayName, 'Ana Maria');

const normalized = normalizeWhatsAppWebhookEnvelope({
  object: 'whatsapp_business_account',
  entry: [{
    changes: [{
      value: {
        metadata: { phone_number_id: 'phone-1' },
        contacts: [
          { wa_id: '5543999999999', profile: { name: 'Ana Maria' } },
          { wa_id: '5533888888888', profile: { name: 'Pessoa incorreta' } },
        ],
        messages: [{
          id: 'wamid.name-1', from: '5543999999999',
          timestamp: '1791460800', type: 'text', text: { body: 'Olá' },
        }],
      },
    }],
  }],
});
assert.equal(normalized.length, 1);
assert.equal(normalized[0].kind, 'message');
if (normalized[0].kind !== 'message') throw new Error('NO_MESSAGE');
assert.equal(normalized[0].senderDisplayName, 'Ana Maria');

class ProfileMemory implements InboxContactProfileStore {
  records: InboxContactProfile[] = [];
  async upsert(input: {
    organizationId: string; conversationId: string;
    displayName: string; observedAt: string;
  }) {
    this.records = this.records.filter(record => !(record.organizationId === input.organizationId &&
      record.conversationId === input.conversationId));
    this.records.push(makeInboxContactProfile(input));
  }
  async list(input: { organizationId: string; conversationIds: readonly string[] }) {
    return this.records.filter(profile => profile.organizationId === input.organizationId &&
      input.conversationIds.includes(profile.conversationId));
  }
}
class ContentMemory implements ConnectMessageContentStore {
  records: ConnectMessageContentRecord[] = [];
  async put(record: ConnectMessageContentRecord) {
    if (!this.records.find(candidate => candidate.messageId === record.messageId)) this.records.push(record);
    return { kind: 'created' as const, record };
  }
  async get() { return null; }
  async getByProviderMessageId() { return null; }
  async listConversation() { return this.records; }
  async updateDeliveryStatus() { return null; }
}
const registry = new WhatsAppConnectionRegistry([{
  organizationId: 'org-a', phoneNumberId: 'phone-1',
  connectionRef: 'primary', enabled: true,
}]);
const threads = new InMemoryConnectThreadStore();
const content = new ContentMemory();
const contactProfiles = new ProfileMemory();
const ingestor = new WhatsAppInboxIngestor(
  registry, content, threads, () => new Date('2026-10-08T12:00:00Z'), contactProfiles,
);
await ingestor.ingest(normalized);
assert.equal(contactProfiles.records.length, 1);
assert.equal(contactProfiles.records[0].organizationId, 'org-a');
assert.equal(contactProfiles.records[0].displayName, 'Ana Maria');
assert.ok(!JSON.stringify(await threads.listByOrganization({ organizationId: 'org-a' })).includes('Ana Maria'), 'thread stream remains PII-minimal');
assert.ok(!JSON.stringify(content.records).includes('Ana Maria'), 'name not copied into message records');

const contextProvider: CanonicalContextProvider = {
  async resolve({ requestedOrganizationId }) {
    return { status: 'resolved', context: {
      actorUid: 'uid-1', systemRole: null, globalAccess: false,
      organizationId: requestedOrganizationId || 'org-a',
      organizationRole: 'admin', permissions: [], capabilities: [],
      appAccess: { musicscale: true },
    } };
  },
};
function response() {
  const r: any = {
    statusCode: 200, body: null, headers: {},
    setHeader(k: string, v: string) { this.headers[k] = v; return this; },
    status(c: number) { this.statusCode = c; return this; },
    json(body: any) { this.body = body; return this; },
  };
  return r;
}
const handler = createConnectInboxConversationListHttpHandler({
  contextProvider, threadStore: threads, messageStore: content,
  contactProfileStore: contactProfiles,
});
const res = response();
await handler({ query: { organizationId: 'org-a' }, headers: { authorization: 'Bearer token' } } as any, res);
assert.equal(res.statusCode, 200);
assert.equal(res.body.conversations.length, 1);
assert.equal(res.body.conversations[0].contact?.displayName, 'Ana Maria');
assert.equal(JSON.stringify(res.body).includes('5543999999999'), false, 'phone withheld from browser');
assert.equal(JSON.stringify(res.body).includes('wamid.name-1'), false, 'provider id withheld from browser');

const injected = new ProfileMemory();
injected.records = [{ ...contactProfiles.records[0], organizationId: 'org-b', displayName: 'Vazamento' }];
const unsafeProvider = createConnectInboxConversationListHttpHandler({
  contextProvider, threadStore: threads, messageStore: content,
  contactProfileStore: injected,
});
const escaped = response();
await unsafeProvider({ query: { organizationId: 'org-a' }, headers: { authorization: 'Bearer token' } } as any, escaped);
assert.equal(escaped.body.conversations[0].contact, undefined, 'defense in depth filters foreign profile on response');
console.log('Inbox contact profile: signed sender match, org-bound data, expiry and browser minimization PASS');
