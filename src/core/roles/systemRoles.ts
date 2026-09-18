import { CanonicalSystemRole, GlobalGovernanceRole, OperationalSystemRole } from '../../types';

type LegacySystemRoleAlias =
  | 'suporte'
  | 'Support'
  | 'Suporte'
  | 'CEO'
  | 'Global_Admin'
  | 'Ecosystem_Owner'
  | 'Founder';

export function normalizeSystemRole(value: unknown): CanonicalSystemRole | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();

  switch (trimmed) {
    case 'ceo':
    case 'global_admin':
    case 'ecosystem_owner':
    case 'founder':
    case 'support':
      return trimmed as CanonicalSystemRole;
    case 'suporte':
      return 'support';
    default:
      return null;
  }
}

export function isGlobalGovernanceRole(value: unknown): value is GlobalGovernanceRole {
  const role = normalizeSystemRole(value);
  if (!role) return false;
  return role === 'ceo' || role === 'global_admin' || role === 'ecosystem_owner' || role === 'founder';
}

export function isOperationalSupportRole(value: unknown): boolean {
  const role = normalizeSystemRole(value);
  return role === 'support';
}
