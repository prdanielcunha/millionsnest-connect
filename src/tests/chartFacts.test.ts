import {
  CanonicalFactEvent,
  CoreFactPort,
  FactRecordingMusicScaleReadTool,
} from '../core/runtime/canonicalFacts';
import type { MusicScaleReadToolPort } from '../core/runtime/connectCore';

let passed = 0;
let total = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  passed++;
}

console.log('--- Running Chart Fact Tests ---');

const facts: CanonicalFactEvent[] = [];
const delegate: MusicScaleReadToolPort = {
  async getNextSchedule() { throw new Error('wrong tool'); },
  async getNextScheduleChart(input) {
    return {
      status: 'success',
      auditId: 'audit-chart-fact',
      humanSummary: 'Cifra pronta.',
      data: { schedule: { organizationId: input.organizationId }, chart: { status: 'ready' } },
    };
  },
};
const port: CoreFactPort = { async record(event) { facts.push(event); } };
const tool = new FactRecordingMusicScaleReadTool(delegate, port);

const result = await tool.getNextScheduleChart({
  authToken: 'Bearer chart-secret',
  actorUid: 'user-secret-12345',
  systemRole: null,
  globalAccess: false,
  organizationId: 'org-1',
  organizationRole: 'member',
  permissions: [],
  capabilities: [],
  requiredCapability: 'songs.read',
  requestId: 'req-chart-fact',
  correlationId: 'cor-chart-fact',
  channel: { type: 'inapp', conversationId: 'conv-1' },
  locale: 'pt-BR',
  songTitleQuery: 'Promessas',
});

equal(result.status, 'success', 'decorated chart call succeeds');
equal(facts.length, 2, 'chart emits requested and completed facts');
equal(facts[0].payload.toolId, 'musicscale.get_next_schedule_chart', 'fact identifies chart tool');
equal(facts[1].payload.intent, 'get_next_schedule_chart', 'fact identifies chart intent');
equal(facts[1].evidenceRef, 'musicscale-audit:audit-chart-fact', 'completion keeps MusicScale evidence');
equal(JSON.stringify(facts).includes('Bearer chart-secret'), false, 'facts never contain bearer');
equal(JSON.stringify(facts).includes('Promessas'), false, 'facts do not persist song title/message content');

console.log(`✅ Passed ${passed} / ${total} tests.`);
