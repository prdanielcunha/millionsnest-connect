import { createToolActionFact } from '../core/runtime/canonicalFacts';
import { createConnectCoreRuntimeBundle } from '../core/runtime/connectCoreRuntimeFactory';
import { InMemoryToolActivityReadModel } from '../core/runtime/factReadModels';

let passed = 0;
let total = 0;

function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
  passed++;
}

console.log('--- Running P1 Fact Read Model Tests ---');

const requested = createToolActionFact({
  eventType: 'TOOL_ACTION_REQUESTED',
  requestId: 'req-read-model-1',
  organizationId: 'org-1',
  actorId: 'user-1',
  intent: 'get_next_schedule',
  channel: 'inapp',
  result: 'requested',
  requiredCapability: 'scales.read',
  occurredAt: new Date('2026-09-18T00:00:00.000Z'),
});

const completed = createToolActionFact({
  eventType: 'TOOL_ACTION_COMPLETED',
  requestId: 'req-read-model-1',
  organizationId: 'org-1',
  actorId: 'user-1',
  intent: 'get_next_schedule',
  channel: 'inapp',
  result: 'success',
  requiredCapability: 'scales.read',
  downstreamAuditId: 'audit-ms-read-model-1',
  occurredAt: new Date('2026-09-18T00:00:01.000Z'),
});

{
  const projection = new InMemoryToolActivityReadModel();
  await projection.record(requested);
  await projection.record(completed);
  await projection.record(completed);

  const snapshot = projection.get('org-1');
  equal(snapshot.sourceEventCount, 2, 'duplicate eventId is ignored');
  equal(snapshot.totals.requested, 1, 'requested count is projected');
  equal(snapshot.totals.completed, 1, 'completed count is projected');
  equal(snapshot.totals.success, 1, 'success outcome is projected');
  equal(snapshot.lastEventId, completed.eventId, 'latest factual event is retained');
  equal(
    snapshot.lastEvidenceRef,
    'musicscale-audit:audit-ms-read-model-1',
    'read model preserves source evidence reference',
  );
  equal(snapshot.tools.length, 1, 'tool summary is compact');
  equal(snapshot.tools[0].toolId, 'musicscale.get_next_schedule', 'tool summary identifies source tool');
}

{
  const projection = new InMemoryToolActivityReadModel();
  const otherOrg = createToolActionFact({
    eventType: 'TOOL_ACTION_COMPLETED',
    requestId: 'req-read-model-other',
    organizationId: 'org-2',
    actorId: 'user-2',
    intent: 'get_next_schedule',
    channel: 'inapp',
    result: 'denied',
    requiredCapability: 'scales.read',
    occurredAt: new Date('2026-09-18T00:00:02.000Z'),
  });

  projection.rebuild([completed, otherOrg, requested, completed]);
  equal(projection.get('org-1').sourceEventCount, 2, 'rebuild stays event-id idempotent');
  equal(projection.get('org-2').sourceEventCount, 1, 'tenant two has independent projection');
  equal(projection.get('org-2').totals.denied, 1, 'tenant two outcome is isolated');
  equal(projection.get('org-1').totals.denied, 0, 'tenant one never receives tenant two outcome');

  const first = JSON.stringify(projection.get('org-1'));
  projection.rebuild([requested, completed]);
  equal(JSON.stringify(projection.get('org-1')), first, 'projection rebuild is deterministic without AI');
}

{
  const bundle = createConnectCoreRuntimeBundle({
    env: {
      MILLIONSNEST_HUB_ORIGIN: 'https://hub.example.test',
      MUSICSCALE_ORIGIN: 'https://musicscale.example.test',
    },
    logger: { info() {}, error() {} },
    fetchImpl: (async (input: any) => {
      const url = String(input);
      if (url.includes('/api/ecosystem/connect/session-context')) {
        return new Response(JSON.stringify({
          success: true,
          protocolVersion: '1.0.0',
          user: { uid: 'user-1', systemRole: 'user', capabilities: [] },
          globalAccess: false,
          activeOrganizationId: 'org-1',
          activeOrganization: {
            id: 'org-1',
            organizationRole: 'member',
            permissions: [],
            capabilities: [],
          },
          appAccess: {
            musicscale: {
              appId: 'musicscale',
              organizationId: 'org-1',
              accessible: true,
              decisionState: 'granted',
            },
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (url.includes('/api/v1/connect/next-schedule')) {
        return new Response(JSON.stringify({
          success: true,
          auditId: 'audit-ms-runtime-bundle',
          organizationId: 'org-1',
          schedule: {
            id: 'scale-runtime',
            organizationId: 'org-1',
            date: '2026-09-20',
            time: '19:00',
            deepLink: '/scales/scale-runtime',
          },
          humanSummary: 'Sua próxima escala é domingo.',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      throw new Error(`unexpected URL ${url}`);
    }) as any,
  });

  const result = await bundle.core.handleMessage({
    requestId: 'req-runtime-bundle',
    correlationId: 'cor-runtime-bundle',
    authToken: 'Bearer user-firebase-token',
    requestedOrganizationId: 'org-1',
    channel: { type: 'inapp', conversationId: 'conv-runtime-bundle' },
    locale: 'pt-BR',
    text: 'Qual é minha próxima escala?',
  });

  equal(result.status, 'success', 'real runtime bundle preserves existing Core success path');
  const snapshot = bundle.readModels.toolActivity.get('org-1');
  equal(snapshot.sourceEventCount, 2, 'real runtime emits both facts into the read model');
  equal(snapshot.totals.requested, 1, 'runtime read model records tool request');
  equal(snapshot.totals.success, 1, 'runtime read model records successful outcome');
  equal(
    snapshot.lastEvidenceRef,
    'musicscale-audit:audit-ms-runtime-bundle',
    'runtime read model ends at downstream auditable evidence',
  );
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
