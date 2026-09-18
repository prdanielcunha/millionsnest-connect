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

console.log('--- Running Repertoire Fact Extension Tests ---');

const facts: CanonicalFactEvent[] = [];
const factPort: CoreFactPort = { async record(event) { facts.push(event); } };
const delegate: MusicScaleReadToolPort = {
  async getNextSchedule() {
    throw new Error('wrong tool');
  },
  async getNextScheduleRepertoire(input) {
    return {
      status: 'success',
      auditId: 'audit-repertoire-fact',
      humanSummary: '2 músicas.',
      data: { schedule: { organizationId: input.organizationId }, repertoire: [] },
    };
  },
};
const decorated = new FactRecordingMusicScaleReadTool(delegate, factPort);
const result = await decorated.getNextScheduleRepertoire({
  authToken: 'Bearer secret',
  actorUid: 'user-secret-12345',
  systemRole: null,
  globalAccess: false,
  organizationId: 'org-1',
  organizationRole: 'member',
  permissions: [],
  capabilities: [],
  requiredCapability: 'songs.read',
  requestId: 'req-repertoire-fact',
  correlationId: 'cor-repertoire-fact',
  channel: { type: 'inapp', conversationId: 'conv-1' },
  locale: 'pt-BR',
});

equal(result.status, 'success', 'decorated repertoire call succeeds');
equal(facts.length, 2, 'repertoire emits requested and completed facts');
equal(facts[0].payload.toolId, 'musicscale.get_next_schedule_repertoire', 'requested fact identifies repertoire tool');
equal(facts[1].payload.toolId, 'musicscale.get_next_schedule_repertoire', 'completed fact identifies repertoire tool');
equal(facts[1].payload.intent, 'get_next_schedule_repertoire', 'fact identifies repertoire intent');
equal(facts[1].payload.requiredCapability, 'songs.read', 'fact carries primary capability evidence');
equal(facts[1].evidenceRef, 'musicscale-audit:audit-repertoire-fact', 'completion links to MusicScale audit evidence');
equal(JSON.stringify(facts).includes('Bearer secret'), false, 'facts never contain bearer');

console.log(`✅ Passed ${passed} / ${total} tests.`);
