import { ToolGatewayService } from '../core/services/toolGateway';
import { mockEcosystemContext, mockTools } from '../demo/mockData';

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

// 7,8,9,10. resetDemoState
const oldMap = ToolGatewayService.zeroCostState.resourceKillSwitches;
ToolGatewayService.resetDemoState();
checkEqual(ToolGatewayService.zeroCostState.globalKillSwitch, false, 'reset globalKillSwitch');
checkEqual(Object.keys(ToolGatewayService.zeroCostState.resourceKillSwitches).length, 0, 'reset resourceKillSwitches');
checkEqual(Object.keys(ToolGatewayService.zeroCostState.measuredUsages).length, 0, 'reset measuredUsages');
checkEqual(ToolGatewayService.zeroCostState.resourceKillSwitches !== oldMap, true, 'new reference for resourceKillSwitches map');

console.log(`✅ Passed ${passed} / ${total} tests.`);
