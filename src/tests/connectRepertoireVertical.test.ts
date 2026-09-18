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

console.log('--- Running Connect Repertoire Vertical Tests ---');

equal(
  resolveConnectCoreIntent('Quais músicas vou tocar na próxima escala?'),
  'get_next_schedule_repertoire',
  'PT-BR repertoire intent resolves',
);
equal(
  resolveConnectCoreIntent('What songs am I playing?'),
  'get_next_schedule_repertoire',
  'EN repertoire intent resolves',
);
equal(
  resolveConnectCoreIntent('¿Qué canciones voy a tocar?'),
  'get_next_schedule_repertoire',
  'ES repertoire intent resolves',
);

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

const calls = { schedule: 0, repertoire: 0, requiredCapability: '' };
const tool: MusicScaleReadToolPort = {
  async getNextSchedule() {
    calls.schedule++;
    return {
      status: 'success',
      auditId: 'audit-schedule',
      humanSummary: 'Sua próxima escala é domingo.',
      data: { id: 'scale-1' },
    };
  },
  async getNextScheduleRepertoire(input) {
    calls.repertoire++;
    calls.requiredCapability = input.requiredCapability;
    return {
      status: 'success',
      auditId: 'audit-repertoire',
      humanSummary: 'Sua próxima escala tem 2 músicas.',
      deepLink: '/scales/scale-1',
      data: {
        schedule: { id: 'scale-1', organizationId: input.organizationId },
        repertoire: [
          { id: 'song-1', order: 1, title: 'Promessas' },
          { id: 'song-2', order: 2, title: 'Bondade de Deus' },
        ],
      },
    };
  },
};
const auditEvents: unknown[] = [];
const audit: CoreAuditPort = {
  async record(event) { auditEvents.push(event); },
};

const service = new ConnectCoreService(context, tool, audit);
const result = await service.handleMessage({
  requestId: 'req-repertoire',
  correlationId: 'cor-repertoire',
  authToken: 'Bearer token',
  requestedOrganizationId: 'org-1',
  channel: { type: 'inapp', conversationId: 'conv-repertoire' },
  locale: 'pt-BR',
  text: 'Quais músicas vou tocar?',
});

equal(result.status, 'success', 'repertoire vertical succeeds');
equal(result.status === 'success' ? result.intent : '', 'get_next_schedule_repertoire', 'response preserves repertoire intent');
equal(calls.schedule, 0, 'repertoire request does not call next-schedule tool');
equal(calls.repertoire, 1, 'repertoire request calls repertoire tool exactly once');
equal(calls.requiredCapability, 'songs.read', 'Connect carries the primary read capability as evidence');
equal(result.status === 'success' ? result.auditId : '', 'audit-repertoire', 'MusicScale audit id reaches caller');
equal(result.status === 'success' ? result.deepLink : '', '/scales/scale-1', 'canonical deep link reaches caller');
equal(auditEvents.length >= 2, true, 'request and completion are audited');

console.log(`✅ Passed ${passed} / ${total} tests.`);
