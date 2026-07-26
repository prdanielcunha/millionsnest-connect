import assert from 'assert';
import { DemoPolicySimulator } from '../demo/policies/demoPolicySimulator';
import { EffectiveEcosystemContext, ToolDefinition } from '../types';
import { isGlobalGovernanceRole, isOperationalSupportRole, normalizeSystemRole } from '../core/roles/systemRoles';

// Test mock tools
const readTool: ToolDefinition = {
  id: 't1', appId: 'core', name: 'read', version: '1', title: 'Read', description: '',
  inputSchema: {}, outputSchema: {}, requiredPermissions: ['view'],
  organizationScoped: true, riskLevel: 'R1_AUTH_READ', confirmationPolicy: 'none',
  readOnly: true, idempotencyPolicy: 'recommended', supportsPreview: false, supportsUndo: false, timeoutMs: 1000, auditEventType: 'E'
};

const crossTenantTool: ToolDefinition = { ...readTool, organizationScoped: true };
const globalTool: ToolDefinition = { ...readTool, organizationScoped: false, requiredPermissions: ['livingLibrary.manage'], riskLevel: 'R3_PRIVILEGED', confirmationPolicy: 'human_approval' };
const r4Tool: ToolDefinition = { ...readTool, riskLevel: 'R4_CRITICAL', confirmationPolicy: 'human_approval', requiredPermissions: [] };


const createMockContext = (overrides: Partial<EffectiveEcosystemContext> = {}): EffectiveEcosystemContext => {
  return {
    mode: 'DEMO_MODE',
    user: { id: 'u1', name: 'User', globalCapabilities: [] },
    activeOrganization: { id: 'org1', name: 'Org 1', slug: 'org1', plan: 'pro', isCanonical: false },
    availableOrganizations: [],
    memberships: [
      { id: 'm1', userId: 'u1', organizationId: 'org1', organizationName: 'Org 1', role: 'admin', permissions: ['view'] }
    ],
    effectiveCapabilities: [],
    ...overrides
  };
};

async function runTests() {
  let passed = 0;
  let failed = 0;

  const test = (name: string, fn: () => void) => {
    try {
      fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ FAIL: ${name}`);
      console.error(e);
      failed++;
    }
  };

  console.log('--- Running Authority Model Tests ---');

  test('normalizeSystemRole correctly normalizes values', () => {
    assert.strictEqual(normalizeSystemRole('ceo'), 'ceo');
    assert.strictEqual(normalizeSystemRole('Global_Admin'), 'global_admin');
    assert.strictEqual(normalizeSystemRole(' Suporte '), 'support');
    assert.strictEqual(normalizeSystemRole('Support'), 'support');
    assert.strictEqual(normalizeSystemRole('invalid'), null);
  });

  test('isGlobalGovernanceRole identifies governance roles', () => {
    assert.strictEqual(isGlobalGovernanceRole('ceo'), true);
    assert.strictEqual(isGlobalGovernanceRole('ecosystem_owner'), true);
    assert.strictEqual(isGlobalGovernanceRole('founder'), true);
    assert.strictEqual(isGlobalGovernanceRole('support'), false);
    assert.strictEqual(isGlobalGovernanceRole('suporte'), false);
    assert.strictEqual(isGlobalGovernanceRole(null), false);
  });

  test('isOperationalSupportRole identifies support roles', () => {
    assert.strictEqual(isOperationalSupportRole('support'), true);
    assert.strictEqual(isOperationalSupportRole('suporte'), true);
    assert.strictEqual(isOperationalSupportRole('ceo'), false);
  });

  test('DemoPolicySimulator blocks cross-tenant access', () => {
    const ctx = createMockContext();
    const decision = DemoPolicySimulator.evaluateToolPermission(ctx, crossTenantTool, 'org2'); // Requesting org2 while active is org1
    assert.strictEqual(decision.allowed, false);
    assert.match(decision.reason, /Cross-Tenant/i);
  });

  test('DemoPolicySimulator allows valid same-tenant access', () => {
    const ctx = createMockContext();
    const decision = DemoPolicySimulator.evaluateToolPermission(ctx, crossTenantTool, 'org1');
    assert.strictEqual(decision.allowed, true);
  });

  test('DemoPolicySimulator requires explicit capability for global tools', () => {
    const ctx = createMockContext(); // Doesn't have livingLibrary.manage
    const decision = DemoPolicySimulator.evaluateToolPermission(ctx, globalTool, 'org1');
    assert.strictEqual(decision.allowed, false);
    assert.match(decision.reason, /livingLibrary\.manage/i);

    const ctxWithCap = createMockContext({ effectiveCapabilities: ['livingLibrary.manage'] });
    const decisionWithCap = DemoPolicySimulator.evaluateToolPermission(ctxWithCap, globalTool, 'org1');
    assert.strictEqual(decisionWithCap.allowed, true);
  });

  test('DemoPolicySimulator blocks R4 tools by default', () => {
    const ctx = createMockContext();
    const decision = DemoPolicySimulator.evaluateToolPermission(ctx, r4Tool, 'org1');
    assert.strictEqual(decision.allowed, false);
    assert.match(decision.reason, /R4/i);
  });

  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
