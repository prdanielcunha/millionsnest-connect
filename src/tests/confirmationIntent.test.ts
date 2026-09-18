import assert from 'node:assert/strict';
import { ToolGatewayService } from '../core/services/toolGateway';
import { createDemoConfirmationIntentFingerprint } from '../demo/confirmations/demoConfirmationIntent';
import { buildDemoToolInvocationContext, createDemoConfirmationEvidence, prepareDemoToolInvocation } from '../demo/confirmations/demoToolFlow';
import { mockEcosystemContext, mockTools } from '../demo/mockData';
import { DemoConfirmationEvidence, EffectiveEcosystemContext, ToolDefinition } from '../types';

let passed = 0;
let assertions = 0;
const eq = <T>(a: T, b: T, m: string) => { assertions++; assert.equal(a, b, m); };
const run = (name: string, fn: () => void) => { fn(); passed++; console.log(`✅ ${name}`); };

function context(): EffectiveEcosystemContext {
  return {
    mode: 'DEMO_MODE',
    user: { uid: 'user_123', name: 'Test User', systemRole: null, capabilities: [] },
    activeOrganization: { id: 'org_1', name: 'Org 1', slug: 'org-1', plan: 'free', isDemo: true },
    availableOrganizations: [],
    memberships: [{ id: 'mem_1', uid: 'user_123', organizationId: 'org_1', organizationName: 'Org 1', status: 'active', permissions: ['read', 'write'] }],
    appAccess: [{ appId: 'musicscale', access: true, capabilities: [] }],
  };
}

function tool(policy: 'simple' | 'explicit'): ToolDefinition {
  return {
    id: `tool_${policy}`, appId: 'musicscale', name: 'searchSongs', version: '1', title: 'Test', description: 'Test',
    inputSchema: {}, outputSchema: {}, requiredPermissions: [], organizationScoped: true, riskLevel: 'R2_REVERSIBLE_WRITE',
    confirmationPolicy: policy, readOnly: false, idempotencyPolicy: 'recommended', supportsPreview: false, supportsUndo: true,
    timeoutMs: 3000, auditEventType: 'test_event',
  };
}

run('canonical intent is stable', () => {
  const base = { actorUid: 'user_123', requestId: 'r', toolId: 't', organizationId: 'org_1', idempotencyKey: 'k' };
  const a = createDemoConfirmationIntentFingerprint({ ...base, args: { a: 1, n: { x: true, y: [1, 2] } } });
  const b = createDemoConfirmationIntentFingerprint({ ...base, args: { n: { y: [1, 2], x: true }, a: 1 } });
  const c = createDemoConfirmationIntentFingerprint({ ...base, args: { a: 2, n: { x: true, y: [1, 2] } } });
  eq(a, b, 'object key order is canonical');
  eq(a === c, false, 'different values differ');
});

run('explicit confirmation is strict', () => {
  const c = context(); const t = tool('explicit'); const input = { a: 10 };
  const p = prepareDemoToolInvocation(c, t, input, 'inapp', 'c1'); if (!p) throw new Error('pending');
  const simple = createDemoConfirmationEvidence(p, 'simple_click');
  const explicit = createDemoConfirmationEvidence(p, 'explicit_click');
  const inconsistent = { ...explicit, policy: 'simple' } as DemoConfirmationEvidence;
  eq(ToolGatewayService.invokeTool(c, t, input, buildDemoToolInvocationContext(p, c, simple)).result.status, 'needs_confirmation', 'simple method is insufficient');
  eq(ToolGatewayService.invokeTool(c, t, input, buildDemoToolInvocationContext(p, c, explicit)).result.status, 'success', 'explicit method succeeds');
  eq(ToolGatewayService.invokeTool(c, t, input, buildDemoToolInvocationContext(p, c, inconsistent)).result.status, 'needs_confirmation', 'policy must match');
});

run('confirmed input is stable', () => {
  ToolGatewayService.resetDemoState(); const c = context(); const t = tool('explicit');
  const input = { a: 1, n: { x: 2, y: 3 } }; const p = prepareDemoToolInvocation(c, t, input, 'inapp', 'c2'); if (!p) throw new Error('pending');
  const ctx = buildDemoToolInvocationContext(p, c, createDemoConfirmationEvidence(p, 'explicit_click'));
  const same = ToolGatewayService.invokeTool(c, t, { n: { y: 3, x: 2 }, a: 1 }, ctx);
  const different = ToolGatewayService.invokeTool(c, t, { a: 1, n: { x: 2, y: 4 } }, ctx);
  eq(same.result.status, 'success', 'same semantic input succeeds');
  eq(different.result.status, 'denied', 'different input is denied');
  eq(different.auditEvent.eventType, 'policy_denied', 'different input is audited as denied');
});

run('identical retry preserves idempotency', () => {
  ToolGatewayService.resetDemoState(); const c = context(); const t = tool('simple'); const input = { a: 4 };
  const p = prepareDemoToolInvocation(c, t, input, 'inapp', 'c3'); if (!p) throw new Error('pending');
  const ctx = buildDemoToolInvocationContext(p, c, createDemoConfirmationEvidence(p, 'simple_click'));
  const first = ToolGatewayService.invokeTool(c, t, input, ctx); const second = ToolGatewayService.invokeTool(c, t, input, ctx);
  const changedKey = ToolGatewayService.invokeTool(c, t, input, { ...ctx, idempotencyKey: `${ctx.idempotencyKey}_2` });
  eq(first.result.status, 'success', 'first execution succeeds');
  eq(second.auditEvent.eventType, 'idempotency_reuse', 'same retry reuses');
  eq(second.result.auditId, first.result.auditId, 'same retry preserves auditId');
  eq(changedKey.result.status, 'denied', 'different key is denied');
  eq(changedKey.auditEvent.eventType, 'policy_denied', 'different key does not reuse');
});

run('confirmation remains actor-bound', () => {
  const t = tool('simple'); const a = context(); const input = { a: 5 };
  const p = prepareDemoToolInvocation(a, t, input, 'inapp', 'c4'); if (!p) throw new Error('pending');
  const e = createDemoConfirmationEvidence(p, 'simple_click'); const b = context(); b.user.uid = 'user_456'; b.memberships[0].uid = 'user_456';
  const r = ToolGatewayService.invokeTool(b, t, input, buildDemoToolInvocationContext(p, b, e));
  eq(r.result.status, 'denied', 'other actor is denied');
  eq(r.auditEvent.eventType, 'policy_denied', 'other actor denial is audited');
});

run('catalogued R2 write follows the same contract', () => {
  ToolGatewayService.resetDemoState(); const t = mockTools.find(x => x.name === 'createScheduleDraft'); if (!t) throw new Error('tool');
  const input = { title: 'Culto Teste', date: '2026-09-01', serviceTime: '19:00' };
  const p = prepareDemoToolInvocation(mockEcosystemContext, t, input, 'inapp', 'c5'); if (!p) throw new Error('pending');
  const simple = ToolGatewayService.invokeTool(mockEcosystemContext, t, input, buildDemoToolInvocationContext(p, mockEcosystemContext, createDemoConfirmationEvidence(p, 'simple_click')));
  const explicitCtx = buildDemoToolInvocationContext(p, mockEcosystemContext, createDemoConfirmationEvidence(p, 'explicit_click'));
  const first = ToolGatewayService.invokeTool(mockEcosystemContext, t, input, explicitCtx);
  const changed = ToolGatewayService.invokeTool(mockEcosystemContext, t, { ...input, title: 'Outro Culto' }, explicitCtx);
  const retry = ToolGatewayService.invokeTool(mockEcosystemContext, t, input, explicitCtx);
  eq(simple.result.status, 'needs_confirmation', 'real write requires explicit method');
  eq(first.result.status, 'success', 'real write accepts matching confirmation');
  eq(changed.result.status, 'denied', 'real write rejects changed input');
  eq(retry.auditEvent.eventType, 'idempotency_reuse', 'real write retry reuses');
  eq(retry.result.auditId, first.result.auditId, 'real write preserves original auditId');
  eq(retry.auditEvent.originalExecutionAuditId, first.result.auditId, 'reuse references original execution');
});

console.log(`✅ Passed ${passed} / 6 tests. Assertions: ${assertions}`);
if (passed !== 6 || assertions !== 21) process.exit(1);
