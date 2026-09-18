/**
 * MillionsNest Connect - Demo Policy Simulator
 * IMPORTANT: This is NOT a canonical authority. This is a local simulation for DEMO_MODE.
 * The future real authorization will be evaluated strictly server-side by MillionsNest and the Tool Gateway.
 */

import {
  EffectiveEcosystemContext,
  ToolDefinition,
  DemoPolicyDecision,
  ToolInvocationContext,
} from '../../types';
import { normalizeSystemRole } from '../../core/roles/systemRoles';

// Constant for confirmation max age in DEMO_MODE (5 minutes)
export const DEMO_CONFIRMATION_MAX_AGE_MS = 5 * 60 * 1000;

export function validateDemoConfirmationTime(
  confirmedAt: string,
  now: Date = new Date()
): { valid: boolean; reason?: string } {
  const time = Date.parse(confirmedAt);
  if (isNaN(time)) {
    return { valid: false, reason: 'Timestamp de confirmação inválido ou inparseável.' };
  }
  const diff = now.getTime() - time;
  if (diff < 0) {
    return { valid: false, reason: 'Timestamp de confirmação no futuro não é permitido.' };
  }
  if (diff > DEMO_CONFIRMATION_MAX_AGE_MS) {
    return { valid: false, reason: 'Confirmação expirada.' };
  }
  return { valid: true };
}

export class DemoPolicySimulator {
  static evaluateToolPermission(
    context: EffectiveEcosystemContext,
    tool: ToolDefinition,
    invocationContext: ToolInvocationContext,
    now: Date = new Date()
  ): DemoPolicyDecision {
    const timestamp = now.toISOString();

    const deny = (reason: string): DemoPolicyDecision => ({
      status: 'denied',
      reason,
      checkedAt: timestamp,
      simulated: true,
    });

    const needsConfirmation = (reason: string): DemoPolicyDecision => ({
      status: 'needs_confirmation',
      reason,
      checkedAt: timestamp,
      simulated: true,
      confirmationPolicy: tool.confirmationPolicy,
    });

    const allow = (reason: string): DemoPolicyDecision => ({
      status: 'allowed',
      reason,
      checkedAt: timestamp,
      simulated: true,
    });

    // 1. Verify DEMO_MODE
    if (context.mode !== 'DEMO_MODE') {
      return deny('O simulador só opera em DEMO_MODE.');
    }

    // 2. Verify actor match
    if (invocationContext.actor.uid !== context.user.uid) {
      return deny('Ator da invocação não corresponde ao usuário demonstrativo.');
    }

    const contextRole = normalizeSystemRole(context.user.systemRole);
    const actorRole = normalizeSystemRole(invocationContext.actor.systemRole);
    
    if (actorRole && contextRole && actorRole !== contextRole) {
      return deny('Divergência entre papel do ator na invocação e no contexto efetivo.');
    }

    // 4. Resolve appAccess
    const appAccess = context.appAccess.find((a) => a.appId === tool.appId);

    // 5. Deny if appAccess not found
    if (!appAccess) {
      return deny(`Acesso ao aplicativo ${tool.appId} não encontrado no contexto.`);
    }

    // 6. Deny if appAccess is false
    if (!appAccess.access) {
      return deny(`Acesso ao aplicativo ${tool.appId} está desabilitado.`);
    }
    
    if (invocationContext.appAccess.appId !== tool.appId) {
      return deny('O appId da invocação diverge do appId da ferramenta.');
    }
    
    // Check if invocation capabilities exceed effective context (simulate client not having authority)
    const hasInvalidCapability = invocationContext.appAccess.capabilities.some(cap => !appAccess.capabilities.includes(cap));
    if (hasInvalidCapability) {
      return deny('A invocação declarou capability ausente no contexto efetivo.');
    }

    // 7. Evaluate organizationScoped
    let activeMembership = null;
    if (tool.organizationScoped) {
      if (!context.activeOrganization) {
        return deny('Organização ativa não definida no contexto local.');
      }
      
      const requestedOrg = invocationContext.organization.id;
      if (requestedOrg !== context.activeOrganization.id) {
        return deny(`Bloqueio Cross-Tenant (SIMULAÇÃO): Token pertence à organização "${context.activeOrganization.id}", mas a requisição solicitou "${requestedOrg}".`);
      }

      activeMembership = context.memberships.find(
        (m) =>
          m.organizationId === context.activeOrganization.id &&
          m.uid === context.user.uid
      );

      if (!activeMembership) {
        return deny('Membership inexistente para a organização solicitada.');
      }

      if (activeMembership.status !== 'active') {
        return deny(`Membership inválida (status: ${activeMembership.status}). Acesso negado.`);
      }
    }

    // 8. Validate requiredPermissions (tenant-scoped)
    if (tool.organizationScoped && tool.requiredPermissions.length > 0) {
       const hasPermissions = tool.requiredPermissions.every((perm) =>
          activeMembership?.permissions.includes(perm)
       );
       
       if (!hasPermissions) {
          return deny(`Falta de permissão local: Requer [${tool.requiredPermissions.join(', ')}]. Owner/Admin/Support não possuem bypass.`);
       }
    }

    // 9. Validate appAccess capabilities when required
    if (!tool.organizationScoped && tool.requiredPermissions.length > 0) {
      const requiresLivingLibrary = tool.requiredPermissions.includes('livingLibrary.manage') || tool.name === 'addSongToLivingLibrary';
      
      if (requiresLivingLibrary) {
        const hasCap = appAccess.capabilities.includes('livingLibrary.manage');
        if (!hasCap) {
          return deny('Bloqueio de privilégio: A capability "livingLibrary.manage" é estritamente necessária no appAccess efetivo e não está presente.');
        }
      } else {
        const hasPermissions = tool.requiredPermissions.every((perm) =>
          appAccess.capabilities.includes(perm)
        );
        if (!hasPermissions) {
          return deny(`Falta de capability global: Requer [${tool.requiredPermissions.join(', ')}]. Nenhum papel possui bypass.`);
        }
      }
    } else if (tool.organizationScoped) {
      const requiresLivingLibrary = tool.requiredPermissions.includes('livingLibrary.manage') || tool.name === 'addSongToLivingLibrary';
      if (requiresLivingLibrary) {
        const hasCap = appAccess.capabilities.includes('livingLibrary.manage');
        if (!hasCap) {
          return deny('Bloqueio de privilégio: A capability "livingLibrary.manage" é estritamente necessária no appAccess efetivo e não está presente.');
        }
      }
    }

    // 11. Evaluate confirmationPolicy & 12. Evaluate riskLevel
    const demoConfirmation = invocationContext.demoConfirmation;
    
    // Validating demoConfirmation strict rules
    let hasValidConfirmation = false;
    if (demoConfirmation) {
      const timeValidation = validateDemoConfirmationTime(demoConfirmation.confirmedAt, now);
      if (!timeValidation.valid) {
        return deny(`Confirmação inválida: ${timeValidation.reason}`);
      }
      if (demoConfirmation.requestId !== invocationContext.requestId) {
        return deny('A confirmação possui requestId divergente.');
      }
      if (demoConfirmation.toolId !== tool.id) {
        return deny('A confirmação possui toolId divergente.');
      }
      if (demoConfirmation.organizationId !== invocationContext.organization.id) {
        return deny('A confirmação possui organizationId divergente.');
      }
      hasValidConfirmation = true;
    }

    const confirmationMatchesPolicy = hasValidConfirmation && (
      tool.confirmationPolicy === 'explicit'
        ? demoConfirmation!.policy === 'explicit' && demoConfirmation!.method === 'explicit_click'
        : tool.confirmationPolicy === 'simple'
          ? demoConfirmation!.policy === 'simple' && demoConfirmation!.method === 'simple_click'
          : true
    );

    if (tool.riskLevel === 'R4_CRITICAL') {
       return needsConfirmation('Ferramenta R4 (CRITICAL): Requer human_approval ou strong confirmation. O simulador bloqueia por padrão sem evidência real.');
    }

    if (tool.riskLevel === 'R3_PRIVILEGED') {
       if (tool.confirmationPolicy === 'human_approval' || tool.confirmationPolicy === 'strong') {
         return needsConfirmation(`Ferramenta R3 (PRIVILEGED): Requer ${tool.confirmationPolicy}. O simulador não finge aprovação humana ou forte.`);
       }
       
       if (tool.confirmationPolicy === 'explicit' || tool.confirmationPolicy === 'simple') {
         if (!confirmationMatchesPolicy) {
           return needsConfirmation(`Ferramenta R3 (PRIVILEGED): Requer confirmação ${tool.confirmationPolicy} compatível antes da execução.`);
         }
       } else if (!hasValidConfirmation) {
         return needsConfirmation('Ferramenta R3 (PRIVILEGED): Requer confirmação antes da execução.');
       }
    }

    if (tool.riskLevel === 'R2_REVERSIBLE_WRITE') {
       if (tool.confirmationPolicy === 'human_approval' || tool.confirmationPolicy === 'strong') {
         return needsConfirmation(`Ferramenta R2 (REVERSIBLE_WRITE): Requer ${tool.confirmationPolicy}. O simulador não finge aprovação humana ou forte.`);
       }
       if (tool.confirmationPolicy === 'explicit' || tool.confirmationPolicy === 'simple') {
         if (!confirmationMatchesPolicy) {
           return needsConfirmation(`Ferramenta R2 (REVERSIBLE_WRITE): Requer confirmação ${tool.confirmationPolicy} compatível antes da execução.`);
         }
       } else if (!hasValidConfirmation) {
         return needsConfirmation('Ferramenta R2 (REVERSIBLE_WRITE): Requer confirmação antes da execução.');
       }
    }

    if (tool.confirmationPolicy === 'human_approval') {
       return needsConfirmation('Ação exige human_approval. O simulador requer aprovação comprovada e não permite bypass.');
    }

    return allow('Permissão concedida (SIMULAÇÃO). A autorização real será reavaliada pelo backend do MillionsNest e pelo Tool Gateway.');
  }
}
