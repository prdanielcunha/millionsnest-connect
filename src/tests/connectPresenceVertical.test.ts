import {
  CanonicalContextProvider,
  ConnectCoreService,
  CoreAuditPort,
  MusicScaleReadToolPort,
  resolveConnectCoreIntent,
} from '../core/runtime/connectCore';

let passed = 0;
let total = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  passed++;
}

console.log('--- Running Connect Presence Vertical Tests ---');

equal(resolveConnectCoreIntent('Eu confirmei presença?'), 'get_next_schedule_presence', 'PT presence intent resolves');
equal(resolveConnectCoreIntent('Am I confirmed for my next schedule?'), 'get_next_schedule_presence', 'EN presence intent resolves');
equal(resolveConnectCoreIntent('¿Confirmé mi asistencia?'), 'get_next_schedule_presence', 'ES presence intent resolves');

const context: CanonicalContextProvider = {
  async resolve({ requestedOrganizationId }) {
    return {
      status: 'resolved',
      context: {
        actorUid: 'user-1',
        systemRole: null,
        globalAccess: false,
        organizationId: requestedOrganizationId || 'org-1',
        organizationRole: 'member',
        permissions: [],
        capabilities: [],
        appAccess: { musicscale: true },
      },
    };
  },
};

const calls = { schedule: 0, repertoire: 0, presence: 0, capability: '' };
const tool: MusicScaleReadToolPort = {
  async getNextSchedule() {
    calls.schedule++;
    return { status: 'success', auditId: 'a-schedule', humanSummary: 'schedule', data: {} };
  },
  async getNextScheduleRepertoire() {
    calls.repertoire++;
    return { status: 'success', auditId: 'a-repertoire', humanSummary: 'repertoire', data: {} };
  },
  async getNextSchedulePresence(input) {
    calls.presence++;
    calls.capability = input.requiredCapability;
    return {
      status: 'success',
      auditId: 'a-presence',
      humanSummary: 'Sua presença na próxima escala está confirmada.',
      deepLink: '/scales/scale-1',
      data: { schedule: { id: 'scale-1', organizationId: input.organizationId }, presence: { status: 'accepted' } },
    };
  },
};
const audits: unknown[] = [];
const audit: CoreAuditPort = { async record(event) { audits.push(event); } };
const service = new ConnectCoreService(context, tool, audit);

const result = await service.handleMessage({
  requestId: 'req-presence',
  correlationId: 'cor-presence',
  authToken: 'Bearer token',
  requestedOrganizationId: 'org-1',
  channel: { type: 'inapp', conversationId: 'conv-presence' },
  locale: 'pt-BR',
  text: 'Estou confirmado na próxima escala?',
});

equal(result.status, 'success', 'presence vertical succeeds');
equal(result.status === 'success' ? result.intent : '', 'get_next_schedule_presence', 'presence intent is returned');
equal(calls.presence, 1, 'presence tool is called exactly once');
equal(calls.schedule, 0, 'schedule tool is not called for presence');
equal(calls.repertoire, 0, 'repertoire tool is not called for presence');
equal(calls.capability, 'scales.read', 'Connect carries primary read capability evidence');
equal(result.status === 'success' ? result.auditId : '', 'a-presence', 'downstream audit id reaches caller');
equal(audits.length >= 2, true, 'presence flow is audited');

console.log(`✅ Passed ${passed} / ${total} tests.`);
