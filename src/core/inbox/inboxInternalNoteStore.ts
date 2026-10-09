import { createHash } from 'node:crypto';

export type InboxInternalNote = Readonly<{
  organizationId: string;
  conversationId: string;
  noteId: string;
  actorUid: string;
  body: string;
  recordedAt: string;
  expiresAt: string;
}>;

export interface InboxInternalNoteStore {
  add(input: {
    organizationId: string;
    conversationId: string;
    actorUid: string;
    requestId: string;
    body: string;
  }): Promise<{ kind: 'created' | 'duplicate'; note: InboxInternalNote }>;
  list(input: {
    organizationId: string;
    conversationId: string;
    limit?: number;
  }): Promise<readonly InboxInternalNote[]>;
}

export function validateInboxInternalNoteText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const clean = value.replace(/\u0000/g, '').trim();
  return clean.length >= 1 && clean.length <= 2000 ? clean : '';
}

export function deriveInboxInternalNoteId(input: {
  organizationId: string;
  conversationId: string;
  actorUid: string;
  requestId: string;
}): string {
  const material = [input.organizationId, input.conversationId, input.actorUid, input.requestId].join('\u001f');
  return 'in_' + createHash('sha256').update(material).digest('hex').slice(0, 40);
}

export function makeInboxInternalNote(input: {
  organizationId: string;
  conversationId: string;
  actorUid: string;
  requestId: string;
  body: string;
}, now = new Date(), retentionDays = 30): InboxInternalNote {
  const body = validateInboxInternalNoteText(input.body);
  if (!body) throw new Error('INBOX_NOTE_TEXT_INVALID');
  if (!Number.isSafeInteger(retentionDays) || retentionDays < 1 || retentionDays > 30) {
    throw new Error('INBOX_NOTE_RETENTION_INVALID');
  }
  if (Number.isNaN(now.getTime())) throw new Error('INBOX_NOTE_DATE_INVALID');
  return {
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    noteId: deriveInboxInternalNoteId(input),
    actorUid: input.actorUid,
    body,
    recordedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + retentionDays * 86400000).toISOString(),
  };
}
