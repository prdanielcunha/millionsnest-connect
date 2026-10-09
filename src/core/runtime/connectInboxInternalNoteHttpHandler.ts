import express from 'express';
import type { CanonicalContextProvider } from './connectCore';
import { evaluateConnectInboxAuthority } from '../inbox/inboxAuthority';
import type { ConnectThreadStore } from '../inbox/threadStore';
import type { InboxInternalNoteStore } from '../inbox/inboxInternalNoteStore';
import { validateInboxInternalNoteText } from '../inbox/inboxInternalNoteStore';

export interface InboxInternalNoteHttpOptions {
  contextProvider: CanonicalContextProvider;
  threadStore: ConnectThreadStore;
  noteStore: InboxInternalNoteStore;
}

function safeId(value: unknown, max = 180): string {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  return raw && raw.length <= max && !raw.includes('/') && !raw.includes('\\') ? raw : '';
}
function privateHeaders(res: express.Response): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
}

export function createInboxInternalNoteHttpHandler(options: InboxInternalNoteHttpOptions) {
  return async function inboxInternalNoteHttpHandler(req: express.Request, res: express.Response) {
    privateHeaders(res);
    const rawBearer = req.headers.authorization;
    const bearer = typeof rawBearer === 'string' && /^Bearer\s+\S+$/i.test(rawBearer.trim())
      ? rawBearer.trim() : '';
    if (!bearer) return res.status(401).json({ success: false, code: 'AUTH_REQUIRED' });

    const write = req.method === 'POST';
    if (req.method !== 'GET' && !write) {
      return res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED' });
    }
    const organizationId = safeId(write ? req.body?.organizationId : req.query?.organizationId);
    const conversationId = safeId(req.params.conversationId);
    if (!organizationId || !conversationId) {
      return res.status(400).json({ success: false, code: 'INBOX_NOTE_SCOPE_INVALID' });
    }
    if (write) {
      const allowed = new Set(['organizationId', 'requestId', 'body']);
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
          Object.keys(req.body).some(name => !allowed.has(name)) ||
          !safeId(req.body?.requestId) ||
          !validateInboxInternalNoteText(req.body?.body)) {
        return res.status(400).json({ success: false, code: 'INBOX_NOTE_REQUEST_INVALID' });
      }
    }

    let resolution;
    try {
      resolution = await options.contextProvider.resolve({
        authToken: bearer, requestedOrganizationId: organizationId,
      });
    } catch {
      return res.status(503).json({ success: false, code: 'CANONICAL_CONTEXT_UNAVAILABLE' });
    }
    if (resolution.status !== 'resolved') {
      return res.status(resolution.status === 'identity_required' ? 401 : 403)
        .json({ success: false, code: 'INBOX_NOTE_ACCESS_DENIED' });
    }
    if (resolution.context.organizationId !== organizationId) {
      return res.status(409).json({ success: false, code: 'ORGANIZATION_CONTEXT_MISMATCH' });
    }
    const authority = evaluateConnectInboxAuthority(resolution.context, write ? 'manage' : 'read');
    if (!authority.allowed) {
      return res.status(403).json({ success: false, code: 'INBOX_NOTE_ACCESS_DENIED' });
    }
    let thread;
    try {
      thread = await options.threadStore.load({ organizationId, conversationId });
    } catch {
      return res.status(503).json({ success: false, code: 'INBOX_NOTE_STORAGE_UNAVAILABLE' });
    }
    if (!thread) return res.status(404).json({ success: false, code: 'THREAD_NOT_FOUND' });

    try {
      if (!write) {
        const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 30;
        const limit = Number.isSafeInteger(limitRaw) ? Math.max(1, Math.min(limitRaw, 50)) : 30;
        const notes = await options.noteStore.list({ organizationId, conversationId, limit });
        return res.status(200).json({
          success: true, organizationId, conversationId,
          notes: notes.map(note => ({
            noteId: note.noteId,
            actorUid: note.actorUid,
            body: note.body,
            recordedAt: note.recordedAt,
            internalOnly: true,
          })),
        });
      }

      const result = await options.noteStore.add({
        organizationId, conversationId,
        actorUid: resolution.context.actorUid,
        requestId: safeId(req.body.requestId),
        body: validateInboxInternalNoteText(req.body.body),
      });
      return res.status(result.kind === 'created' ? 201 : 200).json({
        success: true,
        outcome: result.kind,
        note: {
          noteId: result.note.noteId,
          actorUid: result.note.actorUid,
          body: result.note.body,
          recordedAt: result.note.recordedAt,
          internalOnly: true,
        },
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'INBOX_NOTE_IDEMPOTENCY_COLLISION') {
        return res.status(409).json({ success: false, code });
      }
      return res.status(503).json({ success: false, code: 'INBOX_NOTE_STORAGE_UNAVAILABLE' });
    }
  };
}
