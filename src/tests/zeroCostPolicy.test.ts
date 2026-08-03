import { evaluateZeroCostPolicy, DEMO_RESOURCE_CATALOG } from '../core/policies/zeroCost/zeroCostPolicy';
import assert from 'assert';

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

// 1. ZeroCostPolicy permite recurso gratuito abaixo da margem.
const t1 = evaluateZeroCostPolicy('freemium.service', { globalKillSwitch: false, resourceKillSwitches: {}, measuredUsages: { 'freemium.service': 50 } });
checkEqual(t1.status, 'allowed', 't1 status');

// 2. ZeroCostPolicy retorna near_limit na margem.
const t2 = evaluateZeroCostPolicy('freemium.service', { globalKillSwitch: false, resourceKillSwitches: {}, measuredUsages: { 'freemium.service': 90 } });
checkEqual(t2.status, 'near_limit', 't2 status');

// 3. ZeroCostPolicy pausa no limite.
const t3 = evaluateZeroCostPolicy('freemium.service', { globalKillSwitch: false, resourceKillSwitches: {}, measuredUsages: { 'freemium.service': 100 } });
checkEqual(t3.status, 'paused', 't3 status');

// 4. ZeroCostPolicy bloqueia paid, billing_required, unknown_cost e auto_upgrade.
const t4 = evaluateZeroCostPolicy('meta.whatsapp');
checkEqual(t4.status, 'blocked', 't4 status');
checkEqual(t4.reason, 'resource_requires_billing_or_paid', 't4 reason');

const t5 = evaluateZeroCostPolicy('google.gemini');
checkEqual(t5.status, 'blocked', 't5 status');

const t6 = evaluateZeroCostPolicy('external.pdf');
checkEqual(t6.status, 'blocked', 't6 status');

// 5. financialCostBrl é sempre literal 0.
checkEqual(t1.financialCostBrl, 0, 't1 cost');
checkEqual(t4.financialCostBrl, 0, 't4 cost');

// 6. kill switch global bloqueia tudo.
const t7 = evaluateZeroCostPolicy('musicscale.searchSongs', { globalKillSwitch: true, resourceKillSwitches: {}, measuredUsages: {} });
checkEqual(t7.status, 'blocked', 't7 status');
checkEqual(t7.reason, 'global_kill_switch_active', 't7 reason');

// 7. kill switch por recurso bloqueia somente o alvo.
const t8 = evaluateZeroCostPolicy('musicscale.searchSongs', { globalKillSwitch: false, resourceKillSwitches: { 'musicscale.searchSongs': true }, measuredUsages: {} });
checkEqual(t8.status, 'blocked', 't8 status');
checkEqual(t8.reason, 'resource_kill_switch_active', 't8 reason');

const t9 = evaluateZeroCostPolicy('musicscale.getSongChart', { globalKillSwitch: false, resourceKillSwitches: { 'musicscale.searchSongs': true }, measuredUsages: {} });
checkEqual(t9.status, 'allowed', 't9 status');

console.log(`✅ Passed ${passed} / ${total} tests.`);
