/**
 * Presentation-only Inbox helpers. No identity, permission or provider policy
 * belongs here. Each send attempt is scoped to the active organization/thread.
 */
export type InboxReplyAttempt = Readonly<{
  scopeKey: string;
  text: string;
  requestId: string;
}>;

export function prepareInboxReplyAttempt(
  previous: InboxReplyAttempt | null,
  scopeKey: string,
  draft: string,
  createRequestId: () => string,
): InboxReplyAttempt {
  const text = draft.trim();
  if (!scopeKey || !text) throw new Error('INBOX_REPLY_DRAFT_REQUIRED');
  if (previous?.scopeKey === scopeKey && previous.text === text) return previous;
  return { scopeKey, text, requestId: createRequestId() };
}

export function timelineDayKey(isoDate: string, locale: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'invalid-date';
  return date.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function timelineDayLabel(
  isoDate: string,
  locale: string,
  todayLabel: string,
  now = new Date(),
): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '—';
  if (timelineDayKey(isoDate, locale) === timelineDayKey(now.toISOString(), locale)) {
    return todayLabel;
  }
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Client-side affordance only; server revalidates Hub authority on every action.
export function canShowInboxManagement(context: import('../../types').EffectiveEcosystemContext): boolean {
  const role = context.user.systemRole;
  if (role === 'ceo' || role === 'global_admin' || role === 'ecosystem_owner' || role === 'founder') return true;
  const membership = context.memberships.find(item =>
    item.organizationId === context.activeOrganization.id && item.status === 'active');
  if (membership && ['owner', 'admin'].includes((membership.organizationRole || '').trim().toLowerCase())) return true;
  const grants = [
    ...(context.user.capabilities || []),
    ...(membership?.permissions || []),
  ].map(value => value.trim().toLowerCase());
  return grants.some(value => value === '*' || value === 'connect.manage' || value === 'connect.inbox.manage');
}

export type InboxThreadAction = 'assign' | 'wait_for_person' | 'resolve' | 'reopen' | 'archive';

export type InboxThreadActionAttempt = Readonly<{
  scopeKey: string;
  action: InboxThreadAction;
  assigneeRef: string;
  requestId: string;
}>;

export function prepareInboxThreadActionAttempt(
  previous: InboxThreadActionAttempt | null,
  scopeKey: string,
  action: InboxThreadAction,
  assigneeRef: string,
  createRequestId: () => string,
): InboxThreadActionAttempt {
  if (!scopeKey || !action) throw new Error('INBOX_THREAD_SCOPE_REQUIRED');
  if (
    previous?.scopeKey === scopeKey &&
    previous.action === action &&
    previous.assigneeRef === assigneeRef
  ) return previous;
  return { scopeKey, action, assigneeRef, requestId: createRequestId() };
}

/** Existing thread-state machine is authoritative; this controls affordances only. */
export function availableInboxThreadActions(status: import('../../core/client/liveInboxClient').LiveInboxConversation['status']): InboxThreadAction[] {
  if (status === 'archived') return [];
  if (status === 'resolved') return ['reopen', 'archive'];
  return ['assign', 'wait_for_person', 'resolve'];
}
