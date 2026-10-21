import assert from 'node:assert/strict';
import { ConnectCoreService, resolveConnectCoreIntent } from '../core/runtime/connectCore';
import { understandConnectQuestion, questionGuidance } from '../core/runtime/connectQuestionUnderstanding';
import { WhatsAppAssistOrchestrator, localeFromText } from '../core/runtime/whatsappAssistOrchestrator';
import { WhatsAppConnectionRegistry } from '../core/channels/whatsappConnectionRegistry';
import { createConversationIdFromChannelIdentity } from '../core/inbox/messageContentStore';

for (const text of ['Qual a próxima escala?', 'qual é a proxima escala', 'Quando vou tocar?', 'Quando eu vou cantar?', 'Estou escalado?', 'Tenho alguma escala?', 'Tem escala para mim?', 'Pode me mostrar minha escala?', 'What is my next schedule?', 'When am I playing?', 'Cuál es mi próxima escala?']) {
  assert.equal(resolveConnectCoreIntent(text), 'get_next_schedule', text);
}
for (const text of ['Quais músicas vou tocar?', 'Me manda o repertório', 'What songs am I playing?']) assert.equal(resolveConnectCoreIntent(text), 'get_next_schedule_repertoire', text);
for (const text of ['Eu confirmei presença?', 'Estou confirmado na próxima escala?', 'My attendance for my next schedule?']) assert.equal(resolveConnectCoreIntent(text), 'get_next_schedule_presence', text);
assert.equal(resolveConnectCoreIntent('Me manda a cifra de Santo'), 'get_next_schedule_chart');
for (const text of ['Estou escalado domingo?', 'Qual minha escala de 25/10/2026?', 'Qual a escala do João?', 'Quem está na próxima escala?', 'Todas as minhas escalas', 'Meu repertório da semana']) {
  assert.equal(resolveConnectCoreIntent(text), 'unknown', text);
  assert.equal(understandConnectQuestion(text).clarification, 'scope', text);
}
for (const text of ['Confirma minha presença', 'Não vou conseguir tocar domingo', 'Quero cancelar minha próxima escala']) assert.equal(understandConnectQuestion(text).clarification, 'change', text);
assert.equal(resolveConnectCoreIntent('Qual o saldo no NestFinance?'), 'unknown');
assert.equal(resolveConnectCoreIntent('Preciso de um atendente para minha próxima escala'), 'unknown');
for (const text of ['Próxima escala', 'Repertório', 'Presença', 'Cifra de Santo']) assert.notEqual(resolveConnectCoreIntent(text), 'unknown', text);
assert.match(questionGuidance('unknown', 'pt-BR'), /Próxima escala\n• Repertório\n• Presença/);
assert.equal(localeFromText('Qual a próxima escala?'), 'pt-BR');
assert.equal(localeFromText('Estou confirmado na próxima escala?'), 'pt-BR');
assert.equal(localeFromText('Cuál es mi próxima escala?'), 'es-ES');
assert.equal(localeFromText('What is my next schedule?'), 'en-US');

const now = new Date('2026-10-21T18:00:00Z');
const channelOrg = 'channel-org', targetOrg = 'authorized-church';
const sender = '5543999990000', phoneNumberId = '123456789';
const conversationId = createConversationIdFromChannelIdentity({ organizationId: channelOrg, connectionRef: 'primary', channel: 'whatsapp', channelUserId: sender });
async function scenario(options: { linked?: boolean; text?: string; fail?: 'binding' | 'hub' | 'token' | 'core' | 'provider'; empty?: boolean; age?: number; foreign?: boolean; denial?: boolean; humanOwned?: boolean } = {}) {
  const text = options.text ?? 'Qual a próxima escala?';
  const event = { kind: 'message' as const, providerMessageId: 'wamid.natural', from: sender, phoneNumberId,
    timestamp: String(Math.floor(now.getTime() / 1000)), messageType: 'text', text };
  const sent: string[] = [];
  let toolCalls = 0, hubCalls = 0;
  const core = new ConnectCoreService({ async resolve() { return { status: 'resolved', context: {
    actorUid: 'linked-user', organizationId: targetOrg, systemRole: null, globalAccess: false,
    organizationRole: 'member', permissions: ['scales.read'], capabilities: [], appAccess: { musicscale: !options.denial },
  } }; } }, { async getNextSchedule(input) {
    toolCalls++;
    assert.equal(input.organizationId, targetOrg);
    assert.equal(input.authToken, 'verified-id-token');
    if (options.fail === 'core') throw new Error('private upstream details');
    return { status: 'success', data: options.empty ? null : { organizationId: targetOrg, date: '2026-10-25', time: '19:00', functionNames: ['Guitarra'] },
      humanSummary: options.empty ? 'Você não possui nenhuma próxima escala.' : 'Sua próxima escala é no domingo.', auditId: 'audit-1' };
  } }, { async record() {} });
  const orchestrator = new WhatsAppAssistOrchestrator({
    registry: new WhatsAppConnectionRegistry([{ organizationId: channelOrg, connectionRef: 'primary', enabled: true, phoneNumberId }]),
    messageStore: { async getByProviderMessageId() { return {
      organizationId: options.foreign ? 'foreign-org' : channelOrg, conversationId, direction: 'inbound', senderRef: sender,
      recipientRef: phoneNumberId, occurredAt: new Date(now.getTime() - (options.age ?? 0)).toISOString(),
    }; } } as any,
    bindingStore: { async get() {
      if (options.fail === 'binding') throw new Error('private binding detail');
      return options.linked ? { grantRef: 'grant-ref', grantSecret: 'secret-do-not-leak', targetOrganizationId: targetOrg, expiresAtMs: now.getTime() + 60000 } : null;
    }, async put() {} } as any,
    hubClient: { async exchangeGrant() { hubCalls++; if (options.fail === 'hub') throw new Error('private hub detail'); return { organizationId: targetOrg, customToken: 'custom-token', userId: 'linked-user' }; } } as any,
    tokenExchanger: { async exchange() { if (options.fail === 'token') throw new Error('private token detail'); return 'verified-id-token'; } } as any,
    responseGuard: async () => !options.humanOwned,
    core, replyService: { async send(input: any) { sent.push(input.text); if (options.fail === 'provider') throw new Error('ASSIST_REPLY_ACCEPTED_PERSISTENCE_INCOMPLETE'); } } as any,
    now: () => now, linkRootSecret: 'test-root-secret-with-more-than-thirty-two-characters', publicOrigin: 'https://connect.millionsnest.com',
  });
  if (options.fail === 'provider') await assert.rejects(() => orchestrator.afterIngest([event]), /ACCEPTED_PERSISTENCE/);
  else await orchestrator.afterIngest([event]);
  assert.ok(sent.every(t => !/secret-do-not-leak|verified-id-token|private .* detail/.test(t)));
  return { sent, toolCalls, hubCalls };
}
const unlinked = await scenario();
assert.equal(unlinked.toolCalls, 0); assert.equal(unlinked.sent.length, 1);
assert.match(unlinked.sent[0], /vincule com segurança/);
const linked = await scenario({ linked: true });
assert.equal(linked.toolCalls, 1); assert.equal(linked.sent.length, 1); assert.match(linked.sent[0], /Guitarra/);
const empty = await scenario({ linked: true, empty: true });
assert.equal(empty.toolCalls, 1); assert.match(empty.sent[0], /não possui nenhuma/);
for (const fail of ['binding', 'hub', 'token'] as const) {
  const result = await scenario({ linked: true, fail });
  assert.equal(result.sent.length, 1); assert.match(result.sent[0], /Não consegui consultar/);
  assert.equal(result.toolCalls, 0);
}
const failedTool = await scenario({ linked: true, fail: 'core' });
assert.equal(failedTool.sent.length, 1); assert.doesNotMatch(failedTool.sent[0], /nenhuma próxima escala/);
const denied = await scenario({ linked: true, denial: true }); assert.equal(denied.toolCalls, 0); assert.match(denied.sent[0], /não possui acesso/);
const ambiguous = await scenario({ linked: true, fail: 'provider' }); assert.equal(ambiguous.sent.length, 1, 'provider ambiguity must never trigger a second fallback send');
for (const options of [{ humanOwned: true }, { age: 24 * 3600000 }, { foreign: true }]) { const result = await scenario({ linked: true, ...options }); assert.equal(result.sent.length, 0); assert.equal(result.hubCalls, 0); }
for (const text of ['Estou escalado domingo?', 'Confirma minha presença', 'Oi, preciso de ajuda']) {
  const result = await scenario({ text, linked: true }); assert.equal(result.toolCalls, 0); assert.equal(result.hubCalls, 0); assert.equal(result.sent.length, 1);
}
console.log('Natural questions: language variants, scope clarification, real Core authorization, link/scale/empty/error replies, evidence window and no duplicate provider sends passed.');
