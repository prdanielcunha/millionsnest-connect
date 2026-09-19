import type { CanonicalCoreContext } from '../runtime/connectCore';

export type ConnectInboxAuthorityAction = 'read' | 'manage';

export type ConnectInboxAuthorityDecision =
  | { allowed: true; source: 'global_access' | 'organization_role' | 'explicit_grant' }
  | { allowed: false; reason: 'INBOX_READ_REQUIRED' | 'INBOX_MANAGE_REQUIRED' };

const READ_GRANTS = new Set([
  '*',
  'connect.manage',
  'connect.inbox.read',
  'connect.inbox.manage',
]);

const MANAGE_GRANTS = new Set([
  '*',
  'connect.manage',
  'connect.inbox.manage',
]);

function normalizedGrants(context: CanonicalCoreContext): Set<string> {
  return new Set(
    [...context.permissions, ...context.capabilities]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function hasAny(grants: Set<string>, allowed: Set<string>): boolean {
  for (const grant of allowed) {
    if (grants.has(grant)) return true;
  }
  return false;
}

/**
 * Deterministic Inbox authorization over Hub-resolved context only.
 *
 * No browser-provided role, capability, uid or tenant is accepted here.
 * Hub remains the authority for globalAccess, organizationRole,
 * permissions and capabilities.
 */
export function evaluateConnectInboxAuthority(
  context: CanonicalCoreContext,
  action: ConnectInboxAuthorityAction,
): ConnectInboxAuthorityDecision {
  if (context.globalAccess === true) {
    return { allowed: true, source: 'global_access' };
  }

  const organizationRole = context.organizationRole?.trim().toLowerCase() ?? '';
  if (organizationRole === 'owner' || organizationRole === 'admin') {
    return { allowed: true, source: 'organization_role' };
  }

  const grants = normalizedGrants(context);
  const explicit = action === 'read'
    ? hasAny(grants, READ_GRANTS)
    : hasAny(grants, MANAGE_GRANTS);

  if (explicit) {
    return { allowed: true, source: 'explicit_grant' };
  }

  return {
    allowed: false,
    reason: action === 'read' ? 'INBOX_READ_REQUIRED' : 'INBOX_MANAGE_REQUIRED',
  };
}
