import assert from 'node:assert/strict';
import {
  availableInboxThreadActions,
  canShowInboxManagement,
  prepareInboxThreadActionAttempt,
} from '../features/inbox/liveInboxPresentation';
import type { EffectiveEcosystemContext } from '../types';
import fs from 'node:fs';

function effectiveContext(role: string | null, grants: string[] = []): EffectiveEcosystemContext {
  return {
    mode: 'LIVE_CORE',
    user: { uid: 'user-1', name: 'Operador', systemRole: null, capabilities: [] },
    activeOrganization: { id: 'org-1', name: 'Org 1', slug: 'org-1', plan: 'x', isDemo: false },
    availableOrganizations: [],
    memberships: [{
      id: 'membership-1', uid: 'user-1', organizationId: 'org-1',
      organizationName: 'Org 1', organizationRole: role,
      status: 'active', permissions: grants,
    }],
    appAccess: [],
  };
}
assert.equal(canShowInboxManagement(effectiveContext('member')), false, 'ordinary member is read-only');
assert.equal(canShowInboxManagement(effectiveContext('admin')), true, 'admin can see management actions');
assert.equal(canShowInboxManagement(effectiveContext('member', ['connect.inbox.manage'])), true);
assert.equal(canShowInboxManagement(effectiveContext('member', ['connect.inbox.read'])), false);
const otherOrganization = effectiveContext('admin');
otherOrganization.memberships[0].organizationId = 'org-2';
assert.equal(canShowInboxManagement(otherOrganization), false, 'membership cannot cross tenant');
const inactive = effectiveContext('owner');
inactive.memberships[0].status = 'inactive';
assert.equal(canShowInboxManagement(inactive), false, 'inactive membership hides actions');

assert.deepEqual(availableInboxThreadActions('new'), ['assign', 'wait_for_person', 'resolve']);
assert.deepEqual(availableInboxThreadActions('in_progress'), ['assign', 'wait_for_person', 'resolve']);
assert.deepEqual(availableInboxThreadActions('resolved'), ['reopen', 'archive']);
assert.deepEqual(availableInboxThreadActions('archived'), []);

let idCounter = 0;
const requestId = () => `thread-action-${++idCounter}`;
const attempt = prepareInboxThreadActionAttempt(null, 'org-1:thread-1', 'resolve', '', requestId);
const retry = prepareInboxThreadActionAttempt(attempt, 'org-1:thread-1', 'resolve', '', requestId);
assert.equal(retry.requestId, attempt.requestId, 'timeout retry reuses durable event id');
assert.equal(idCounter, 1);
assert.notEqual(prepareInboxThreadActionAttempt(attempt, 'org-1:thread-2', 'resolve', '', requestId).requestId, attempt.requestId);
assert.notEqual(prepareInboxThreadActionAttempt(attempt, 'org-2:thread-1', 'resolve', '', requestId).requestId, attempt.requestId);
assert.notEqual(prepareInboxThreadActionAttempt(attempt, 'org-1:thread-1', 'reopen', '', requestId).requestId, attempt.requestId);
assert.throws(() => prepareInboxThreadActionAttempt(null, '', 'resolve', '', requestId), /INBOX_THREAD_SCOPE_REQUIRED/);

// Structural safety: use canonical actions, no client-side Firestore mutations.
const inbox = fs.readFileSync('src/features/inbox/LiveInboxPage.tsx', 'utf8');
const client = fs.readFileSync('src/core/client/liveInboxClient.ts', 'utf8');
assert.ok(inbox.includes('client.manageThread({'));
assert.ok(inbox.includes('if (!selected || !canManage || threadActing'));
assert.ok(client.includes('/api/core/inbox/threads/'));
assert.ok(client.includes('/actions'));
assert.ok(!client.includes('connectSensitiveOrganizations'), 'no direct sensitive Firestore writes');

console.log('Live Inbox management affordances, tenant scope and action idempotency: passed');
