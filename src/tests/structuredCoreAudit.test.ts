import { StructuredLogCoreAuditPort } from '../core/runtime/structuredCoreAudit';

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

console.log('--- Running Structured Core Audit Tests ---');

{
  const calls: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  const audit = new StructuredLogCoreAuditPort({
    info(message, meta) {
      calls.push({ message, meta });
    },
  });

  await audit.record({
    eventType: 'core_request_received',
    requestId: 'req-01',
    correlationId: 'cor-01',
    actorUid: 'user-super-secret-12345',
    organizationId: 'org-01',
    appId: 'musicscale',
    intent: 'get_next_schedule',
    channel: 'inapp',
    result: 'received',
    details: 'Authenticated read-only request accepted.',
  });

  checkEqual(calls.length, 1, 'audit emits one structured event');
  checkEqual(calls[0].message, 'CONNECT_CORE_AUDIT', 'audit uses stable event name');
  checkEqual(calls[0].meta?.actor, 'use***345', 'actor uid is masked before logging');
  checkEqual(
    JSON.stringify(calls[0]).includes('user-super-secret-12345'),
    false,
    'full actor uid is never logged',
  );
  checkEqual(
    JSON.stringify(calls[0]).includes('Authorization'),
    false,
    'audit shape has no authorization field',
  );
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
