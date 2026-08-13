import { ToolGatewayService } from '../core/services/toolGateway';
import { mockEcosystemContext, mockTools } from '../demo/mockData';

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

const listSchedulesTool = mockTools.find((tool) => tool.name === 'listSchedules')!;
const getScheduleTool = mockTools.find((tool) => tool.name === 'getSchedule')!;
const ecosystemContext = {
  ...mockEcosystemContext,
  memberships: mockEcosystemContext.memberships.map((membership) =>
    membership.organizationId === 'org_londrina_01'
      ? { ...membership, permissions: [...membership.permissions, 'musicscale.schedules.view'] }
      : membership
  ),
};
const invocationContext = {
  requestId: 'req_tenant_boundary',
  correlationId: 'cor_tenant_boundary',
  idempotencyKey: 'tenant-boundary-reuse',
  actor: { uid: 'demo-user-001' },
  organization: { id: 'org_londrina_01' },
  appAccess: { appId: 'musicscale', capabilities: [] },
  channel: { type: 'inapp', conversationId: 'conv_tenant_boundary' },
  locale: 'pt-BR',
};

console.log('--- Running Tool Gateway Tenant Boundary Tests ---');

ToolGatewayService.resetDemoState();

const exactMatch = ToolGatewayService.invokeTool(
  ecosystemContext,
  listSchedulesTool,
  { organizationId: 'org_londrina_01' },
  invocationContext,
);
checkEqual(exactMatch.result.status, 'success', 'exact organizationId match succeeds');

const accessibleTenantMismatch = ToolGatewayService.invokeTool(
  ecosystemContext,
  listSchedulesTool,
  { organizationId: 'org_curitiba_02' },
  { ...invocationContext, idempotencyKey: 'accessible-tenant-mismatch' },
);
checkEqual(accessibleTenantMismatch.decision.status, 'denied', 'another accessible tenant is denied');
checkEqual(accessibleTenantMismatch.result.status, 'denied', 'accessible tenant mismatch does not execute');

const arbitraryTenantMismatch = ToolGatewayService.invokeTool(
  ecosystemContext,
  listSchedulesTool,
  { organizationId: 'org_inexistente_999' },
  { ...invocationContext, idempotencyKey: 'arbitrary-tenant-mismatch' },
);
checkEqual(arbitraryTenantMismatch.result.status, 'denied', 'arbitrary tenant is denied');

const absentSelector = ToolGatewayService.invokeTool(
  ecosystemContext,
  getScheduleTool,
  { scheduleId: 'sch_2026_07_28' },
  { ...invocationContext, idempotencyKey: 'absent-tenant-selector' },
);
checkEqual(absentSelector.result.status, 'success', 'organization-scoped tool works without an organizationId input field');

for (const [label, organizationId] of [['empty', ''], ['non-string', 123]] as const) {
  const invalidSelector = ToolGatewayService.invokeTool(
    ecosystemContext,
    listSchedulesTool,
    { organizationId },
    { ...invocationContext, idempotencyKey: `invalid-${label}` },
  );
  checkEqual(invalidSelector.result.status, 'denied', `${label} organizationId is denied`);
  checkEqual(invalidSelector.auditEvent.eventType, 'policy_denied', `${label} organizationId emits policy_denied`);
}

const cachedMismatch = ToolGatewayService.invokeTool(
  ecosystemContext,
  listSchedulesTool,
  { organizationId: 'org_curitiba_02' },
  invocationContext,
);
checkEqual(cachedMismatch.result.status, 'denied', 'tenant mismatch cannot reuse an idempotent success');
checkEqual(cachedMismatch.auditEvent.eventType, 'policy_denied', 'tenant mismatch does not emit idempotency_reuse');
checkEqual(cachedMismatch.auditEvent.organizationId, 'org_londrina_01', 'denial audit remains bound to the effective tenant');
checkEqual(cachedMismatch.decision.reason.includes('diverge'), true, 'mismatch denial explains the tenant divergence');

console.log(`✅ Passed ${passed} / ${total} tests.`);
