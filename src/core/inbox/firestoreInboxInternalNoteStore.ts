import type { InboxInternalNote, InboxInternalNoteStore } from './inboxInternalNoteStore';
import { deriveInboxInternalNoteId, makeInboxInternalNote } from './inboxInternalNoteStore';
import {
  GoogleMetadataAccessTokenProvider,
  type ConnectRuntimeAccessTokenProvider,
} from './firestoreThreadStore';

export interface FirestoreInboxInternalNotesOptions {
  projectId?: string;
  fetchImpl?: typeof fetch;
  tokenProvider?: ConnectRuntimeAccessTokenProvider;
  now?: () => Date;
  retentionDays?: number;
}

function id(value: string): string {
  const v = value.trim();
  if (!v || v.length > 180 || v === '.' || v === '..' ||
      v.includes('/') || v.includes('\\')) throw new Error('INBOX_NOTE_SCOPE_INVALID');
  return encodeURIComponent(v);
}
function str(value: string) { return { stringValue: value }; }
function read(document: any, field: string): string {
  return typeof document?.fields?.[field]?.stringValue === 'string'
    ? document.fields[field].stringValue : '';
}
function parse(document: any): InboxInternalNote {
  const data = {
    organizationId: read(document, 'organizationId'),
    conversationId: read(document, 'conversationId'),
    noteId: read(document, 'noteId'),
    actorUid: read(document, 'actorUid'),
    body: read(document, 'body'),
    recordedAt: read(document, 'recordedAt'),
    expiresAt: typeof document?.fields?.expiresAt?.timestampValue === 'string'
      ? document.fields.expiresAt.timestampValue : '',
  };
  if (!data.organizationId || !data.conversationId || !data.noteId || !data.actorUid ||
      !data.body || !data.recordedAt || !data.expiresAt) {
    throw new Error('INBOX_NOTE_STORAGE_INVALID');
  }
  return data;
}

/** Service-account only. Notes are NEVER written to WhatsApp or thread events. */
export class FirestoreInboxInternalNoteStore implements InboxInternalNoteStore {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;
  private readonly tokenProvider: ConnectRuntimeAccessTokenProvider;
  private readonly now: () => Date;
  private readonly retentionDays: number;

  constructor(options: FirestoreInboxInternalNotesOptions = {}) {
    const projectId = options.projectId || 'millionsnest';
    if (!/^[a-z0-9][a-z0-9-]{4,62}[a-z0-9]$/.test(projectId)) {
      throw new Error('INVALID_FIRESTORE_PROJECT_ID');
    }
    this.base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.tokenProvider = options.tokenProvider ?? new GoogleMetadataAccessTokenProvider({
      fetchImpl: this.fetchImpl,
    });
    this.now = options.now ?? (() => new Date());
    this.retentionDays = options.retentionDays ?? 30;
  }

  private collection(organizationId: string, conversationId: string): string {
    return `connectSensitiveOrganizations/${id(organizationId)}/inboxInternalNotes/${id(conversationId)}`;
  }

  private async fetchExisting(path: string): Promise<InboxInternalNote | null> {
    const token = await this.tokenProvider.getAccessToken();
    const response = await this.fetchImpl(`${this.base}/${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('INBOX_NOTE_READ_UNAVAILABLE');
    return parse(await response.json());
  }

  async add(input: {
    organizationId: string;
    conversationId: string;
    actorUid: string;
    requestId: string;
    body: string;
  }): Promise<{ kind: 'created' | 'duplicate'; note: InboxInternalNote }> {
    const note = makeInboxInternalNote(input, this.now(), this.retentionDays);
    const path = `${this.collection(input.organizationId, input.conversationId)}/notes/${id(note.noteId)}`;
    const token = await this.tokenProvider.getAccessToken();
    let successful = false;
    try {
      const response = await this.fetchImpl(`${this.base}/${path}?currentDocument.exists=false`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          fields: {
            organizationId: str(note.organizationId),
            conversationId: str(note.conversationId),
            noteId: str(note.noteId),
            actorUid: str(note.actorUid),
            body: str(note.body),
            recordedAt: str(note.recordedAt),
            expiresAt: { timestampValue: note.expiresAt },
          },
        }),
        cache: 'no-store',
      });
      successful = response.ok;
      if (!successful && response.status !== 409 && response.status !== 412) {
        throw new Error('INBOX_NOTE_WRITE_UNAVAILABLE');
      }
    } catch {
      // Ambiguous outcomes reconcile using the deterministic note ID; never
      // regenerate a new ID and risk storing duplicate internal notes.
    }
    if (successful) return { kind: 'created', note };
    let persisted: InboxInternalNote | null = null;
    try { persisted = await this.fetchExisting(path); } catch {}
    if (!persisted) throw new Error('INBOX_NOTE_WRITE_UNAVAILABLE');
    if (persisted.organizationId !== input.organizationId ||
        persisted.conversationId !== input.conversationId ||
        persisted.actorUid !== input.actorUid ||
        persisted.noteId !== deriveInboxInternalNoteId(input) ||
        persisted.body !== note.body) {
      throw new Error('INBOX_NOTE_IDEMPOTENCY_COLLISION');
    }
    return { kind: 'duplicate', note: persisted };
  }

  async list(input: {
    organizationId: string;
    conversationId: string;
    limit?: number;
  }): Promise<readonly InboxInternalNote[]> {
    const parent = this.collection(input.organizationId, input.conversationId);
    const limit = Math.max(1, Math.min(input.limit ?? 30, 50));
    const token = await this.tokenProvider.getAccessToken();
    const response = await this.fetchImpl(`${this.base}/${parent}:runQuery`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'notes' }],
          orderBy: [{ field: { fieldPath: 'recordedAt' }, direction: 'DESCENDING' }],
          limit,
        },
      }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('INBOX_NOTE_READ_UNAVAILABLE');
    const raw = await response.text();
    if (!raw.trim()) return [];
    let values: any[];
    try {
      const parsed = JSON.parse(raw);
      values = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      try { values = raw.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)); }
      catch { throw new Error('INBOX_NOTE_READ_INVALID'); }
    }
    const now = this.now().getTime();
    return values.filter(item => item?.document).map(item => parse(item.document))
      .filter(note => note.organizationId === input.organizationId &&
        note.conversationId === input.conversationId &&
        new Date(note.expiresAt).getTime() > now);
  }
}
