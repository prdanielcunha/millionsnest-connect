import assert from 'node:assert/strict';
import { makeInboxInternalNote } from '../core/inbox/inboxInternalNoteStore';
import { FirestoreInboxInternalNoteStore } from '../core/inbox/firestoreInboxInternalNoteStore';
import { createInboxInternalNoteHttpHandler } from '../core/runtime/connectInboxInternalNoteHttpHandler';
import { InMemoryConnectThreadStore } from '../core/inbox/threadStore';
import { ConnectThreadCommandService } from '../core/inbox/threadService';
import type { CanonicalContextProvider } from '../core/runtime/connectCore';

const time = new Date('2026-10-08T12:00:00.000Z');
const input = {
  organizationId: 'org-a', conversationId: 'thread-1',
  actorUid: 'staff-a', requestId: 'note-req-1', body: 'Conferir com a equipe.',
};
const first = makeInboxInternalNote(input, time);
const retry = makeInboxInternalNote(input, new Date('2026-10-08T12:01:00Z'));
assert.equal(first.noteId, retry.noteId);
assert.equal(first.body, retry.body);
assert.notEqual(first.recordedAt, retry.recordedAt);
assert.equal(new Date(first.expiresAt).getTime()-time.getTime(), 30*86400000);
assert.throws(() => makeInboxInternalNote({ ...input, body: ' ' }), /INBOX_NOTE_TEXT_INVALID/);
assert.throws(() => makeInboxInternalNote(input, time, 31), /INBOX_NOTE_RETENTION_INVALID/);

const writes: Array<{ url: string; method: string; body: any }> = [];
let saved: any = null;
const fetchImpl: typeof fetch = async (url, init) => {
  const target = String(url);
  const method = init?.method ?? 'GET';
  let body: any = null;
  if (init?.body) body = JSON.parse(String(init.body));
  writes.push({ url: target, method, body });
  if (method === 'PATCH') {
    assert.ok(target.includes('/connectSensitiveOrganizations/org-a/inboxInternalNotes/thread-1/inboxOperatorNotes/in_'));
    assert.ok(target.endsWith('currentDocument.exists=false'));
    if (saved) return new Response('{}', { status: 412 });
    saved = body.fields;
    return new Response('{}', { status: 200 });
  }
  if (method === 'GET') {
    if (!saved) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify({ fields: saved }), { status: 200 });
  }
  if (method === 'POST' && target.endsWith(':runQuery')) {
    return new Response(JSON.stringify([{ document: { fields: saved } }]), { status: 200 });
  }
  throw new Error('UNKNOWN_REQUEST');
};
const noteStore = new FirestoreInboxInternalNoteStore({
  projectId: 'millionsnest',
  fetchImpl,
  now: () => time,
  tokenProvider: { async getAccessToken() { return 'test-token'; } },
});
const created = await noteStore.add(input);
assert.equal(created.kind, 'created');
assert.equal(created.note.body, input.body);
assert.equal(saved.expiresAt.timestampValue, first.expiresAt);
assert.equal(saved.actorUid.stringValue, 'staff-a');
const duplicated = await noteStore.add(input);
assert.equal(duplicated.kind, 'duplicate');
assert.equal(duplicated.note.noteId, created.note.noteId);
await assert.rejects(
  () => noteStore.add({ ...input, body: 'Conteúdo alterado' }),
  /INBOX_NOTE_IDEMPOTENCY_COLLISION/,
);
const listed = await noteStore.list({ organizationId: 'org-a', conversationId: 'thread-1' });
assert.equal(listed.length, 1);
assert.equal(listed[0].body, 'Conferir com a equipe.');
assert.ok(writes.every(w => !w.url.includes('/messages') && !w.url.includes('/reply')));
assert.equal(writes.some(w => w.method === 'POST' && w.url.endsWith(':runQuery')), true);

const threads = new InMemoryConnectThreadStore();
const svc = new ConnectThreadCommandService(threads);
await svc.open({ organizationId: 'org-a', conversationId: 'thread-1',
  requestId: 'open-1', channel: 'whatsapp', evidenceRef: 'provider:1' });
function provider(role: string): CanonicalContextProvider {
  return { async resolve({ requestedOrganizationId }) {
    return { status: 'resolved', context: {
      actorUid: 'staff-a', systemRole: null, globalAccess: false,
      organizationId: requestedOrganizationId || 'org-a',
      organizationRole: role, permissions: [], capabilities: [],
      appAccess: { musicscale: true },
    } };
  } };
}
function res() {
  const x: any = {
    statusCode: 200, headers: {}, body: null,
    setHeader(k: string, v: string) { this.headers[k] = v; return this; },
    status(v: number) { this.statusCode = v; return this; },
    json(body: any) { this.body = body; return this; },
  };
  return x;
}
function request(method: string, body?: any, org='org-a', thread='thread-1', token=true) {
  return { method, params: { conversationId: thread },
    headers: token ? { authorization: 'Bearer signed' } : {},
    query: { organizationId: org }, body } as any;
}
const adminHandler = createInboxInternalNoteHttpHandler({
  contextProvider: provider('admin'), threadStore: threads, noteStore,
});
const memberHandler = createInboxInternalNoteHttpHandler({
  contextProvider: provider('member'), threadStore: threads, noteStore,
});
const read = res();
await adminHandler(request('GET'), read);
assert.equal(read.statusCode, 200);
assert.equal(read.body.notes[0].internalOnly, true);
assert.equal(read.body.notes[0].body, 'Conferir com a equipe.');
assert.equal(read.headers['Cache-Control'], 'no-store');

const unauthorized = res();
await memberHandler(request('POST', { organizationId: 'org-a', requestId: 'a', body: 'nota' }), unauthorized);
assert.equal(unauthorized.statusCode, 403);
const unauth = res();
await adminHandler(request('GET', undefined, 'org-a', 'thread-1', false), unauth);
assert.equal(unauth.statusCode, 401);
const spoofed = res();
await adminHandler(request('POST', {
  organizationId: 'org-a', requestId: 'note-req-1', body: 'Outra nota', actorUid: 'manager',
}), spoofed);
assert.equal(spoofed.statusCode, 400, 'client cannot forge actor identity');
const missing = res();
await adminHandler(request('GET', undefined, 'org-a', 'unknown'), missing);
assert.equal(missing.statusCode, 404);
const deniedOrg = res();
await adminHandler(request('POST', {
  organizationId: 'org-b', requestId: 'note-req-1', body: 'Outra nota',
}, 'org-b', 'thread-1'), deniedOrg);
assert.equal(deniedOrg.statusCode, 404, 'must confirm canonical thread before writing');
assert.ok(!JSON.stringify(await threads.listByOrganization({ organizationId: 'org-a' })).includes('Conferir com a equipe'));
console.log('Connect private notes: idempotency, TTL, Hub RBAC, tenant, no provider dispatch PASS');
