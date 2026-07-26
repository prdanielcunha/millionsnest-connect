/**
 * MillionsNest Connect - Demo Policy Simulator
 * IMPORTANT: This is NOT a canonical authority. This is a local simulation for DEMO_MODE.
 * The future real authorization will be evaluated strictly server-side by MillionsNest and the Tool Gateway.
 */

import {
  EffectiveEcosystemContext,
  ToolDefinition,
  PermissionDecision,
} from '../../types';
import { isGlobalGovernanceRole, isOperationalSupportRole, normalizeSystemRole } from '../../core/roles/systemRoles';

export class DemoPolicySimulator {
  /**
   * Simulates an authorization decision for a tool invocation.
   */
  static evaluateToolPermission(
    context: EffectiveEcosystemContext,
    tool: ToolDefinition,
    requestedOrganizationId: string
  ): PermissionDecision {
    const timestamp = new Date().toISOString();

    if (context.mode !== 'DEMO_MODE') {
      return {
        allowed: false,
        reason: 'O simulador só opera em DEMO_MODE.',
        checkedAt: timestamp,
      };
    }

    // 1. Cross-Tenant Check
    if (tool.organizationScoped) {
      if (requestedOrganizationId !== context.activeOrganization.id) {
        return {
          allowed: false,
          reason: `Bloqueio Cross-Tenant (SIMULAÇÃO): Token pertence à organização "${context.activeOrganization.id}", mas a requisição solicitou "${requestedOrganizationId}".`,
          checkedAt: timestamp,
        };
      }
    }

    // 2. Organization Membership Status & Permissions
    let activeMembership = null;
    if (tool.organizationScoped) {
      activeMembership = context.memberships.find(
        (m) => m.organizationId === context.activeOrganization.id
      );

      if (!activeMembership) {
        return {
          allowed: false,
          reason: `Membership inexistente (SIMULAÇÃO).`,
          checkedAt: timestamp,
        };
      }
    }

    // 3. Required Permissions (Local role owner/admin DOES NOT bypass this in the simulation)
    // Global Governance Role and Support also DO NOT bypass requiredPermissions in the simulation
    if (tool.organizationScoped && tool.requiredPermissions.length > 0) {
       let hasPermissions = false;
       if (activeMembership) {
           hasPermissions = tool.requiredPermissions.every((perm) =>
              activeMembership?.permissions.includes(perm)
           );
       }
       if (!hasPermissions) {
          return {
            allowed: false,
            reason: `Falta de permissão local (SIMULAÇÃO): Requer [${tool.requiredPermissions.join(', ')}]. Owner/Admin/Support não possuem bypass.`,
            checkedAt: timestamp,
          };
       }
    }

    // 4. Global Capability Check for Living Library (livingLibrary.manage)
    // No role automatically grants livingLibrary.manage. It must be explicit.
    if (tool.name === 'addSongToLivingLibrary' || tool.requiredPermissions.includes('livingLibrary.manage')) {
      const hasLivingLibraryCap = context.effectiveCapabilities.includes('livingLibrary.manage') ||
        context.user.globalCapabilities.includes('livingLibrary.manage');

      if (!hasLivingLibraryCap) {
        return {
          allowed: false,
          reason: 'Bloqueio de privilégio (SIMULAÇÃO): A capability "livingLibrary.manage" é estritamente necessária e não está presente no contexto.',
          requiredCapability: 'livingLibrary.manage',
          checkedAt: timestamp,
        };
      }
    }

    // 5. Evaluate riskLevel and confirmationPolicy
    if (tool.riskLevel === 'R4_CRITICAL') {
       // R4 can never be executed automatically
       return {
          allowed: false,
          reason: 'Ferramenta R4 (SIMULAÇÃO): Requer human_approval ou strong confirmation. O simulador não executa.',
          checkedAt: timestamp,
       };
    }

    return {
      allowed: true,
      reason: `Permissão concedida (SIMULAÇÃO). A autorização real será reavaliada pelo backend do MillionsNest e pelo Tool Gateway.`,
      checkedAt: timestamp,
    };
  }
}
