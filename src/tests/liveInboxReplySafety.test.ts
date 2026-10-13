import assert from 'node:assert/strict';
import { prepareInboxReplyAttempt, timelineDayKey, timelineDayLabel } from '../features/inbox/liveInboxPresentation';

let generations = 0;
const createId = () => `request-${++generations}`;
const first = prepareInboxReplyAttempt(null, 'org-a:conversation-1', ' Olá! ', createId);
assert.equal(first.text, 'Olá!');
assert.equal(first.requestId, 'request-1');

// A timeout or connection drop cannot cause a fresh provider dispatch ID.
const afterTimeout = prepareInboxReplyAttempt(first, 'org-a:conversation-1', 'Olá!', createId);
assert.equal(afterTimeout.requestId, first.requestId);
assert.equal(generations, 1);

// Changing the message, conversation or organization is a new send intent.
const changedText = prepareInboxReplyAttempt(first, 'org-a:conversation-1', 'Outro texto', createId);
assert.notEqual(changedText.requestId, first.requestId);
const changedConversation = prepareInboxReplyAttempt(first, 'org-a:conversation-2', 'Olá!', createId);
assert.notEqual(changedConversation.requestId, first.requestId);
const changedOrganization = prepareInboxReplyAttempt(first, 'org-b:conversation-1', 'Olá!', createId);
assert.notEqual(changedOrganization.requestId, first.requestId);
assert.throws(() => prepareInboxReplyAttempt(null, 'org-a:conversation-1', '   ', createId), /INBOX_REPLY_DRAFT_REQUIRED/);

// The Inbox must never label a September message as "Today" in October.
const now = new Date('2026-10-08T12:00:00.000Z');
const yesterday = new Date('2026-10-07T12:00:00.000Z');
assert.equal(timelineDayLabel(now.toISOString(), 'pt-BR', 'Hoje', now), 'Hoje');
assert.notEqual(timelineDayLabel(yesterday.toISOString(), 'pt-BR', 'Hoje', now), 'Hoje');
assert.equal(timelineDayKey(now.toISOString(), 'pt-BR'), timelineDayKey(now.toISOString(), 'pt-BR'));
assert.notEqual(timelineDayKey(yesterday.toISOString(), 'pt-BR'), timelineDayKey(now.toISOString(), 'pt-BR'));
assert.equal(timelineDayLabel('invalid', 'pt-BR', 'Hoje', now), '—');
console.log('Live Inbox reply idempotency and calendar labels: passed');
