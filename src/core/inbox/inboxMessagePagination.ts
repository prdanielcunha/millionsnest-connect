/**
 * Opaque continuation cursors for immutable message history, tenant/thread-bound.
 * These are not authorization grants: Hub authorization and existence of the
 * owning canonical thread are revalidated for every history page.
 */
export type InboxMessageCursor = Readonly<{
  version: 1;
  organizationId: string;
  conversationId: string;
  messageId: string;
  occurredAt: string;
}>;

function valid(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 300 &&
    !value.includes('/') && !value.includes('\\');
}

export function encodeInboxMessageCursor(input: Omit<InboxMessageCursor, 'version'>): string {
  if (![input.organizationId, input.conversationId, input.messageId].every(valid) ||
      typeof input.occurredAt !== 'string' || Number.isNaN(Date.parse(input.occurredAt))) {
    throw new Error('INBOX_MESSAGE_CURSOR_INVALID');
  }
  return Buffer.from(JSON.stringify({ version: 1, ...input }), 'utf8').toString('base64url');
}

export function decodeInboxMessageCursor(
  token: string,
  organizationId: string,
  conversationId: string,
): InboxMessageCursor {
  if (token.length < 8 || token.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error('INBOX_MESSAGE_CURSOR_INVALID');
  }
  let parsed: any;
  try {
    parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    throw new Error('INBOX_MESSAGE_CURSOR_INVALID');
  }
  if (parsed?.version !== 1 || parsed.organizationId !== organizationId ||
      parsed.conversationId !== conversationId || !valid(parsed.organizationId) ||
      !valid(parsed.conversationId) || !valid(parsed.messageId) ||
      typeof parsed.occurredAt !== 'string' || Number.isNaN(Date.parse(parsed.occurredAt))) {
    throw new Error('INBOX_MESSAGE_CURSOR_INVALID');
  }
  return parsed as InboxMessageCursor;
}
