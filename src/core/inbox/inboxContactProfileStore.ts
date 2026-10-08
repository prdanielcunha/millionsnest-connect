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
