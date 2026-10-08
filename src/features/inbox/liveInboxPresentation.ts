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
