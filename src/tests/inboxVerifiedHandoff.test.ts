import assert from 'node:assert/strict';
import {
  HubFirestoreInboxOperatorDirectory,
  isEligibleInboxOperatorMembership,
} from '../core/inbox/hubFirestoreInboxOperatorDirectory';
import { createConnectInboxOperatorDirectoryHttpHandler } from '../core/runtime/connectInboxOperatorDirectoryHttpHandler';
import { createConnectInboxThreadCommandHttpHandler } from '../core/runtime/connectInboxThreadHttpHandler';
import { InMemoryConnectThreadStore } from '../core/inbox/threadStore';
import { ConnectThreadCommandService } from '../core/inbox/threadService';
import type { CanonicalContextProvider } from '../core/runtime/connectCore';

const adminMember = {
  organizationRole: { stringValue: 'admin' },
  status: { stringValue: 'active' },
  displayName: { stringValue: 'Ana Silva' },
};
const removed = { ...adminMember, status: { stringValue: 'removed' } };
const normal = { organizationRole: { stringValue: 'member' } };
assert.equal(isEligibleInboxOperatorMembership(adminMember), true);
assert.equal(isEligibleInboxOperatorMembership(removed), false);
assert.equal(isEligibleInboxOperatorMembership({ ...adminMember, status: { stringValue: 'pending' } }), false);
assert.equal(isEligibleInboxOperatorMembership(normal), false);
assert.equal(isEligibleInboxOperatorMembership({
  ...normal, permissions: { mapValue: { fields: {
    'connect.inbox.manage': { booleanValue: true },
  } } },
}), true);
assert.equal(isEligibleInboxOperatorMembership({
  ...normal, permissions: { mapValue: { fields: {
    'connect.inbox.read': { booleanValue: true },
  } } },
}), false);

const calls: string[] = [];
let suspended = false;
const fetchImpl: typeof fetch = async (url) => {
  const value = String(url);
  calls.push(value);
  if (value.endsWith('/organizations/org-1/members?pageSize=100')) {
    return new Response(JSON.stringify({ documents: [
      { name: 'projects/millionsnest/databases/(default)/documents/organizations/org-1/members/user-2', fields: adminMember },
      { name: 'projects/millionsnest/databases/(default)/documents/organizations/org-1/members/user-3', fields: removed },
    ] }), { status: 200 });
  }
  if (value.endsWith('/organizations/org-1/members/user-2')) {
    return new Response(JSON.stringify({ fields: adminMember }), { status: 200 });
  }
  if (value.endsWith('/organizations/org-1/members/user-3')) {
    return new Response(JSON.stringify({ fields: normal }), { status: 200 });
  }
  if (value.endsWith('/users/user-2')) {
    return new Response(JSON.stringify({ fields: {
      status: { stringValue: suspended ? 'suspended' : 'active' },
    } }), { status: 200 });
  }
  throw new Error('UNEXPECTED_FIRESTORE_FETCH_' + value);
};
const directory = new HubFirestoreInboxOperatorDirectory({
  projectId: 'millionsnest', fetchImpl,
  tokenProvider: { async getAccessToken() { return 'service-account-access-token'; } },
});
const list = await directory.list({ organizationId: 'org-1' });
assert.deepEqual(list, [{ uid: 'user-2', displayName: 'Ana Silva', role: 'admin' }]);
assert.equal(await directory.verify({ organizationId: 'org-1', uid: 'user-2' }), true);
suspended = true;
assert.equal(await directory.verify({ organizationId: 'org-1', uid: 'user-2' }), false);
suspended = false;
assert.equal(await directory.verify({ organizationId: 'org-1', uid: 'user-3' }), false);
await assert.rejects(
  () => directory.verify({ organizationId: '../org-2', uid: 'user-2' }),
  /INBOX_DIRECTORY_SCOPE_INVALID/,
);
assert.ok(calls.every(url => !url.includes('/org-2/')));
const contextProvider: CanonicalContextProvider = { async resolve({ requestedOrganizationId }) {
  return { status: 'resolved', context: {
    actorUid: 'user-1', organizationId: requestedOrganizationId || 'org-1',
    organizationRole: 'admin', systemRole: null, globalAccess: false,
    permissions: [], capabilities: [], appAccess: { musicscale: true },
  } };
} };
const reader: CanonicalContextProvider = { async resolve({ requestedOrganizationId }) {
  return { status: 'resolved', context: {
    actorUid: 'user-1', organizationId: requestedOrganizationId || 'org-1',
    organizationRole: 'member', systemRole: null, globalAccess: false,
    permissions: ['connect.inbox.read'], capabilities: [], appAccess: { musicscale: true },
  } };
} };
function resp() { const r: any = {
  statusCode: 200, headers: {}, body: null,
  setHeader(k: string, v: string) { this.headers[k] = v; return this; },
  status(n: number) { this.statusCode = n; return this; },
  json(x: any) { this.body = x; return this; },
}; return r; }
const req = (body: any, token = true): any => ({
  method: 'POST', params: { conversationId: 'thread-a' },
  headers: token ? { authorization: 'Bearer token' } : {},
  query: { organizationId: 'org-1' }, body,
});
const dirHandler = createConnectInboxOperatorDirectoryHttpHandler({
  contextProvider, directory,
});
const visible = resp();
await dirHandler(req(undefined), visible);
assert.equal(visible.statusCode, 200);
assert.equal(visible.body.operators[0].displayName, 'Ana Silva');
assert.equal(JSON.stringify(visible.body).includes('service-account-access-token'), false);
const denied = resp();
await createConnectInboxOperatorDirectoryHttpHandler({
  contextProvider: reader, directory,
})(req(undefined), denied);
assert.equal(denied.statusCode, 403);

const threadStore = new InMemoryConnectThreadStore();
await new ConnectThreadCommandService(threadStore).open({
  organizationId: 'org-1', conversationId: 'thread-a',
  evidenceRef: 'provider:1', channel: 'whatsapp', requestId: 'open-1',
});
const commandHandler = createConnectInboxThreadCommandHttpHandler({
  contextProvider, store: threadStore, operatorDirectory: directory,
});
const base = {
  organizationId: 'org-1', evidenceRef: 'provider:1',
  requestId: 'handoff-1', action: 'handoff', assigneeType: 'user', assigneeRef: 'user-2',
};
const invalidMember = resp();
await commandHandler(req({ ...base, assigneeRef: 'user-3' }), invalidMember);
assert.equal(invalidMember.statusCode, 403);
assert.equal(invalidMember.body.code, 'ASSIGNEE_NOT_AUTHORIZED');
const spoofedClaim = resp();
await commandHandler(req({ ...base, action: 'assign' }), spoofedClaim);
assert.equal(spoofedClaim.statusCode, 403, 'cannot assign an arbitrary actor');
const invalidTeam = resp();
await commandHandler(req({ ...base, assigneeType: 'team' }), invalidTeam);
assert.equal(invalidTeam.statusCode, 503, 'no unvalidated team assignments');
const transferred = resp();
await commandHandler(req(base), transferred);
assert.equal(transferred.statusCode, 200);
assert.equal(transferred.body.thread.assignedTo.ref, 'user-2');
assert.equal(transferred.body.thread.status, 'waiting_team');
const missingDirectory = createConnectInboxThreadCommandHttpHandler({
  contextProvider, store: threadStore,
});
const failClosed = resp();
await missingDirectory(req({ ...base, requestId: 'handoff-no-directory' }), failClosed);
assert.equal(failClosed.statusCode, 503, 'unconfigured directory cannot transfer');

console.log('Hub operator handoff: canonical members, disabled account, RBAC and fail closed PASS');
