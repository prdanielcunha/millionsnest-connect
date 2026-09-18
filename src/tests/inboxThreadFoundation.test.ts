import {
  createConnectThreadEvent,
  projectConnectThread,
} from '../core/inbox/threadDomain';

let passed = 0;
let total = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
  passed++;
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

console.log('--- Running Connect Inbox Thread Foundation Tests ---');

const open = createConnectThreadEvent({
  eventType: 'CONVERSATION_OPENED',
  requestId: 'req-open',
  organizationId: 'org-1',
  conversationId: 'thread-1',
  evidenceRef: 'channel-event:wa-1',
  channel: 'whatsapp',
  occurredAt: new Date('2026-09-18T12:00:00.000Z'),
});
const reply = createConnectThreadEvent({
  eventType: 'MESSAGE_REPLIED',
  requestId: 'req-reply',
  organizationId: 'org-1',
  conversationId: 'thread-1',
  evidenceRef: 'provider-message:wamid-1',
  occurredAt: new Date('2026-09-18T12:01:00.000Z'),
});
const handoff = createConnectThreadEvent({
  eventType: 'HANDOFF_CREATED',
  requestId: 'req-handoff',
  organizationId: 'org-1',
  conversationId: 'thread-1',
  evidenceRef: 'connect-request:req-handoff',
  assigneeType: 'team',
  assigneeRef: 'pastoral-care',
  reasonCode: 'human_requested',
  occurredAt: new Date('2026-09-18T12:02:00.000Z'),
});
const resolved = createConnectThreadEvent({
  eventType: 'THREAD_RESOLVED',
  requestId: 'req-resolved',
  organizationId: 'org-1',
  conversationId: 'thread-1',
  evidenceRef: 'connect-request:req-resolved',
  occurredAt: new Date('2026-09-18T12:03:00.000Z'),
});
const archived = createConnectThreadEvent({
  eventType: 'THREAD_ARCHIVED',
  requestId: 'req-archived',
  organizationId: 'org-1',
  conversationId: 'thread-1',
  evidenceRef: 'connect-request:req-archived',
  occurredAt: new Date('2026-09-18T12:04:00.000Z'),
});

{
  const state = projectConnectThread([handoff, open, reply, handoff, resolved, archived])!;
  equal(state.sourceEventCount, 5, 'duplicate event ids are idempotent');
  equal(state.status, 'archived', 'thread reaches archived only after resolution');
  equal(state.mode, 'human', 'handoff puts thread in human mode');
  equal(state.automationPaused, true, 'handoff/resolution keep automation paused');
  equal(state.assignedTo?.type, 'team', 'handoff keeps target type');
  equal(state.assignedTo?.ref, 'pastoral-care', 'handoff keeps only stable target ref');
  equal(state.lastEvidenceRef, archived.evidenceRef, 'latest evidence ref is preserved');
}

{
  const state = projectConnectThread([open, reply])!;
  equal(state.status, 'in_progress', 'person reply moves thread to in progress');
  equal(state.mode, 'approval', 'person reply downgrades automatic mode to approval');
  equal(state.automationPaused, true, 'person reply pauses automation by default');
}

{
  const serialized = JSON.stringify([open, reply, handoff]);
  equal(serialized.includes('message body'), false, 'canonical thread event has no raw message body');
  equal(serialized.includes('phone'), false, 'canonical thread event has no phone field');
  equal(serialized.includes('contactName'), false, 'canonical thread event has no contact name field');
}

{
  throws(
    () => createConnectThreadEvent({
      eventType: 'HANDOFF_CREATED',
      requestId: 'req-invalid-handoff',
      organizationId: 'org-1',
      conversationId: 'thread-1',
      evidenceRef: 'connect-request:req-invalid-handoff',
    }),
    'ASSIGNEE_REQUIRED',
    'handoff requires a stable assignee',
  );
}

{
  const foreign = createConnectThreadEvent({
    eventType: 'MESSAGE_REPLIED',
    requestId: 'req-foreign',
    organizationId: 'org-2',
    conversationId: 'thread-1',
    evidenceRef: 'provider-message:foreign',
    occurredAt: new Date('2026-09-18T12:01:30.000Z'),
  });
  throws(
    () => projectConnectThread([open, foreign]),
    'THREAD_SCOPE_MISMATCH',
    'tenant mixing is rejected',
  );
}

{
  throws(
    () => projectConnectThread([open, archived]),
    'THREAD_MUST_BE_RESOLVED_BEFORE_ARCHIVE',
    'archive requires prior resolution',
  );
}

{
  const event = createConnectThreadEvent({
    eventType: 'THREAD_ASSIGNED',
    requestId: 'req-assigned',
    organizationId: 'org-1',
    conversationId: 'thread-1',
    evidenceRef: 'connect-request:req-assigned',
    assigneeType: 'user',
    assigneeRef: 'user-123',
    reasonCode: 'manual_assignment',
    occurredAt: new Date('2026-09-18T12:02:30.000Z'),
  });
  equal(
    event.eventId,
    'connect:req-assigned:thread:thread-1:thread_assigned',
    'event id is deterministic',
  );
  equal(event.payload.resultingStatus, 'in_progress', 'assignment state is canonical');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
