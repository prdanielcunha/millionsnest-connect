import { ToolGatewayService } from '../core/services/toolGateway';
import { mockEcosystemContext, mockTools } from '../demo/mockData';
import { ToolDefinition } from '../types';

let passed = 0;
let total = 0;
function checkEqual(actual: any, expected: any, message: string) {
  total++;
  if (actual === expected) {
    passed++;
  } else {
    console.error(`❌ ${message} - Expected: ${expected}, Actual: ${actual}`);
    throw new Error(message);
  }
}
console.log('--- Running Tool Gateway Zero Cost Tests ---');

const searchTool = mockTools.find(t => t.name === 'searchSongs')!;
const idempotentSearchTool = { ...searchTool, requiredPermissions: [], idempotencyPolicy: 'recommended' } satisfies ToolDefinition;
const listSchedulesTool = { ...mockTools.find(t => t.name === 'listSchedules')!, requiredPermissions: [] as any };

const invocationContext = {
  requestId: 'req_123',
  correlationId: 'cor_123',
  actor: { uid: 'demo-user-001' },
  organization: { id: 'org_londrina_01' },
  appAccess: { appId: 'musicscale', capabilities: [] },
  channel: { type: 'whatsapp', conversationId: 'conv_1' },
  locale: 'pt-BR'
};

// 1. globalKillSwitch blocks
ToolGatewayService.zeroCostState = { globalKillSwitch: true, resourceKillSwitches: {}, measuredUsages: {} };
const r1 = ToolGatewayService.invokeTool(mockEcosystemContext, searchTool, {}, invocationContext);
checkEqual(r1.result.status, 'denied', 'global kill switch blocks tool execution');

// 2. searchSongs paused limit
ToolGatewayService.zeroCostState = { globalKillSwitch: false, resourceKillSwitches: {}, measuredUsages: { 'musicscale.searchSongs': 100 } };
const r2 = ToolGatewayService.invokeTool(mockEcosystemContext, searchTool, {}, invocationContext);
checkEqual(r2.result.status, 'denied', 'limit paused blocks tool execution');

// 3. listSchedules not blocked by catalog absence
ToolGatewayService.zeroCostState = { globalKillSwitch: false, resourceKillSwitches: {}, measuredUsages: {} };
const r3 = ToolGatewayService.invokeTool(mockEcosystemContext, listSchedulesTool, {}, invocationContext);
if (r3.result.status !== 'success') console.log("R3 FAILED. Result:", r3.result);
checkEqual(r3.result.status, 'success', 'listSchedules continues');

// 4. searchSongs at 90 does not return needs_confirmation
ToolGatewayService.zeroCostState = { globalKillSwitch: false, resourceKillSwitches: {}, measuredUsages: { 'musicscale.searchSongs': 90 } };
const r4 = ToolGatewayService.invokeTool(mockEcosystemContext, searchTool, {}, invocationContext);
checkEqual(r4.result.status !== 'needs_confirmation', true, 'near_limit does not ask confirmation');

// 5. searchSongs at 90 continues executing
checkEqual(r4.result.status, 'success', 'near_limit continues execution');

// 6. result of near_limit contains warning
checkEqual((r4.result.warnings || []).length > 0, true, 'near_limit adds warning');
checkEqual((r4.result.warnings || [])[0].includes('limite gratuito'), true, 'near_limit warning text');

// Idempotency reuse must remain behind the current Zero Cost Policy boundary
ToolGatewayService.resetDemoState();
const idempotentContext = { ...invocationContext, idempotencyKey: 'gateway-zc-reuse' };
const original = ToolGatewayService.invokeTool(mockEcosystemContext, idempotentSearchTool, { query: 'original' }, idempotentContext);
const normalReuse = ToolGatewayService.invokeTool(mockEcosystemContext, idempotentSearchTool, { query: 'original' }, idempotentContext);
checkEqual(original.result.status, 'success', 'original idempotent execution succeeds');
checkEqual(normalReuse.auditEvent.eventType, 'idempotency_reuse', 'normal reuse emits idempotency_reuse');
checkEqual(normalReuse.result.auditId, original.result.auditId, 'normal reuse preserves original auditId');

ToolGatewayService.zeroCostState.globalKillSwitch = true;
const globalBlockedReuse = ToolGatewayService.invokeTool(mockEcosystemContext, idempotentSearchTool, { query: 'original' }, idempotentContext);
checkEqual(globalBlockedReuse.result.status, 'denied', 'global kill switch blocks cached result');
checkEqual(globalBlockedReuse.auditEvent.eventType, 'policy_denied', 'global kill switch does not emit idempotency_reuse');

ToolGatewayService.zeroCostState.globalKillSwitch = false;
ToolGatewayService.zeroCostState.resourceKillSwitches['musicscale.searchSongs'] = true;
const resourceBlockedReuse = ToolGatewayService.invokeTool(mockEcosystemContext, idempotentSearchTool, { query: 'original' }, idempotentContext);
checkEqual(resourceBlockedReuse.result.status, 'denied', 'resource kill switch blocks cached result');
checkEqual(resourceBlockedReuse.auditEvent.eventType, 'policy_denied', 'resource kill switch does not emit idempotency_reuse');

ToolGatewayService.zeroCostState.resourceKillSwitches['musicscale.searchSongs'] = false;
const restoredReuse = ToolGatewayService.invokeTool(mockEcosystemContext, idempotentSearchTool, { query: 'original' }, idempotentContext);
checkEqual(restoredReuse.result.status, 'success', 'reuse succeeds after resource policy is restored');
checkEqual(restoredReuse.auditEvent.eventType, 'idempotency_reuse', 'restored policy reuses original execution');
checkEqual(restoredReuse.auditEvent.originalExecutionAuditId, original.result.auditId, 'restored reuse references original execution');
checkEqual(restoredReuse.result.auditId, original.result.auditId, 'restored reuse preserves original result auditId');
checkEqual(restoredReuse.result.data, original.result.data, 'restored reuse preserves original result entity');

ToolGatewayService.zeroCostState.measuredUsages['musicscale.searchSongs'] = 100;
const pausedReuse = ToolGatewayService.invokeTool(mockEcosystemContext, idempotentSearchTool, { query: 'original' }, idempotentContext);
checkEqual(pausedReuse.result.status, 'denied', 'paused free limit blocks cached result');
checkEqual(pausedReuse.auditEvent.eventType, 'policy_denied', 'paused free limit does not emit idempotency_reuse');

// 7,8,9,10. resetDemoState
const oldMap = ToolGatewayService.zeroCostState.resourceKillSwitches;
ToolGatewayService.resetDemoState();
checkEqual(ToolGatewayService.zeroCostState.globalKillSwitch, false, 'reset globalKillSwitch');
checkEqual(Object.keys(ToolGatewayService.zeroCostState.resourceKillSwitches).length, 0, 'reset resourceKillSwitches');
checkEqual(Object.keys(ToolGatewayService.zeroCostState.measuredUsages).length, 0, 'reset measuredUsages');
checkEqual(ToolGatewayService.zeroCostState.resourceKillSwitches !== oldMap, true, 'new reference for resourceKillSwitches map');

console.log(`✅ Passed ${passed} / ${total} tests.`);
