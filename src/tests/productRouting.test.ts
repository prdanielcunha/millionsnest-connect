import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { applyProductRoute, routeProduct, routingId, verifyProductOrigin, parseProductSupportOwners, type ProductRoutingState, type ProductRouteStore } from '../core/routing/productRouting';
import { FirestoreProductRouteStore } from '../core/routing/firestoreProductRouteStore';
import { WhatsAppProductRouting } from '../core/routing/whatsappProductRouting';
import { defaultAgentSettings, reviseAgentSettings } from '../core/agents/productAgentSettings';

assert.deepEqual(parseProductSupportOwners(undefined), {});
assert.deepEqual(parseProductSupportOwners('{"musicscale":"synthetic-owner"}'), { musicscale: 'synthetic-owner' });
for (const raw of ['', 'null', '[]', '{"__proto__":"owner"}', '{"unknown":"owner"}', '{"musicscale":42}', '{"nestfinance":"../tenant"}', '{"nestjourney":" user "}']) {
  assert.throws(() => parseProductSupportOwners(raw), /PRODUCT_SUPPORT_OWNERS_INVALID/);
}
import { WhatsAppConnectionRegistry } from '../core/channels/whatsappConnectionRegistry';
import { createConversationIdFromChannelIdentity, createMessageEvidenceRef, type ConnectMessageContentStore } from '../core/inbox/messageContentStore';
import { InMemoryConnectThreadStore } from '../core/inbox/threadStore';
import { ConnectThreadCommandService } from '../core/inbox/threadService';
const now = new Date('2026-10-14T12:00:00Z');
assert.equal(routeProduct('Olá', null, +now).kind, 'clarify');
assert.equal(routeProduct('MusicScale e NestFinance', 'musicscale', +now).kind, 'clarify');
assert.equal(routeProduct('NestJourney', 'musicscale', +now).product, 'nestjourney');
assert.equal(routeProduct('documentos pendentes', 'nestfinance', +now).product, 'nestfinance');
assert.equal(routeProduct('Qual é minha próxima escala?', null, +now).product, 'musicscale');
assert.equal(routeProduct('Qual é minha próxima escala?', 'nestfinance', +now).product, 'nestfinance');
assert.equal(routeProduct('Qual é minha próxima escala?', 'nestfinance', +now).kind, 'clarify');
assert.equal(routeProduct('Qual é minha próxima escala?', 'musicscale', +now).kind, 'route');
// Unnamed high-confidence product requests route without granting private app
// access; mixed categories and cross-app context must never silently switch.
for (const [utterance, expected] of [
  ['Preciso conferir um comprovante de oferta', 'nestfinance'],
  ['Como registrar dízimos e despesas?', 'nestfinance'],
  ['Quero acolher um visitante novo', 'nestjourney'],
  ['Como acompanhar uma Casa de Paz?', 'nestjourney'],
  ['Preciso de uma cifra para o louvor', 'musicscale'],
  ['I need my donation receipt', 'nestfinance'],
  ['How can I welcome new visitors for discipleship?', 'nestjourney'],
  ['Need the chords for worship', 'musicscale'],
  ['Quiero registrar diezmos', 'nestfinance'],
  ['Necesito ayuda con discipulado', 'nestjourney'],
] as const) {
  const result = routeProduct(utterance, null, +now);
  assert.equal(result.kind, 'route', utterance);
  assert.equal(result.product, expected, utterance);
  assert.equal(result.source, expected === 'musicscale' ? 'music_intent' : 'domain_intent');
}
for (const text of [
  'Tenho dúvida de comprovante e do discipulado',
  'Quero conferir cifras e despesas',
  'Preciso de ajuda no aplicativo',
]) {
  assert.equal(routeProduct(text, null, +now).kind, 'clarify', text);
}
assert.equal(routeProduct('Meu comprovante não aparece', 'musicscale', +now).kind, 'clarify');
assert.equal(routeProduct('Meu comprovante não aparece', 'musicscale', +now).product, 'musicscale');
assert.equal(routeProduct('Quero acolher visitantes', 'nestfinance', +now).kind, 'clarify');
assert.equal(routeProduct('Obrigado, tudo resolvido', 'nestfinance', +now).product, 'nestfinance');

const secret = 'only-test-origin-key-at-least-32-characters';
const payload = Buffer.from(JSON.stringify({ version: 1, product: 'nestfinance', issuedAt: +now, expiresAt: +now + 600000 })).toString('base64url');
const token = payload + '.' + createHmac('sha256', secret).update('connect-product-origin:v1:' + payload).digest('base64url');
assert.equal(verifyProductOrigin(`[mn-origin:${token}]`, secret, +now), 'nestfinance');
assert.equal(verifyProductOrigin(`[mn-origin:${token}]`, 'different-test-origin-key-at-least-32-chars', +now), null);
assert.equal(verifyProductOrigin(`[mn-origin:${token}]`, secret, +now + 600000), null);
assert.equal(routeProduct(`MusicScale [mn-origin:${token}]`, null, +now, secret).kind, 'clarify');
assert.equal(routeProduct('MusicScale [mn-origin:forged.invalid]', null, +now, secret).kind, 'clarify');
let state: ProductRoutingState | null = null;
const input = { organizationId: 'channel-org', conversationId: 'opaque-thread', eventId: 'one', occurredAt: now.toISOString(), text: 'MusicScale' };
state = applyProductRoute(state, input, +now).state;
assert.equal(applyProductRoute(state, input, +now).duplicate, true);
assert.throws(() => applyProductRoute(state, { ...input, organizationId: 'other-org' }, +now), /SCOPE_MISMATCH/);
const switched = applyProductRoute(state, { ...input, eventId: 'two', occurredAt: new Date(+now + 1000).toISOString(), text: 'NestFinance' }, +now);
assert.equal(switched.state.product, 'nestfinance'); assert.equal(switched.state.history.length, 2);
assert.equal(applyProductRoute(switched.state, { ...input, eventId: 'late' }, +now).decision, null);

// Real durable adapter: conflict => reload canonical state, no silent overwrite.
let requests = 0;
const adapter = new FirestoreProductRouteStore('millionsnest', async (_url, init) => {
  requests++;
  return init?.method === 'PATCH' ? new Response('{}', { status: requests < 4 ? 409 : 200 }) : new Response('{}', { status: 404 });
}, { async getAccessToken() { return 'runtime-only'; } });
assert.equal((await adapter.decide(input, +now))?.product, 'musicscale'); assert.equal(requests, 4);
await assert.rejects(() => adapter.decide({ ...input, conversationId: '../org-b' }, +now));

const registry = new WhatsAppConnectionRegistry([{ organizationId: 'channel-org', phoneNumberId: 'phone', connectionRef: 'official', enabled: true }]);
const threads = new InMemoryConnectThreadStore();
let clock = new Date(+now - 10000);
const commands = new ConnectThreadCommandService(threads, () => clock);
const states = new Map<string, ProductRoutingState>();
const routes: ProductRouteStore = { async decide(i, at, key) {
  const scope = routingId(i.organizationId, i.conversationId), next = applyProductRoute(states.get(scope) ?? null, i, at, key);
  states.set(scope, next.state); return next.decision;
} };
let stored: any; const sent = new Map<string, string>(); let forged = false, authorizedOwner = false, directoryUnavailable = false;
let settingsMode: 'default' | 'custom' | 'disabled' | 'unavailable' = 'default';
const routing = new WhatsAppProductRouting({ registry, routes, threads, now: () => clock,
  settingsStore: { async read(scope) {
    assert.equal(scope.organizationId, 'channel-org');
    if (settingsMode === 'unavailable') throw new Error('PRIVATE configuration failure');
    if (settingsMode === 'default') return null;
    const settings = defaultAgentSettings(scope.product, 'configured-owner');
    settings.enabled = settingsMode !== 'disabled';
    settings.overview['pt-BR'] = 'Conhecimento público aprovado da organização.';
    return reviseAgentSettings(null, { ...scope, actorUid: 'synthetic-manager', requestId: 'synthetic_settings_0001', expectedVersion: 0, settings }, now).record;
  }, async save() { throw new Error('router must never write settings'); } },
  messages: { async getByProviderMessageId() { return forged ? { ...stored, organizationId: 'org-b' } : stored; } } as unknown as ConnectMessageContentStore,
  replies: { async send(i) { sent.set(i.requestId, i.text); return { kind: 'sent', providerMessageId: 'accepted', messageId: 'id' }; } },
  directory: { async list() { return []; }, async verify() { if (directoryUnavailable) throw new Error('PRIVATE directory failure'); return authorizedOwner; } }, owners: { nestfinance: 'verified-operator' },
});
async function receive(text: string, index: number, occurredAt?: Date, from = 'private-phone') {
  clock = new Date(+now - 10000 + index * 1000);
  const event = { kind: 'message' as const, providerMessageId: `inbound-${index}`, from, phoneNumberId: 'phone', timestamp: String(Math.floor(+clock / 1000)), messageType: 'text', text };
  const scope = { organizationId: 'channel-org', conversationId: createConversationIdFromChannelIdentity({ organizationId: 'channel-org', connectionRef: 'official', channel: 'whatsapp', channelUserId: event.from }) };
  if (!await threads.load(scope)) await commands.open({ ...scope, requestId: 'wa-00-open', evidenceRef: 'open', channel: 'whatsapp', occurredAt: new Date(+clock - 1000) });
  await commands.recordPersonReply({ ...scope, requestId: 'wa-10-in-' + index, evidenceRef: createMessageEvidenceRef('whatsapp', event.providerMessageId) });
  stored = { ...scope, senderRef: event.from, direction: 'inbound', body: text, occurredAt: (occurredAt ?? clock).toISOString() };
  return { event, scope };
}
let current = await receive('Olá', 1); assert.equal((await routing.route([current.event])).length, 0); assert([...sent.values()][0].includes('qual aplicativo'));
const sentCount = sent.size; await routing.route([current.event]); assert.equal(sent.size, sentCount);
current = await receive('Qual é minha próxima escala no MusicScale?', 2); assert.equal((await routing.route([current.event])).length, 1);
current = await receive('NestFinance: documento pendente', 3); assert.equal((await routing.route([current.event])).length, 0); assert([...sent.values()].at(-1)?.includes('atendimento humano'));
assert.equal((await threads.load(current.scope))?.assignedTo, undefined, 'unverified support owner never receives assignment');
assert.equal((await threads.load(current.scope))?.status, 'waiting_team', 'owner unavailable enters the real team queue');
assert.equal((await threads.load(current.scope))?.mode, 'human');
assert.equal((await threads.load(current.scope))?.automationPaused, true);
const reviewEvents = (await threads.readEvents(current.scope)).filter(event => event.eventType === 'HUMAN_REVIEW_REQUESTED');
assert.equal(reviewEvents.length, 1); await routing.route([current.event]);
assert.equal((await threads.readEvents(current.scope)).filter(event => event.eventType === 'HUMAN_REVIEW_REQUESTED').length, 1);
current = await receive('NestJourney: preciso de acompanhamento', 4); assert.equal((await routing.route([current.event])).length, 0);
assert.equal((await threads.load(current.scope))?.status, 'waiting_team', 'an inbound reply cannot remove an unclaimed human request from the queue');
current = await receive('MusicScale: qual é minha próxima escala?', 5); forged = true; await assert.rejects(() => routing.route([current.event]), /EVIDENCE_MISMATCH/); forged = false;
assert.equal((await routing.route([current.event])).length, 0, 'product switches must not resume automation after human review is requested');
current = await receive('NestFinance', 6, new Date(+now - 25 * 3600000)); const countBefore = sent.size; assert.equal((await routing.route([current.event])).length, 0); assert.equal(sent.size, countBefore, 'expired Meta service window cannot send');
authorizedOwner = true; current = await receive('NestFinance', 7, undefined, 'synthetic-second-phone'); await routing.route([current.event]); assert.equal((await threads.load(current.scope))?.assignedTo?.ref, 'verified-operator');
current = await receive('MusicScale: qual é minha próxima escala?', 8, undefined, 'synthetic-second-phone'); assert.equal((await routing.route([current.event])).length, 0, 'human assignment blocks automation');
assert.equal(states.get(routingId(current.scope.organizationId, current.scope.conversationId))?.product, 'musicscale', 'product switch persists while human retains control');
directoryUnavailable = true; current = await receive('NestFinance', 9, undefined, 'synthetic-third-phone'); await routing.route([current.event]);
assert.equal((await threads.load(current.scope))?.status, 'waiting_team', 'unavailable directory also queues instead of assigning or dropping the request');
assert.equal((await threads.load(current.scope))?.assignedTo, undefined);
current = await receive('Preciso de suporte sobre o NestFinance.', 10, undefined, 'synthetic-public-help-phone');
const beforePublicHelp = sent.size;
const beforePublicHelpMode = (await threads.load(current.scope))?.mode;
await routing.route([current.event]);
assert.equal(sent.size, beforePublicHelp + 1);
assert([...sent.values()].some(text => text.includes('Você está no suporte do NestFinance')));
assert.equal((await threads.load(current.scope))?.mode, beforePublicHelpMode, 'public entry help preserves the existing control mode');
await routing.route([current.event]); assert.equal(sent.size, beforePublicHelp + 1, 'same event has the same durable reply key');
current = await receive('Qual é meu saldo no NestFinance?', 11, undefined, 'synthetic-public-help-phone');
await routing.route([current.event]); assert.equal((await threads.load(current.scope))?.status, 'waiting_team', 'private questions transfer to actual human queue');
current = await receive('synthetic-sensitive-caption', 12, undefined, 'synthetic-media-help-phone');
const beforeMedia = sent.size;
await routing.route([{ ...current.event, messageType: 'audio' }]);
assert.equal((await threads.load(current.scope))?.status, 'waiting_team', 'unsupported media enters actual human review');
assert.equal(sent.size, beforeMedia, 'unsupported media does not send or echo sensitive content');
await routing.route([{ ...current.event, messageType: 'audio' }]);
assert.equal((await threads.readEvents(current.scope)).filter(event => event.eventType === 'HUMAN_REVIEW_REQUESTED').length, 1);
directoryUnavailable = false; settingsMode = 'custom';
current = await receive('O que é o NestJourney?', 13, undefined, 'synthetic-configured-profile');
await routing.route([current.event]);
assert([...sent.values()].at(-1)?.includes('Conhecimento público aprovado da organização.'));
assert([...sent.values()].at(-1)?.endsWith('https://nestjourney.millionsnest.com'), 'official URL cannot be configured');
current = await receive('NestJourney: acompanhamento privado', 14, undefined, 'synthetic-configured-owner');
await routing.route([current.event]); assert.equal((await threads.load(current.scope))?.assignedTo?.ref, 'configured-owner');
settingsMode = 'disabled';
current = await receive('MusicScale: qual é minha próxima escala?', 15, undefined, 'synthetic-disabled-profile');
assert.equal((await routing.route([current.event])).length, 0, 'disabled agent cannot forward a domain tool request');
assert.equal((await threads.load(current.scope))?.mode, 'human');
settingsMode = 'unavailable'; const beforeUnavailable = sent.size;
current = await receive('O que é o NestFinance?', 16, undefined, 'synthetic-unavailable-profile');
assert.equal((await routing.route([current.event])).length, 0);
assert.equal((await threads.load(current.scope))?.status, 'waiting_team');
assert.equal(sent.size, beforeUnavailable, 'storage failure must not silently restore default automatic answers');
assert(![...sent.values()].some(text => text.includes('PRIVATE')));
assert(!JSON.stringify([...states.values()]).includes('private-phone')); assert(!JSON.stringify([...states.values()]).includes('documento pendente'));
console.log('Product routing: same number/3 apps, clarification, persistent switches, signed-origin verification, tenant isolation, delayed retries, Meta window, verified human owner and human control passed.');
