import {
  createConnectThreadEvent,
  projectConnectThread,
} from '../core/inbox/threadDomain';
import {
  InMemoryConnectThreadStore,
} from '../core/inbox/threadStore';
import {
  ConnectThreadCommandService,
} from '../core/inbox/threadService';

let total = 0;
let passed = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
  passed++;
}
async function rejects(
  fn: () => Promise<unknown>,
  code: string,
  message: string,
) {
  total++;
  try {
    await fn();
  } catch (error) {
    if (error instanceof Error && error.message === code) {
      passed++;
      return;
    }
    throw error;
  }
  throw new Error(`${message}: expected ${code}`);
}
function throws(fn: () => unknown, code: string, message: string) {
  total++;
  try {
    fn();
  } catch (error) {
    if (error instanceof Error && error.message === code) {
      passed++;
      return;
    }
    throw error;
  }
  throw new Error(`${message}: expected ${code}`);
}

console.log('--- Running Connect Inbox Store Contract Tests ---');

const store = new InMemoryConnectThreadStore();
let tick = Date.parse('2026-09-18T20:00:00.000Z');
const service = new ConnectThreadCommandService(store, () => new Date(tick += 1000));

const base = {
  organizationId: 'org-1',
  conversationId: 'thread-1',
};

{
  const opened = await service.open({
    ...base,
    requestId: 'open-1',
    evidenceRef: 'provider-conversation:wa-1',
    channel: 'whatsapp',
  });
  equal(opened.kind, 'appended', 'opening appends the first event');
  equal(opened.projection.status, 'new', 'opened thread starts new');
  equal(opened.projection.sourceEventCount, 1, 'opened thread version is one');

  const duplicate = await service.open({
    ...base,
    requestId: 'open-1',
    evidenceRef: 'provider-conversation:wa-1',
    channel: 'whatsapp',
    occurredAt: new Date(opened.projection.openedAt),
  });
  equal(duplicate.kind, 'duplicate', 'same canonical event is idempotent');
  equal(duplicate.projection.sourceEventCount, 1, 'duplicate does not increment version');
}

{
  const replied = await service.recordPersonReply({
    ...base,
    requestId: 'reply-1',
    evidenceRef: 'provider-message:wamid-1',
  });
  equal(replied.projection.status, 'in_progress', 'person reply moves thread in progress');
  equal(replied.projection.mode, 'approval', 'person reply stops blind automation');
  equal(replied.projection.automationPaused, true, 'person reply pauses automation');
}

{
  const handoff = await service.handoff({
    ...base,
    requestId: 'handoff-1',
    evidenceRef: 'connect-request:handoff-1',
    assigneeType: 'team',
    assigneeRef: 'care-team',
    reasonCode: 'human_requested',
  });
  equal(handoff.projection.status, 'waiting_team', 'handoff waits for the target team');
  equal(handoff.projection.mode, 'human', 'handoff enters human mode');
  equal(handoff.projection.assignedTo?.ref, 'care-team', 'handoff retains stable target ref');
}

{
  const resolved = await service.resolve({
    ...base,
    requestId: 'resolve-1',
    evidenceRef: 'connect-request:resolve-1',
    reasonCode: 'completed',
  });
  equal(resolved.projection.status, 'resolved', 'thread resolves explicitly');

  await rejects(
    () => service.assign({
      ...base,
      requestId: 'assign-without-reopen',
      evidenceRef: 'connect-request:assign-without-reopen',
      assigneeType: 'user',
      assigneeRef: 'user-7',
    }),
    'THREAD_MUST_REOPEN',
    'resolved thread rejects new work until explicit reopen',
  );

  const reopened = await service.reopen({
    ...base,
    requestId: 'reopen-1',
    evidenceRef: 'connect-request:reopen-1',
    reasonCode: 'person_returned',
  });
  equal(reopened.projection.status, 'in_progress', 'explicit reopen resumes work');
  equal(reopened.projection.mode, 'human', 'reopen stays human-first');

  const assigned = await service.assign({
    ...base,
    requestId: 'assign-1',
    evidenceRef: 'connect-request:assign-1',
    assigneeType: 'user',
    assigneeRef: 'user-7',
  });
  equal(assigned.projection.assignedTo?.ref, 'user-7', 'assignment works after reopen');
}

{
  const current = await store.load(base);
  const concurrent = createConnectThreadEvent({
    eventType: 'THREAD_WAITING_PERSON',
    requestId: 'stale-write',
    organizationId: base.organizationId,
    conversationId: base.conversationId,
    evidenceRef: 'connect-request:stale-write',
    occurredAt: new Date('2026-09-18T20:30:00.000Z'),
  });
  await rejects(
    () => store.append(concurrent, (current?.sourceEventCount ?? 1) - 1),
    'THREAD_VERSION_CONFLICT',
    'stale expected version fails closed',
  );
}

{
  const events = await store.readEvents(base);
  const existing = events[0];
  const collision = {
    ...existing,
    evidenceRef: 'different-evidence:same-event-id',
  };
  await rejects(
    () => store.append(collision, events.length),
    'EVENT_ID_COLLISION',
    'same event id with different bytes is rejected',
  );
}

{
  await service.open({
    organizationId: 'org-2',
    conversationId: 'thread-1',
    requestId: 'open-org-2',
    evidenceRef: 'provider-conversation:wa-2',
    channel: 'whatsapp',
  });
  equal((await store.load(base))?.organizationId, 'org-1', 'tenant one remains isolated');
  equal(
    (await store.load({ organizationId: 'org-2', conversationId: 'thread-1' }))?.organizationId,
    'org-2',
    'tenant two has an independent stream',
  );
}

{
  const events = await store.readEvents(base);
  const serialized = JSON.stringify(events);
  equal(serialized.includes('phone'), false, 'thread stream contains no phone field');
  equal(serialized.includes('contactName'), false, 'thread stream contains no contact name');
  equal(serialized.includes('messageBody'), false, 'thread stream contains no message body');
}

{
  const open = createConnectThreadEvent({
    eventType: 'CONVERSATION_OPENED',
    requestId: 'domain-open',
    organizationId: 'org-domain',
    conversationId: 'thread-domain',
    evidenceRef: 'provider-conversation:domain',
    channel: 'inapp',
    occurredAt: new Date('2026-09-18T21:00:00.000Z'),
  });
  const resolved = createConnectThreadEvent({
    eventType: 'THREAD_RESOLVED',
    requestId: 'domain-resolve',
    organizationId: 'org-domain',
    conversationId: 'thread-domain',
    evidenceRef: 'connect-request:domain-resolve',
    occurredAt: new Date('2026-09-18T21:01:00.000Z'),
  });
  const replied = createConnectThreadEvent({
    eventType: 'MESSAGE_REPLIED',
    requestId: 'domain-reply',
    organizationId: 'org-domain',
    conversationId: 'thread-domain',
    evidenceRef: 'provider-message:domain-reply',
    occurredAt: new Date('2026-09-18T21:02:00.000Z'),
  });
  throws(
    () => projectConnectThread([open, resolved, replied]),
    'THREAD_MUST_REOPEN',
    'rebuild enforces explicit reopen after resolution',
  );
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
