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

// We simulate invoking searchSongs when the free limit for searchSongs is reached.
ToolGatewayService.zeroCostState = {
  globalKillSwitch: false,
  resourceKillSwitches: {},
  measuredUsages: {
    'musicscale.searchSongs': 99999
  }
};

// Wait, searchSongs config does not have freeLimit by default in DEMO_RESOURCE_CATALOG.
// Let's test with 'freemium.service' (we would need a mock tool for it, let's just use global kill switch).
ToolGatewayService.zeroCostState = {
  globalKillSwitch: true,
  resourceKillSwitches: {},
  measuredUsages: {}
};

const searchTool = mockTools.find(t => t.name === 'searchSongs')!;
const invocationContext = {
  requestId: 'req_123',
  correlationId: 'cor_123',
  actor: { uid: 'demo-user-001' },
  organization: { id: 'org_londrina_01' },
  appAccess: { appId: 'musicscale', capabilities: [] },
  channel: { type: 'whatsapp', conversationId: 'conv_1' },
  locale: 'pt-BR'
};

const result = ToolGatewayService.invokeTool(mockEcosystemContext, searchTool, {}, invocationContext);

checkEqual(result.decision.status, 'allowed', 'permissions allow'); // permissions logic didn't change
checkEqual(result.result.status, 'denied', 'zero cost blocks');
checkEqual(result.result.humanSummary.includes('global_kill_switch_active'), true, 'reason global_kill_switch_active');

console.log(`✅ Passed ${passed} / ${total} tests.`);
