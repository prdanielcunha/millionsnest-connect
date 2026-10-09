/**
 * Organization-scoped, PII-minimal Inbox contact label.
 *
 * The canonical thread/event store never receives names or phone numbers.
 * This projection stores an unverified WhatsApp profile label only after a
 * signed webhook is mapped to one server-owned organization.
 */
export type InboxContactProfile = Readonly<{
  organizationId: string;
  conversationId: string;
  displayName: string;
  source: 'whatsapp_profile';
  observedAt: string;
  expiresAt: string;
}>;

export interface InboxContactProfileStore {
  upsert(input: {
    organizationId: string;
    conversationId: string;
    displayName: string;
    observedAt: string;
  }): Promise<void>;

  list(input: {
    organizationId: string;
    conversationIds: readonly string[];
  }): Promise<readonly InboxContactProfile[]>;

  /** Optional provider-specific indexed lookup, always scoped to one tenant. */
  search?(input: {
    organizationId: string;
    term: string;
    limit?: number;
  }): Promise<readonly InboxContactProfile[]>;
}

export function sanitizeInboxContactName(value: unknown): string {
  if (typeof value !== 'string') return '';
  const clean = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 80);
  if (clean.length < 2 || !/[\p{L}]/u.test(clean)) return '';
  // A self-reported name is not a channel address. Never render a long
  // phone-like sequence as a contact label, even if it includes a first name.
  if (/\d(?:[\s().-]*\d){9,}/.test(clean)) return '';
  return clean;
}

export function makeInboxContactProfile(input: {
  organizationId: string;
  conversationId: string;
  displayName: string;
  observedAt: string;
}, retentionDays = 90): InboxContactProfile {
  const displayName = sanitizeInboxContactName(input.displayName);
  const observed = new Date(input.observedAt);
  if (!displayName) throw new Error('INBOX_CONTACT_NAME_INVALID');
  if (Number.isNaN(observed.getTime())) throw new Error('INBOX_CONTACT_DATE_INVALID');
  if (!Number.isSafeInteger(retentionDays) || retentionDays < 1 || retentionDays > 90) {
    throw new Error('INBOX_CONTACT_RETENTION_INVALID');
  }
  const expiresAt = new Date(observed.getTime() + retentionDays * 86400000).toISOString();
  return {
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    displayName,
    source: 'whatsapp_profile',
    observedAt: observed.toISOString(),
    expiresAt,
  };
}

export function filterAuthorizedInboxContactProfiles(
  records: readonly InboxContactProfile[],
  organizationId: string,
  conversationIds: readonly string[],
  now = new Date(),
): InboxContactProfile[] {
  const allowed = new Set(conversationIds);
  return records.filter((record) =>
    record.organizationId === organizationId &&
    allowed.has(record.conversationId) &&
    record.source === 'whatsapp_profile' &&
    !!sanitizeInboxContactName(record.displayName) &&
    new Date(record.expiresAt).getTime() > now.getTime());
}


/** Privacy-sensitive search tokens live only with the expiring contact record. */
export function normalizeInboxContactSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function inboxContactSearchKeys(displayName: string): string[] {
  const tokens = normalizeInboxContactSearch(displayName).split(' ').filter(Boolean);
  const keys = new Set<string>();
  for (const token of tokens.slice(0, 8)) {
    for (let n = 2; n <= Math.min(token.length, 20); n++) keys.add(token.slice(0, n));
  }
  return [...keys].slice(0, 96);
}

export function inboxContactSearchTerm(query: string): string {
  const parts = normalizeInboxContactSearch(query).split(' ').filter(Boolean);
  const term = parts.at(-1) || '';
  return term.length >= 2 && term.length <= 20 ? term : '';
}

export function inboxContactMatchesSearch(displayName: string, query: string): boolean {
  const words = normalizeInboxContactSearch(displayName).split(' ');
  const terms = normalizeInboxContactSearch(query).split(' ').filter(Boolean);
  return terms.length > 0 && terms.every(term => words.some(word => word.startsWith(term)));
}
