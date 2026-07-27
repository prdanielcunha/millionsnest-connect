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

export class DemoPolicySimulator {
  /**
   * Simulates an authorization decision for a tool invocation.
   */
  static evaluateToolPermission(
    context: EffectiveEcosystemContext,
    tool: ToolDefinition,
    invocationContext: ToolInvocationContext
  ): DemoPolicyDecision {
    const timestamp = new Date().toISOString();

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

    // 3. Normalize systemRole for display/classification (not granting bypasses)
    const normalizedRole = normalizeSystemRole(invocationContext.actor.systemRole);

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
        (m) => m.organizationId === context.activeOrganization.id
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

    // 9. Validate appAccess capabilities when required (e.g. for global tools without tenant scoping)
    // Here we consider requiredPermissions for global tools as capabilities required on the appAccess level.
    if (!tool.organizationScoped && tool.requiredPermissions.length > 0) {
      // 10. Apply specific rule for livingLibrary.manage
      const requiresLivingLibrary = tool.requiredPermissions.includes('livingLibrary.manage') || tool.name === 'addSongToLivingLibrary';
      
      if (requiresLivingLibrary) {
        const hasCap = appAccess.capabilities.includes('livingLibrary.manage') || context.user.capabilities.includes('livingLibrary.manage');
        if (!hasCap) {
          return deny('Bloqueio de privilégio: A capability "livingLibrary.manage" é estritamente necessária e não está presente.');
        }
      } else {
        const hasPermissions = tool.requiredPermissions.every((perm) =>
          appAccess.capabilities.includes(perm) || context.user.capabilities.includes(perm)
        );
        if (!hasPermissions) {
          return deny(`Falta de capability global: Requer [${tool.requiredPermissions.join(', ')}]. Nenhum papel possui bypass.`);
        }
      }
    } else if (tool.organizationScoped) {
      // Even if it's tenant scoped, if it requires livingLibrary.manage (rare, but possible), check it.
      const requiresLivingLibrary = tool.requiredPermissions.includes('livingLibrary.manage') || tool.name === 'addSongToLivingLibrary';
      if (requiresLivingLibrary) {
        const hasCap = appAccess.capabilities.includes('livingLibrary.manage') || context.user.capabilities.includes('livingLibrary.manage');
        if (!hasCap) {
          return deny('Bloqueio de privilégio: A capability "livingLibrary.manage" é estritamente necessária e não está presente.');
        }
      }
    }

    // 11. Evaluate confirmationPolicy & 12. Evaluate riskLevel
    const hasConfirmation = !!invocationContext.confirmedAt;

    if (tool.riskLevel === 'R4_CRITICAL') {
       // R4 can never be executed automatically in DEMO_MODE, and even with confirmation it might be blocked.
       return needsConfirmation('Ferramenta R4 (CRITICAL): Requer human_approval ou strong confirmation. O simulador bloqueia por padrão sem evidência real.');
    }

    if (tool.riskLevel === 'R3_PRIVILEGED') {
       if (tool.confirmationPolicy === 'human_approval') {
         return needsConfirmation('Ferramenta R3 (PRIVILEGED): Requer human_approval. O simulador não finge aprovação humana.');
       }
       if (!hasConfirmation) {
         return needsConfirmation('Ferramenta R3 (PRIVILEGED): Requer confirmação explícita ou forte.');
       }
    }

    if (tool.riskLevel === 'R2_REVERSIBLE_WRITE') {
       if (!hasConfirmation) {
         return needsConfirmation('Ferramenta R2 (REVERSIBLE_WRITE): Requer confirmação antes da execução.');
       }
    }

    if (tool.confirmationPolicy === 'human_approval') {
       return needsConfirmation('Ação exige human_approval. O simulador requer aprovação comprovada e não permite bypass.');
    }

    // 13 & 14. Return allowed if all checks passed
    return allow('Permissão concedida (SIMULAÇÃO). A autorização real será reavaliada pelo backend do MillionsNest e pelo Tool Gateway.');
  }
}
