import {
  CanonicalFactEvent,
  CoreFactPort,
  FactRecordingMusicScaleReadTool,
  StructuredLogCoreFactPort,
  createToolActionFact,
} from '../core/runtime/canonicalFacts';
import type { MusicScaleReadToolPort } from '../core/runtime/connectCore';

let passed = 0;
let total = 0;

function checkEqual(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) {
    console.error(`❌ ${message} - Expected: ${String(expected)}, Actual: ${String(actual)}`);
    throw new Error(message);
  }
  passed++;
}

function baseInput(): Parameters<MusicScaleReadToolPort['getNextSchedule']>[0] {
  return {
    authToken: 'Bearer secret-that-must-not-be-logged',
    actorUid: 'user-super-secret-12345',
    systemRole: null,
    globalAccess: false,
    organizationId: 'org-01',
    organizationRole: 'member',
    permissions: ['scales.read'],
    capabilities: [],
    requiredCapability: 'scales.read',
    requestId: 'req-01',
    correlationId: 'cor-01',
    channel: { type: 'inapp', conversationId: 'conv-01' },
    locale: 'pt-BR',
  };
}

console.log('--- Running Canonical Fact Foundation Tests ---');

{
  const fact = createToolActionFact({
    eventType: 'TOOL_ACTION_REQUESTED',
    requestId: 'req-01',
    organizationId: 'org-01',
    actorId: 'user-01',
    intent: 'get_next_schedule',
    channel: 'inapp',
    result: 'requested',
    requiredCapability: 'scales.read',
    occurredAt: new Date('2026-09-17T12:00:00.000Z'),
  });

  checkEqual(
    fact.eventId,
    'connect:req-01:musicscale.get_next_schedule:requested',
    'fact event id is stable for request/tool/phase',
  );
  checkEqual(fact.eventType, 'TOOL_ACTION_REQUESTED', 'fact event type is canonical');
  checkEqual(fact.occurredAt, '2026-09-17T12:00:00.000Z', 'fact records occurredAt');
  checkEqual(fact.recordedAt, fact.occurredAt, 'initial fact records a deterministic recordedAt');
  checkEqual(fact.organizationId, 'org-01', 'fact carries tenant id');
  checkEqual(fact.actorId, 'user-01', 'fact carries actor reference');
  checkEqual(fact.sourceApp, 'connect', 'fact declares canonical source app');
  checkEqual(fact.subjectRef, 'tool:musicscale.get_next_schedule', 'fact declares subject reference');
  checkEqual(fact.evidenceRef, 'connect-request:req-01', 'requested fact points to request evidence');
  checkEqual(fact.sensitivity, 'internal', 'fact is classified for sensitivity');
  checkEqual(fact.version, 1, 'fact schema is explicitly versioned');
  checkEqual(fact.payload.requiredCapability, 'scales.read', 'fact keeps minimum authorization context');
  checkEqual(
    JSON.stringify(fact).includes('Bearer secret-that-must-not-be-logged'),
    false,
    'fact shape never contains bearer credentials',
  );
}

{
  const calls: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  const logger = {
    info(message: string, meta?: Record<string, unknown>) {
      calls.push({ message, meta });
    },
  };
  const port = new StructuredLogCoreFactPort(logger);
  const fact = createToolActionFact({
    eventType: 'TOOL_ACTION_COMPLETED',
    requestId: 'req-02',
    organizationId: 'org-02',
    actorId: 'user-super-secret-12345',
    intent: 'get_next_schedule',
    channel: 'inapp',
    result: 'success',
    requiredCapability: 'scales.read',
    downstreamAuditId: 'audit-ms-02',
    occurredAt: new Date('2026-09-17T12:01:00.000Z'),
  });

  await port.record(fact);
  checkEqual(calls.length, 1, 'fact logger emits one structured event');
  checkEqual(calls[0].message, 'MILLIONSNEST_CANONICAL_FACT', 'fact logger uses a stable event name');
  checkEqual(calls[0].meta?.actor, 'use***345', 'fact logger masks actor id');
  checkEqual(
    JSON.stringify(calls[0]).includes('user-super-secret-12345'),
    false,
    'fact log never exposes full actor id',
  );
  checkEqual(
    calls[0].meta?.evidenceRef,
    'musicscale-audit:audit-ms-02',
    'completed fact links to downstream evidence when available',
  );
}

{
  const facts: CanonicalFactEvent[] = [];
  const factPort: CoreFactPort = {
    async record(event) {
      facts.push(event);
    },
  };
  let calls = 0;
  const delegate: MusicScaleReadToolPort = {
    async getNextSchedule(input) {
      calls++;
      return {
        status: 'success',
        data: { organizationId: input.organizationId, eventName: 'Culto de domingo' },
        humanSummary: 'Sua próxima escala é no domingo.',
        auditId: 'audit-ms-success',
        deepLink: '/scales/next',
      };
    },
  };
  const tool = new FactRecordingMusicScaleReadTool(delegate, factPort);

  const result = await tool.getNextSchedule(baseInput());
  checkEqual(calls, 1, 'fact decorator invokes the existing tool exactly once');
  checkEqual(result.status, 'success', 'fact decorator preserves the existing tool result');
  checkEqual(facts.length, 2, 'successful tool invocation emits requested and completed facts');
  checkEqual(facts[0].eventType, 'TOOL_ACTION_REQUESTED', 'requested fact is emitted before execution');
  checkEqual(facts[1].eventType, 'TOOL_ACTION_COMPLETED', 'completed fact is emitted after execution');
  checkEqual(facts[1].payload.result, 'success', 'completed fact records actual outcome');
  checkEqual(
    facts[1].evidenceRef,
    'musicscale-audit:audit-ms-success',
    'successful completed fact links to MusicScale audit evidence',
  );
  checkEqual(
    JSON.stringify(facts).includes(baseInput().authToken),
    false,
    'emitted facts never contain the forwarded bearer',
  );
}

{
  let delegateCalls = 0;
  let factAttempts = 0;
  const errors: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  const failingFactPort: CoreFactPort = {
    async record() {
      factAttempts++;
      throw new Error('fact sink unavailable');
    },
  };
  const delegate: MusicScaleReadToolPort = {
    async getNextSchedule() {
      delegateCalls++;
      return {
        status: 'success',
        data: { id: 'scale-1' },
        humanSummary: 'Sua próxima escala é amanhã.',
        auditId: 'audit-ms-fail-open',
      };
    },
  };
  const tool = new FactRecordingMusicScaleReadTool(delegate, failingFactPort, {
    info() {},
    error(message, meta) {
      errors.push({ message, meta });
    },
  });

  const result = await tool.getNextSchedule(baseInput());
  checkEqual(result.status, 'success', 'fact sink failure does not regress the existing read flow');
  checkEqual(delegateCalls, 1, 'fact sink failure still allows exactly one real tool call');
  checkEqual(factAttempts, 2, 'fact recording is attempted for request and completion');
  checkEqual(errors.length, 2, 'fact sink failures are observable');
  checkEqual(errors[0].message, 'CONNECT_FACT_RECORD_FAILED', 'fact failure uses a stable diagnostic event');
}

{
  const facts: CanonicalFactEvent[] = [];
  const factPort: CoreFactPort = {
    async record(event) {
      facts.push(event);
    },
  };
  const delegate: MusicScaleReadToolPort = {
    async getNextSchedule() {
      throw new Error('upstream unavailable');
    },
  };
  const tool = new FactRecordingMusicScaleReadTool(delegate, factPort);

  let threw = false;
  try {
    await tool.getNextSchedule(baseInput());
  } catch {
    threw = true;
  }
  checkEqual(threw, true, 'tool errors keep the existing failure semantics');
  checkEqual(facts.length, 2, 'tool error still emits requested and completed facts');
  checkEqual(facts[1].eventType, 'TOOL_ACTION_COMPLETED', 'failed invocation gets a completion fact');
  checkEqual(facts[1].payload.result, 'failed', 'failed invocation records failed outcome');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
