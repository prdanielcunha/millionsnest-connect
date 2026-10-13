/**
 * Opaque, tenant-bound pagination cursor for canonical Inbox thread listings.
 * This is not an authorization credential. Every page revalidates Hub authority.
 */
export type InboxPageCursor = Readonly<{
  version: 1;
  organizationId: string;
  updatedAt: string;
  conversationId: string;
}>;

function validId(input: unknown): input is string {
  return typeof input === 'string' && input.length >= 1 && input.length <= 180 &&
    !input.includes('/') && !input.includes('\\');
}

export function encodeInboxPageCursor(input: Omit<InboxPageCursor, 'version'>): string {
  if (!validId(input.organizationId) || !validId(input.conversationId) ||
      Number.isNaN(Date.parse(input.updatedAt))) {
    throw new Error('INBOX_CURSOR_INVALID');
  }
  return Buffer.from(JSON.stringify({ version: 1, ...input }), 'utf8').toString('base64url');
}

export function decodeInboxPageCursor(token: string, organizationId: string): InboxPageCursor {
  if (token.length < 8 || token.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error('INBOX_CURSOR_INVALID');
  }
  let parsed: any;
  try {
    parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    throw new Error('INBOX_CURSOR_INVALID');
  }
  if (parsed?.version !== 1 || parsed?.organizationId !== organizationId ||
      !validId(parsed.organizationId) || !validId(parsed.conversationId) ||
      typeof parsed.updatedAt !== 'string' ||
      Number.isNaN(Date.parse(parsed.updatedAt))) {
    throw new Error('INBOX_CURSOR_INVALID');
  }
  return parsed as InboxPageCursor;
}
