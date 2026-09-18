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

console.log('--- Running Presence Fact Tests ---');

const facts: CanonicalFactEvent[] = [];
const delegate: MusicScaleReadToolPort = {
  async getNextSchedule() { throw new Error('wrong tool'); },
  async getNextSchedulePresence(input) {
    return {
      status: 'success',
      auditId: 'audit-presence-fact',
      humanSummary: 'Confirmada.',
      data: { schedule: { organizationId: input.organizationId }, presence: { status: 'accepted' } },
    };
  },
};
const port: CoreFactPort = { async record(event) { facts.push(event); } };
const tool = new FactRecordingMusicScaleReadTool(delegate, port);

const result = await tool.getNextSchedulePresence({
  authToken: 'Bearer top-secret',
  actorUid: 'user-secret-12345',
  systemRole: null,
  globalAccess: false,
  organizationId: 'org-1',
  organizationRole: 'member',
  permissions: [],
  capabilities: [],
  requiredCapability: 'scales.read',
  requestId: 'req-presence-fact',
  correlationId: 'cor-presence-fact',
  channel: { type: 'inapp', conversationId: 'conv-1' },
  locale: 'pt-BR',
});

equal(result.status, 'success', 'decorated presence call succeeds');
equal(facts.length, 2, 'presence emits requested and completed facts');
equal(facts[0].payload.toolId, 'musicscale.get_next_schedule_presence', 'fact identifies presence tool');
equal(facts[1].payload.intent, 'get_next_schedule_presence', 'fact identifies presence intent');
equal(facts[1].evidenceRef, 'musicscale-audit:audit-presence-fact', 'completion keeps MusicScale evidence');
equal(JSON.stringify(facts).includes('Bearer top-secret'), false, 'facts never contain bearer');

console.log(`✅ Passed ${passed} / ${total} tests.`);
