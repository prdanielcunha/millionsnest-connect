import { ToolDefinition, EffectiveEcosystemContext, RiskLevel } from '../../types';
import { PendingDemoToolInvocation } from '../../demo/confirmations/demoToolFlow';
import { isPlainUnknownRecord, validateOrganizationScopedArgs } from '../../core/validation/plainRecord';

export type ToolsAppFilter = 'all' | string;
export type ToolsRiskFilter = 'all' | RiskLevel;

export function filterTools(
  tools: ToolDefinition[],
  filters: { query: string; appId: ToolsAppFilter; risk: ToolsRiskFilter }
): ToolDefinition[] {
  return tools.filter((tool) => {
    if (filters.appId !== 'all' && tool.appId !== filters.appId) return false;
    if (filters.risk !== 'all' && tool.riskLevel !== filters.risk) return false;
    if (filters.query) {
      const q = filters.query.toLowerCase();
      if (!tool.name.toLowerCase().includes(q) &&
          !tool.title.toLowerCase().includes(q) &&
          !tool.appId.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });
}

export function selectToolById(
  tools: ToolDefinition[],
  selectedToolId: string | null
): ToolDefinition | null {
  if (!selectedToolId) return null;
  return tools.find((t) => t.id === selectedToolId) || null;
}

export const TOOLS_RISK_VALUES: readonly RiskLevel[] = ['R0_PUBLIC', 'R1_AUTH_READ', 'R2_REVERSIBLE_WRITE', 'R3_PRIVILEGED', 'R4_CRITICAL'];

export function isToolsRiskFilter(
  value: string
): value is ToolsRiskFilter {
  return (
    value === 'all' ||
    TOOLS_RISK_VALUES.some(
      (risk) => risk === value
    )
  );
}

export function haveSameRequiredPermissions(
  left: readonly string[],
  right: readonly string[]
): boolean {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  for (let i = 0; i < leftSorted.length; i++) {
    if (leftSorted[i] !== rightSorted[i]) return false;
  }
  return true;
}

export function validateToolsPendingContext(
  pendingTool: PendingDemoToolInvocation | null,
  selectedTool: ToolDefinition | null,
  activeOrganizationId: string
): boolean {
  if (!pendingTool) return false;
  if (!selectedTool) return false;
  if (pendingTool.tool.id !== selectedTool.id) return false;
  if (pendingTool.tool.appId !== selectedTool.appId) return false;
  if (pendingTool.tool.riskLevel !== selectedTool.riskLevel) return false;
  if (pendingTool.tool.confirmationPolicy !== selectedTool.confirmationPolicy) return false;
  if (pendingTool.tool.version !== selectedTool.version) return false;
  if (!haveSameRequiredPermissions(pendingTool.tool.requiredPermissions, selectedTool.requiredPermissions)) return false;
  
  if (pendingTool.organizationId !== activeOrganizationId) return false;
  if (pendingTool.conversationId !== `tools-lab:${activeOrganizationId}`) return false;
  
  if (!pendingTool.requestId) return false;
  if (!pendingTool.correlationId) return false;

  const args: unknown = pendingTool.args;
  if (!validateOrganizationScopedArgs(args, activeOrganizationId)) return false;

  return true;
}

export type DemoToolAvailability =
  | {
      kind: 'available';
      requiresConfirmation: boolean;
    }
  | {
      kind: 'blocked';
      reason:
        | 'missing_app_access'
        | 'human_approval'
        | 'strong_confirmation'
        | 'critical_risk'
        | 'missing_demo_input';
    };

export function describeDemoToolAvailability(
  tool: ToolDefinition,
  context: EffectiveEcosystemContext,
  hasInputFactory: boolean
): DemoToolAvailability {
  if (!hasInputFactory) {
    return { kind: 'blocked', reason: 'missing_demo_input' };
  }

  const access = context.appAccess.find((a) => a.appId === tool.appId);
  if (!access || !access.access) {
    return { kind: 'blocked', reason: 'missing_app_access' };
  }

  if (tool.riskLevel === 'R4_CRITICAL') {
    return { kind: 'blocked', reason: 'critical_risk' };
  }

  if (tool.confirmationPolicy === 'strong') {
    return { kind: 'blocked', reason: 'strong_confirmation' };
  }

  if (tool.confirmationPolicy === 'human_approval') {
    return { kind: 'blocked', reason: 'human_approval' };
  }

  const requiresConfirmation =
    tool.confirmationPolicy === 'explicit' || tool.confirmationPolicy === 'simple' || tool.riskLevel === 'R2_REVERSIBLE_WRITE' || tool.riskLevel === 'R3_PRIVILEGED';
    
  return {
    kind: 'available',
    requiresConfirmation
  };
}

export function isToolVisibleInFilteredSet(
  filteredTools: ToolDefinition[],
  selectedToolId: string | null
): boolean {
  if (!selectedToolId) return false;
  return filteredTools.some(t => t.id === selectedToolId);
}

export function countToolsByApp(
  tools: ToolDefinition[],
  appId: string
): number {
  return tools.filter(t => t.appId === appId).length;
}
