import { evaluateZeroCostPolicy, DEMO_RESOURCE_CATALOG } from '../core/policies/zeroCost/zeroCostPolicy';
import { mockTools } from '../demo/mockData';

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
console.log('--- Running Zero Cost Policy Tests ---');

const t1 = evaluateZeroCostPolicy('musicscale.searchSongs', { globalKillSwitch: false, resourceKillSwitches: {}, measuredUsages: { 'musicscale.searchSongs': 50 } });
checkEqual(t1.status, 'allowed', 't1 status');

const t2 = evaluateZeroCostPolicy('musicscale.searchSongs', { globalKillSwitch: false, resourceKillSwitches: {}, measuredUsages: { 'musicscale.searchSongs': 90 } });
checkEqual(t2.status, 'near_limit', 't2 status');

const t3 = evaluateZeroCostPolicy('musicscale.searchSongs', { globalKillSwitch: false, resourceKillSwitches: {}, measuredUsages: { 'musicscale.searchSongs': 100 } });
checkEqual(t3.status, 'paused', 't3 status');

const t4 = evaluateZeroCostPolicy('meta.whatsapp');
checkEqual(t4.status, 'blocked', 't4 status');
checkEqual(t4.reason, 'resource_requires_billing_or_paid', 't4 reason');

const t5 = evaluateZeroCostPolicy('google.gemini');
checkEqual(t5.status, 'blocked', 't5 status');
checkEqual(t5.reason, 'resource_requires_billing_or_paid', 't5 reason');

const t6 = evaluateZeroCostPolicy('external.pdf');
checkEqual(t6.status, 'blocked', 't6 status');

const t7 = evaluateZeroCostPolicy('unknown.tool');
checkEqual(t7.status, 'blocked', 't7 status');
checkEqual(t7.reason, 'resource_not_cataloged', 't7 reason');

checkEqual(t1.financialCostBrl, 0, 't1 cost');
checkEqual(t4.financialCostBrl, 0, 't4 cost');
checkEqual(t7.financialCostBrl, 0, 't7 cost');

const t8 = evaluateZeroCostPolicy('musicscale.searchSongs', { globalKillSwitch: true, resourceKillSwitches: {}, measuredUsages: {} });
checkEqual(t8.status, 'blocked', 't8 status');
checkEqual(t8.reason, 'global_kill_switch_active', 't8 reason');

const t9 = evaluateZeroCostPolicy('musicscale.searchSongs', { globalKillSwitch: false, resourceKillSwitches: { 'musicscale.searchSongs': true }, measuredUsages: {} });
checkEqual(t9.status, 'blocked', 't9 status');
checkEqual(t9.reason, 'resource_kill_switch_active', 't9 reason');

const t10 = evaluateZeroCostPolicy('musicscale.getSongChart', { globalKillSwitch: false, resourceKillSwitches: { 'musicscale.searchSongs': true }, measuredUsages: {} });
checkEqual(t10.status, 'allowed', 't10 status');

// Validate all mock tools are cataloged
for (const tool of mockTools) {
  const resourceId = `${tool.appId}.${tool.name}`;
  const isCataloged = DEMO_RESOURCE_CATALOG.some(c => c.resourceId === resourceId);
  checkEqual(isCataloged, true, `Tool ${resourceId} is cataloged`);
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
