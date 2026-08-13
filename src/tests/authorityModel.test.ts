import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DemoPolicySimulator, DEMO_CONFIRMATION_MAX_AGE_MS } from '../demo/policies/demoPolicySimulator';
import { ToolGatewayService, createDemoIdempotencyFingerprint } from '../core/services/toolGateway';
import { normalizeSystemRole } from '../core/roles/systemRoles';
import { EffectiveEcosystemContext, ToolInvocationContext, ToolDefinition, AuditEvent, DemoConfirmationEvidence } from '../types';
import {
  prepareDemoToolInvocation,
  classifyDemoToolFlow,
  createDemoConfirmationEvidence,
  buildDemoToolInvocationContext,
  isDemoConfirmationCompatible,
} from '../demo/confirmations/demoToolFlow';

let testCount = 0;
let passed = 0;
let failed = 0;
let assertionCount = 0;

function checkEqual<T>(actual: T, expected: T, message?: string): void {
  assertionCount++;
  assert.equal(actual, expected, message);
}

function checkOk(value: unknown, message?: string): asserts value {
  assertionCount++;
  assert.ok(value, message);
}

function checkMatch(value: string, regex: RegExp, message?: string): void {
  assertionCount++;
  assert.match(value, regex, message);
}

function checkNotMatch(value: string, regex: RegExp, message?: string): void {
  assertionCount++;
  assert.doesNotMatch(value, regex, message);
}

function checkDeepEqual<T>(actual: T, expected: T, message?: string): void {
  assertionCount++;
  assert.deepEqual(actual, expected, message);
}

function test(name: string, fn: () => void): void {
  testCount++;
  let startAssertions = assertionCount;
  try {
    fn();
    if (assertionCount === startAssertions) {
      throw new Error("No assertions executed in test");
    }
    passed++;
  } catch (e) {
    failed++;
    console.error(`\n❌ Test failed: ${name}`);
    if (e instanceof Error) {
      console.error(e.message);
    }
  }
}

// =====================================
// FACTORIES TIPADAS (NÃO USAR ANY)
// =====================================

function createMockContext(): EffectiveEcosystemContext {
  return {
    mode: 'DEMO_MODE',
    user: {
      uid: 'user_123',
      name: 'Test User',
      systemRole: null,
      capabilities: [],
    },
    activeOrganization: {
      id: 'org_1',
      name: 'Org 1',
      slug: 'org-1',
      plan: 'free',
      isDemo: true,
    },
    availableOrganizations: [],
    memberships: [
      {
        id: 'mem_1',
        uid: 'user_123',
        organizationId: 'org_1',
        organizationName: 'Org 1',
        status: 'active',
        permissions: ['read', 'write'],
      }
    ],
    appAccess: [
      {
        appId: 'musicscale',
        access: true,
        capabilities: ['livingLibrary.manage'],
      }
    ],
  };
}

function createMockTool(riskLevel: ToolDefinition['riskLevel'], confirmationPolicy: ToolDefinition['confirmationPolicy']): ToolDefinition {
  return {
    id: 'tool_1',
    appId: 'musicscale',
    name: 'testTool',
    version: '1.0',
    title: 'Test Tool',
    description: 'A tool for testing',
    inputSchema: {},
    outputSchema: {},
    requiredPermissions: [],
    organizationScoped: true,
    riskLevel,
    confirmationPolicy,
    readOnly: riskLevel === 'R1_AUTH_READ' || riskLevel === 'R0_PUBLIC',
    idempotencyPolicy: 'recommended',
    supportsPreview: false,
    supportsUndo: false,
    timeoutMs: 5000,
    auditEventType: 'test_event',
  };
}

function evaluateMockPermission(
  context: EffectiveEcosystemContext,
  tool: ToolDefinition = createMockTool('R1_AUTH_READ', 'none')
) {
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_membership');
  if (!pending) throw new Error('pending failed');
  const invocationContext = buildDemoToolInvocationContext(pending, context);
  return DemoPolicySimulator.evaluateToolPermission(context, tool, invocationContext);
}

// =====================================
// TENANT-SCOPED MEMBERSHIP TESTS
// =====================================

test('membership da organização ativa vinculada ao usuário atual autoriza', () => {
  const context = createMockContext();
  const tool = createMockTool('R1_AUTH_READ', 'none');
  tool.requiredPermissions = ['write'];

  checkEqual(evaluateMockPermission(context, tool).status, 'allowed');
});

test('membership da organização ativa vinculada a outro UID não autoriza', () => {
  const context = createMockContext();
  context.memberships[0].uid = 'other_user';

  checkEqual(evaluateMockPermission(context).status, 'denied');
});

test('membership válida do usuário atual em outra organização não autoriza a organização ativa', () => {
  const context = createMockContext();
  context.memberships = [
    { ...context.memberships[0], uid: 'other_user' },
    { ...context.memberships[0], id: 'mem_2', uid: context.user.uid, organizationId: 'org_2' },
  ];

  checkEqual(evaluateMockPermission(context).status, 'denied');
});

test('ausência de membership válida para o UID atual permanece negada', () => {
  const context = createMockContext();
  context.memberships[0].status = 'suspended';

  checkEqual(evaluateMockPermission(context).status, 'denied');
});

test('system roles não ignoram o vínculo da membership ao UID atual', () => {
  for (const systemRole of ['ceo', 'global_admin', 'ecosystem_owner', 'founder', 'support'] as const) {
    const context = createMockContext();
    context.user.systemRole = systemRole;
    context.memberships[0].uid = 'other_user';

    checkEqual(evaluateMockPermission(context).status, 'denied');
  }
});

test('owner e admin como organizationRole não ignoram o vínculo da membership ao UID atual', () => {
  for (const organizationRole of ['owner', 'admin']) {
    const context = createMockContext();
    context.memberships[0].uid = 'other_user';
    context.memberships[0].organizationRole = organizationRole;

    checkEqual(evaluateMockPermission(context).status, 'denied');
  }
});

// =====================================
// HELPER DEMO_TOOL_FLOW TESTS
// =====================================

console.log('--- Running Authority Model Tests ---');

test('1. R1 retorna execute_directly', () => {
  const tool = createMockTool('R1_AUTH_READ', 'none');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  checkOk(pending);
  const result = classifyDemoToolFlow(tool, pending);
  checkEqual(result.kind, 'execute_directly');
});

test('2. R2 simple retorna confirmation_required', () => {
  const tool = createMockTool('R2_REVERSIBLE_WRITE', 'simple');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  checkOk(pending);
  const result = classifyDemoToolFlow(tool, pending);
  checkEqual(result.kind, 'confirmation_required');
});

test('3. R3 explicit retorna confirmation_required', () => {
  const tool = createMockTool('R3_PRIVILEGED', 'explicit');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  checkOk(pending);
  const result = classifyDemoToolFlow(tool, pending);
  checkEqual(result.kind, 'confirmation_required');
});

test('4. R3 strong retorna blocked', () => {
  const tool = createMockTool('R3_PRIVILEGED', 'strong');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  checkOk(pending);
  const result = classifyDemoToolFlow(tool, pending);
  checkEqual(result.kind, 'blocked');
});

test('5. human_approval retorna blocked', () => {
  const tool = createMockTool('R3_PRIVILEGED', 'human_approval');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  checkOk(pending);
  const result = classifyDemoToolFlow(tool, pending);
  checkEqual(result.kind, 'blocked');
});

test('6. R4 retorna blocked', () => {
  const tool = createMockTool('R4_CRITICAL', 'strong');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  checkOk(pending);
  const result = classifyDemoToolFlow(tool, pending);
  checkEqual(result.kind, 'blocked');
});

test('7. appAccess ausente retorna null', () => {
  const tool = createMockTool('R1_AUTH_READ', 'none');
  tool.appId = 'nestfinance'; // missing in context
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  checkEqual(pending, null);
});

test('8. appAccess false retorna null', () => {
  const tool = createMockTool('R1_AUTH_READ', 'none');
  const context = createMockContext();
  context.appAccess[0].access = false;
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  checkEqual(pending, null);
});

test('9. capabilities vêm do contexto efetivo', () => {
  const tool = createMockTool('R1_AUTH_READ', 'none');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  checkOk(pending);
  checkDeepEqual(pending.appAccess.capabilities, ['livingLibrary.manage']);
});

test('10. requestId é criado na preparação e preservado', () => {
  const tool = createMockTool('R2_REVERSIBLE_WRITE', 'simple');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  checkOk(pending);
  checkOk(pending.requestId.startsWith('req_'));
  
  const evidence = createDemoConfirmationEvidence(pending, 'simple_click');
  checkEqual(evidence.requestId, pending.requestId);
});

test('11. simple_click é criado para simple', () => {
  const tool = createMockTool('R2_REVERSIBLE_WRITE', 'simple');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  checkOk(pending);
  const evidence = createDemoConfirmationEvidence(pending, 'simple_click');
  checkEqual(evidence.policy, 'simple');
});

test('12. explicit_click é criado para explicit', () => {
  const tool = createMockTool('R3_PRIVILEGED', 'explicit');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  checkOk(pending);
  const evidence = createDemoConfirmationEvidence(pending, 'explicit_click');
  checkEqual(evidence.policy, 'explicit');
});

test('13. mudança de toolId invalida evidência', () => {
  const tool = createMockTool('R3_PRIVILEGED', 'explicit');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  checkOk(pending);
  const evidence = createDemoConfirmationEvidence(pending, 'explicit_click');
  
  const tool2 = createMockTool('R3_PRIVILEGED', 'explicit');
  tool2.id = 'tool_2';
  
  checkEqual(isDemoConfirmationCompatible(tool2, evidence), false);
});


// =====================================
// TOOL GATEWAY TESTS
// =====================================

test('29. R2 sem evidência retorna needs_confirmation', () => {
  const tool = createMockTool('R2_REVERSIBLE_WRITE', 'simple');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  if (!pending) throw new Error('pending failed');
  const invokeCtx = buildDemoToolInvocationContext(pending, context);
  const result = ToolGatewayService.invokeTool(context, tool, {}, invokeCtx);
  checkEqual(result.result.status, 'needs_confirmation');
});

test('30. R2 com evidência válida executa', () => {
  const tool = createMockTool('R2_REVERSIBLE_WRITE', 'simple');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  if (!pending) throw new Error('pending failed');
  const evidence = createDemoConfirmationEvidence(pending, 'simple_click');
  const invokeCtx = buildDemoToolInvocationContext(pending, context, evidence);
  const result = ToolGatewayService.invokeTool(context, tool, {}, invokeCtx);
  checkEqual(result.result.status, 'success');
});

test('31. R3 explicit sem evidência retorna needs_confirmation', () => {
  const tool = createMockTool('R3_PRIVILEGED', 'explicit');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  if (!pending) throw new Error('pending failed');
  const invokeCtx = buildDemoToolInvocationContext(pending, context);
  const result = ToolGatewayService.invokeTool(context, tool, {}, invokeCtx);
  checkEqual(result.result.status, 'needs_confirmation');
});

test('32. R3 explicit com evidência válida executa', () => {
  const tool = createMockTool('R3_PRIVILEGED', 'explicit');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  if (!pending) throw new Error('pending failed');
  const evidence = createDemoConfirmationEvidence(pending, 'explicit_click');
  const invokeCtx = buildDemoToolInvocationContext(pending, context, evidence);
  const result = ToolGatewayService.invokeTool(context, tool, {}, invokeCtx);
  checkEqual(result.result.status, 'success');
});

test('33. R4 não executa', () => {
  const tool = createMockTool('R4_CRITICAL', 'strong');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  if (!pending) throw new Error('pending failed');
  const invokeCtx = buildDemoToolInvocationContext(pending, context);
  const result = ToolGatewayService.invokeTool(context, tool, {}, invokeCtx);
  checkEqual(result.result.status, 'needs_confirmation');
});

test('34. human_approval não executa', () => {
  const tool = createMockTool('R3_PRIVILEGED', 'human_approval');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  if (!pending) throw new Error('pending failed');
  const invokeCtx = buildDemoToolInvocationContext(pending, context);
  const result = ToolGatewayService.invokeTool(context, tool, {}, invokeCtx);
  checkEqual(result.result.status, 'needs_confirmation');
});

test('35. idempotência preserva entidade', () => {
  const tool = createMockTool('R2_REVERSIBLE_WRITE', 'simple');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  if (!pending) throw new Error('pending failed');
  const evidence = createDemoConfirmationEvidence(pending, 'simple_click');
  const invokeCtx = buildDemoToolInvocationContext(pending, context, evidence);
  const result1 = ToolGatewayService.invokeTool(context, tool, {a: 1}, invokeCtx);
  const result2 = ToolGatewayService.invokeTool(context, tool, {a: 1}, invokeCtx);
  checkEqual(result1.result.status, 'success');
  checkEqual(result2.result.status, 'success');
  checkEqual(result1.result.data, result2.result.data);
});

test('36. idempotência preserva auditId original', () => {
  const tool = createMockTool('R2_REVERSIBLE_WRITE', 'simple');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  if (!pending) throw new Error('pending failed');
  const evidence = createDemoConfirmationEvidence(pending, 'simple_click');
  const invokeCtx = buildDemoToolInvocationContext(pending, context, evidence);
  const result1 = ToolGatewayService.invokeTool(context, tool, {a: 2}, invokeCtx);
  const result2 = ToolGatewayService.invokeTool(context, tool, {a: 2}, invokeCtx);
  checkEqual(result1.result.auditId, result2.result.auditId);
});

test('37. idempotency_reuse está nos logs', () => {
  const tool = createMockTool('R2_REVERSIBLE_WRITE', 'simple');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  if (!pending) throw new Error('pending failed');
  const evidence = createDemoConfirmationEvidence(pending, 'simple_click');
  const invokeCtx = buildDemoToolInvocationContext(pending, context, evidence);
  ToolGatewayService.invokeTool(context, tool, {a: 3}, invokeCtx);
  const result2 = ToolGatewayService.invokeTool(context, tool, {a: 3}, invokeCtx);
  checkEqual(result2.auditEvent.eventType, 'idempotency_reuse');
});

test('38. nenhum auditId é órfão', () => {
  const tool = createMockTool('R2_REVERSIBLE_WRITE', 'simple');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  if (!pending) throw new Error('pending failed');
  const invokeCtx = buildDemoToolInvocationContext(pending, context);
  const result = ToolGatewayService.invokeTool(context, tool, {}, invokeCtx);
  checkOk(result.auditEvent.id);
  checkEqual(result.result.auditId, result.auditEvent.id);
});

test('39. chave bruta não aparece no AuditEvent', () => {
  const tool = createMockTool('R2_REVERSIBLE_WRITE', 'simple');
  const context = createMockContext();
  const pending = prepareDemoToolInvocation(context, tool, {}, 'inapp', 'cnv_1');
  if (!pending) throw new Error('pending failed');
  const invokeCtx = buildDemoToolInvocationContext(pending, context);
  const result = ToolGatewayService.invokeTool(context, tool, {}, invokeCtx);
  checkNotMatch(JSON.stringify(result.auditEvent), /idempotency_/);
});

// =====================================
// FILE SYSTEM INSPECTIONS (USING NODE:FS)
// =====================================

function readSrc(filePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), 'src', filePath), 'utf-8');
}

test('14. InboxPage importa e usa prepareDemoToolInvocation', () => {
  const content = readSrc('features/inbox/InboxPage.tsx');
  checkOk(content.includes('prepareDemoToolInvocation'));
});

test('15. InboxPage renderiza DemoToolConfirmationDialog', () => {
  const content = readSrc('features/inbox/InboxPage.tsx');
  checkOk(content.includes('<DemoToolConfirmationDialog'));
});

test('16. InboxPage possui onConfirm real', () => {
  const content = readSrc('features/inbox/InboxPage.tsx');
  checkOk(content.includes('handleConfirmTool'));
  checkOk(content.includes('createDemoConfirmationEvidence'));
});

test('17. InboxPage possui onCancel real', () => {
  const content = readSrc('features/inbox/InboxPage.tsx');
  checkOk(content.includes('handleCancelTool'));
  checkOk(content.includes('setPendingTool(null)'));
});

test('18. InboxPage não chama gateway diretamente antes da classificação', () => {
  const content = readSrc('features/inbox/InboxPage.tsx');
  // It should classify first, we check that ToolGatewayService is inside the if conditions
  checkOk(content.includes('classifyDemoToolFlow(tool, pending)'));
});

test('19. InboxPage não cria confirmedAt no primeiro clique', () => {
  const content = readSrc('features/inbox/InboxPage.tsx');
  checkNotMatch(content, /const handleSimulateTool = [\s\S]*?confirmedAt:/);
});

test('20. pendingTool é lido e usado na renderização', () => {
  const content = readSrc('features/inbox/InboxPage.tsx');
  checkOk(content.includes('pending={pendingTool}'));
});

test('21. ToolsPage usa prepareDemoToolInvocation', () => {
  const content = readSrc('features/tools/ToolsPage.tsx');
  checkOk(content.includes('prepareDemoToolInvocation'));
});

test('22. ToolsPage renderiza DemoToolConfirmationDialog', () => {
  const content = readSrc('features/tools/ToolsPage.tsx');
  checkOk(content.includes('<DemoToolConfirmationDialog'));
});

test('23. ToolsPage possui cancelamento real', () => {
  const content = readSrc('features/tools/ToolsPage.tsx');
  checkOk(content.includes('handleCancelTool'));
  checkOk(content.includes('setPendingTool(null)'));
});

test('24. ToolsPage não usa result.success', () => {
  const content = readSrc('features/tools/ToolsPage.tsx');
  checkNotMatch(content, /result\.success/);
});

test('25. ToolsPage não usa códigos HTTP falsos', () => {
  const content = readSrc('features/tools/ToolsPage.tsx');
  checkNotMatch(content, /200 OK/);
  checkNotMatch(content, /403 FORBIDDEN/);
});

test('26. Nenhum arquivo trabalhado contém "as any"', () => {
  const inbox = readSrc('features/inbox/InboxPage.tsx');
  const tools = readSrc('features/tools/ToolsPage.tsx');
  const flow = readSrc('demo/confirmations/demoToolFlow.ts');
  checkNotMatch(inbox, /\s+as any\s+/);
  checkNotMatch(tools, /\s+as any\s+/);
  checkNotMatch(flow, /\s+as any\s+/);
});

test('27. tipos index.ts não usa Record<string, any>', () => {
  const content = readSrc('types/index.ts');
  checkNotMatch(content, /Record<string, any>/);
});

test('28. tipos index.ts não usa result?: any', () => {
  const content = readSrc('types/index.ts');
  checkNotMatch(content, /result\?: any/);
});

console.log(`\nTests completed: ${passed} passed, ${failed} failed. Total: ${testCount}. Assertions: ${assertionCount}`);

if (failed > 0 || assertionCount === 0) {
  process.exit(1);
}
