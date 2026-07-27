import { ToolDefinition, EffectiveEcosystemContext, DemoConfirmationEvidence, DemoConfirmationMethod } from '../../types';

export type PendingDemoToolInvocation = {
  tool: ToolDefinition;
  args: Record<string, unknown>;
  requestId: string;
  correlationId: string;
  idempotencyKey?: string;
  organizationId: string;
  conversationId: string;
  channelType: string;
  appAccess: {
    appId: string;
    capabilities: string[];
  };
};

export type DemoToolFlowResolution =
  | {
      kind: 'execute_directly';
      pending: PendingDemoToolInvocation;
    }
  | {
      kind: 'confirmation_required';
      pending: PendingDemoToolInvocation;
    }
  | {
      kind: 'blocked';
      reason: string;
      pending: PendingDemoToolInvocation;
    };

export function resolveEffectiveDemoAppAccess(context: EffectiveEcosystemContext, tool: ToolDefinition) {
  const effectiveAppAccess = context.appAccess.find((a) => a.appId === tool.appId);
  return effectiveAppAccess;
}

export function prepareDemoToolInvocation(
  context: EffectiveEcosystemContext,
  tool: ToolDefinition,
  args: Record<string, unknown>,
  channelType: string,
  conversationId: string
): PendingDemoToolInvocation | null {
  const effectiveAppAccess = resolveEffectiveDemoAppAccess(context, tool);

  if (!effectiveAppAccess || !effectiveAppAccess.access) {
    return null;
  }

  return {
    tool,
    args,
    requestId: `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    correlationId: `corr_${Date.now()}`,
    idempotencyKey: `idempotency_${Date.now()}`,
    organizationId: context.activeOrganization.id,
    conversationId,
    channelType,
    appAccess: {
      appId: effectiveAppAccess.appId,
      capabilities: [...effectiveAppAccess.capabilities],
    },
  };
}

export function classifyDemoToolFlow(tool: ToolDefinition, pending: PendingDemoToolInvocation): DemoToolFlowResolution {
  if (tool.riskLevel === 'R0_PUBLIC' || tool.riskLevel === 'R1_AUTH_READ') {
    return { kind: 'execute_directly', pending };
  }

  if (tool.confirmationPolicy === 'simple' || tool.confirmationPolicy === 'explicit') {
    return { kind: 'confirmation_required', pending };
  }

  if (tool.confirmationPolicy === 'strong' || tool.confirmationPolicy === 'human_approval' || tool.riskLevel === 'R4_CRITICAL') {
    return { kind: 'blocked', reason: 'Ação crítica bloqueada no ambiente de simulação.', pending };
  }
  
  return { kind: 'blocked', reason: 'Política de confirmação desconhecida.', pending };
}

export function createDemoConfirmationEvidence(
  pending: PendingDemoToolInvocation,
  method: DemoConfirmationMethod,
  now?: Date
): DemoConfirmationEvidence {
  const policy = pending.tool.confirmationPolicy === 'explicit' ? 'explicit' : 'simple';
  return {
    confirmationId: `conf_${Date.now()}`,
    requestId: pending.requestId,
    toolId: pending.tool.id,
    organizationId: pending.organizationId,
    policy,
    method,
    confirmedAt: (now || new Date()).toISOString(),
  };
}

export function buildDemoToolInvocationContext(pending: PendingDemoToolInvocation, context: EffectiveEcosystemContext, evidence?: DemoConfirmationEvidence) {
  return {
    requestId: pending.requestId,
    correlationId: pending.correlationId,
    idempotencyKey: pending.idempotencyKey,
    actor: {
      uid: context.user.uid,
      systemRole: context.user.systemRole,
    },
    organization: {
      id: pending.organizationId,
      role: context.activeOrganization.id === pending.organizationId ? context.memberships.find((m) => m.organizationId === context.activeOrganization.id)?.organizationRole : undefined,
    },
    appAccess: pending.appAccess,
    channel: {
      type: pending.channelType,
      conversationId: pending.conversationId,
    },
    locale: 'pt-BR',
    demoConfirmation: evidence,
  };
}

export function isDemoConfirmationCompatible(tool: ToolDefinition, evidence: DemoConfirmationEvidence) {
  if (evidence.toolId !== tool.id) return false;
  if (tool.confirmationPolicy === 'explicit' && evidence.method !== 'explicit_click') return false;
  if (tool.confirmationPolicy === 'strong' || tool.confirmationPolicy === 'human_approval') return false;
  return true;
}
