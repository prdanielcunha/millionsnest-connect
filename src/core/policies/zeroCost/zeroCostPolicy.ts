import { ZeroCostPolicyDecision } from '../../../types';

export interface ResourceCostConfig {
  resourceId: string;
  provider: string;
  isPaid: boolean;
  billingRequired: boolean;
  unknownCost: boolean;
  autoUpgrade: boolean;
  freeLimit?: number;
  safetyMargin?: number;
}

export const DEMO_RESOURCE_CATALOG: ResourceCostConfig[] = [
  { resourceId: 'musicscale.searchSongs', provider: 'musicscale', isPaid: false, billingRequired: false, unknownCost: false, autoUpgrade: false },
  { resourceId: 'musicscale.getSongChart', provider: 'musicscale', isPaid: false, billingRequired: false, unknownCost: false, autoUpgrade: false },
  { resourceId: 'musicscale.getScheduleSongCharts', provider: 'musicscale', isPaid: false, billingRequired: false, unknownCost: false, autoUpgrade: false },
  { resourceId: 'musicscale.transposeSongChart', provider: 'musicscale', isPaid: false, billingRequired: false, unknownCost: false, autoUpgrade: false },
  { resourceId: 'musicscale.renderSongChartDocument', provider: 'musicscale', isPaid: false, billingRequired: false, unknownCost: false, autoUpgrade: false },
  { resourceId: 'musicscale.renderScheduleSongbook', provider: 'musicscale', isPaid: false, billingRequired: false, unknownCost: false, autoUpgrade: false },
  { resourceId: 'meta.whatsapp', provider: 'meta', isPaid: true, billingRequired: true, unknownCost: false, autoUpgrade: false },
  { resourceId: 'google.gemini', provider: 'google', isPaid: true, billingRequired: true, unknownCost: false, autoUpgrade: false },
  { resourceId: 'external.pdf', provider: 'external', isPaid: false, billingRequired: false, unknownCost: true, autoUpgrade: false },
  { resourceId: 'freemium.service', provider: 'freemium', isPaid: false, billingRequired: false, unknownCost: false, autoUpgrade: false, freeLimit: 100, safetyMargin: 10 },
];

export interface ZeroCostState {
  globalKillSwitch: boolean;
  resourceKillSwitches: Record<string, boolean>;
  measuredUsages: Record<string, number>;
}

export const defaultZeroCostState: ZeroCostState = {
  globalKillSwitch: false,
  resourceKillSwitches: {},
  measuredUsages: {},
};

export function evaluateZeroCostPolicy(
  resourceId: string,
  state: ZeroCostState = defaultZeroCostState
): ZeroCostPolicyDecision {
  const timestamp = new Date().toISOString();
  
  if (state.globalKillSwitch) {
    return { status: 'blocked', reason: 'global_kill_switch_active', financialCostBrl: 0, checkedAt: timestamp };
  }
  
  if (state.resourceKillSwitches[resourceId]) {
    return { status: 'blocked', reason: 'resource_kill_switch_active', resource: resourceId, financialCostBrl: 0, checkedAt: timestamp };
  }
  
  const config = DEMO_RESOURCE_CATALOG.find(c => c.resourceId === resourceId);
  if (!config) {
    return { status: 'allowed', reason: 'resource_not_in_catalog', resource: resourceId, financialCostBrl: 0, checkedAt: timestamp };
  }
  
  if (config.isPaid || config.billingRequired || config.unknownCost || config.autoUpgrade) {
    return { 
      status: 'blocked', 
      reason: 'resource_requires_billing_or_paid', 
      resource: resourceId, 
      provider: config.provider, 
      financialCostBrl: 0, 
      checkedAt: timestamp 
    };
  }
  
  if (config.freeLimit !== undefined) {
    const usage = state.measuredUsages[resourceId] || 0;
    const margin = config.safetyMargin || 0;
    
    if (usage >= config.freeLimit) {
      return { status: 'paused', reason: 'free_limit_reached', resource: resourceId, provider: config.provider, measuredUsage: usage, freeLimit: config.freeLimit, financialCostBrl: 0, checkedAt: timestamp };
    }
    
    if (usage >= config.freeLimit - margin) {
      return { status: 'near_limit', reason: 'approaching_free_limit', resource: resourceId, provider: config.provider, measuredUsage: usage, freeLimit: config.freeLimit, financialCostBrl: 0, checkedAt: timestamp };
    }
  }
  
  return { status: 'allowed', reason: 'zero_cost_policy_passed', resource: resourceId, provider: config.provider, financialCostBrl: 0, checkedAt: timestamp };
}
