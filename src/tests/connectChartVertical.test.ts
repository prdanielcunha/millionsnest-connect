import {
  CanonicalContextProvider,
  ConnectCoreService,
  CoreAuditPort,
  MusicScaleReadToolPort,
  resolveConnectChartTitleQuery,
  resolveConnectCoreIntent,
} from '../core/runtime/connectCore';

let passed = 0;
let total = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  passed++;
}

console.log('--- Running Connect Chart Vertical Tests ---');

equal(resolveConnectCoreIntent('Me mostra a cifra de Promessas'), 'get_next_schedule_chart', 'PT chart intent resolves');
equal(resolveConnectChartTitleQuery('Me mostra a cifra de Promessas'), 'Promessas', 'PT title is extracted');
equal(resolveConnectChartTitleQuery('Show me the chords for Promises'), 'Promises', 'EN title is extracted');
equal(resolveConnectChartTitleQuery('Muéstrame la cifra de Promesas'), 'Promesas', 'ES title is extracted');
equal(resolveConnectCoreIntent('Me mostra uma cifra'), 'get_next_schedule_chart', 'chart request without title still resolves to chart intent');

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

const calls = { chart: 0, title: '', capability: '' };
const tool: MusicScaleReadToolPort = {
  async getNextSchedule() { throw new Error('wrong tool'); },
  async getNextScheduleChart(input) {
    calls.chart++;
    calls.title = input.songTitleQuery;
    calls.capability = input.requiredCapability;
    return {
      status: 'success',
      auditId: 'audit-chart',
      humanSummary: 'Aqui está a cifra de Promessas no tom A.',
      deepLink: '/scales/scale-1',
      data: {
        schedule: { id: 'scale-1', organizationId: input.organizationId },
        chart: { status: 'ready', title: 'Promessas', scheduledKey: 'A', chords: 'A E F#m D' },
      },
    };
  },
};
const audits: unknown[] = [];
const audit: CoreAuditPort = { async record(event) { audits.push(event); } };
const service = new ConnectCoreService(context, tool, audit);

const result = await service.handleMessage({
  requestId: 'req-chart',
  correlationId: 'cor-chart',
  authToken: 'Bearer token',
  requestedOrganizationId: 'org-1',
  channel: { type: 'inapp', conversationId: 'conv-chart' },
  locale: 'pt-BR',
  text: 'Me mostra a cifra de Promessas',
});

equal(result.status, 'success', 'chart vertical succeeds');
equal(result.status === 'success' ? result.intent : '', 'get_next_schedule_chart', 'chart intent is returned');
equal(calls.chart, 1, 'chart tool is called once');
equal(calls.title, 'Promessas', 'only extracted song title reaches tool boundary');
equal(calls.capability, 'songs.read', 'Connect carries primary chart capability evidence');
equal(result.status === 'success' ? result.auditId : '', 'audit-chart', 'downstream audit reaches caller');
equal(audits.length >= 2, true, 'chart flow is audited');

const missingTitle = await service.handleMessage({
  requestId: 'req-chart-missing-title',
  correlationId: 'cor-chart-missing-title',
  authToken: 'Bearer token',
  requestedOrganizationId: 'org-1',
  channel: { type: 'inapp', conversationId: 'conv-chart' },
  locale: 'pt-BR',
  text: 'Me mostra uma cifra',
});
equal(missingTitle.status, 'needs_context', 'chart request without title asks for song context');
equal(missingTitle.status === 'needs_context' ? missingTitle.code : '', 'SONG_REQUIRED', 'missing chart title uses SONG_REQUIRED');
equal(calls.chart, 1, 'missing-title request does not call MusicScale chart tool');

console.log(`✅ Passed ${passed} / ${total} tests.`);
