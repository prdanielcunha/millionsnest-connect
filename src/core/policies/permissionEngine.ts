/**
 * MillionsNest Connect - Canonical Permission & Policy Engine
 * Evaluates authorization rules, capability requirements, and cross-tenant boundaries.
 */

import {
  EffectiveEcosystemContext,
  ToolDefinition,
  PermissionDecision,
} from '../../types';

export class PermissionEngine {
  /**
   * Validates if the current context is authorized to invoke a given tool.
   * STRICT CANONICAL RULE: Neither phone, Instagram ID, nor client-provided values are trusted.
   * Authorization depends strictly on validated organizationId and server capabilities.
   */
  static evaluateToolPermission(
    context: EffectiveEcosystemContext,
    tool: ToolDefinition,
    requestedOrganizationId: string
  ): PermissionDecision {
    const timestamp = new Date().toISOString();

    // 1. Cross-Tenant Check
    if (tool.organizationScoped) {
      if (requestedOrganizationId !== context.activeOrganization.id) {
        return {
          allowed: false,
          reason: `Bloqueio Cross-Tenant: O token ativo pertence à organização "${context.activeOrganization.name}" (${context.activeOrganization.id}), mas a requisição solicitou "${requestedOrganizationId}". Operações inter-organizacionais diretas são proibidas.`,
          checkedAt: timestamp,
        };
      }
    }

    // 2. Global Capability Check for Living Library (livingLibrary.manage)
    if (tool.name === 'addSongToLivingLibrary' || tool.requiredPermissions.includes('livingLibrary.manage')) {
      const hasLivingLibraryCap = context.effectiveCapabilities.includes('livingLibrary.manage') ||
        context.user.globalCapabilities.includes('livingLibrary.manage');

      if (!hasLivingLibraryCap) {
        return {
          allowed: false,
          reason: 'Bloqueio de privilégio global: A ferramenta "addSongToLivingLibrary" é de acervo global e exige a capability "livingLibrary.manage". Administradores de organização local não possuem esse direito automaticamente.',
          requiredCapability: 'livingLibrary.manage',
          checkedAt: timestamp,
        };
      }
    }

    // 3. Organization Membership RBAC Check
    if (tool.organizationScoped && tool.requiredPermissions.length > 0) {
      const activeMembership = context.memberships.find(
        (m) => m.organizationId === context.activeOrganization.id
      );

      if (!activeMembership) {
        return {
          allowed: false,
          reason: `O usuário ${context.user.name} não possui membership ativa na organização ${context.activeOrganization.name}.`,
          checkedAt: timestamp,
        };
      }

      // Owners have full org rights; otherwise check explicit permissions
      if (activeMembership.role !== 'owner') {
        const hasPermissions = tool.requiredPermissions.every((perm) =>
          activeMembership.permissions.includes(perm)
        );

        if (!hasPermissions) {
          return {
            allowed: false,
            reason: `Falta de permissão local: Requer [${tool.requiredPermissions.join(', ')}] na organização ${context.activeOrganization.name}.`,
            checkedAt: timestamp,
          };
        }
      }
    }

    return {
      allowed: true,
      reason: `Permissão concedida. Ação autorizada para ${context.user.name} na organização ${context.activeOrganization.name}.`,
      checkedAt: timestamp,
    };
  }
}
