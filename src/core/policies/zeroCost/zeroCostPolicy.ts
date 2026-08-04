import { ZeroCostPolicyDecision } from '../../../types';

export type CostClassification =
  | 'free'
  | 'paid'
  | 'billing_required'
  | 'unknown_cost'
  | 'auto_upgrade';

export interface ZeroCostResourcePolicy {
  resourceId: string;
  provider: string;
  enabled: boolean;
  billingAllowed: false;
  costClassification: CostClassification;
  freeLimit?: number;
  safetyMargin?: number;
}

export const DEMO_RESOURCE_CATALOG: ZeroCostResourcePolicy[] = [
  { resourceId: 'musicscale.searchSongs', provider: 'musicscale', enabled: true, billingAllowed: false, costClassification: 'free' },
  { resourceId: 'musicscale.getSongChart', provider: 'musicscale', enabled: true, billingAllowed: false, costClassification: 'free' },
  { resourceId: 'musicscale.getScheduleSongCharts', provider: 'musicscale', enabled: true, billingAllowed: false, costClassification: 'free' },
  { resourceId: 'musicscale.transposeSongChart', provider: 'musicscale', enabled: true, billingAllowed: false, costClassification: 'free' },
  { resourceId: 'musicscale.renderSongChartDocument', provider: 'musicscale', enabled: true, billingAllowed: false, costClassification: 'free' },
  { resourceId: 'musicscale.renderScheduleSongbook', provider: 'musicscale', enabled: true, billingAllowed: false, costClassification: 'free' },
  { resourceId: 'meta.whatsapp', provider: 'meta', enabled: true, billingAllowed: false, costClassification: 'paid' },
  { resourceId: 'google.gemini', provider: 'google', enabled: true, billingAllowed: false, costClassification: 'billing_required' },
  { resourceId: 'external.pdf', provider: 'external', enabled: true, billingAllowed: false, costClassification: 'unknown_cost' },
  { resourceId: 'freemium.service', provider: 'freemium', enabled: true, billingAllowed: false, costClassification: 'free', freeLimit: 100, safetyMargin: 10 },
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
    return { status: 'blocked', reason: 'resource_not_cataloged', resource: resourceId, financialCostBrl: 0, checkedAt: timestamp };
  }

  if (!config.enabled) {
    return { status: 'blocked', reason: 'resource_disabled', resource: resourceId, provider: config.provider, financialCostBrl: 0, checkedAt: timestamp };
  }

  if (config.costClassification !== 'free') {
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
