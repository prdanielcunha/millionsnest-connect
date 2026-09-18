export type ConnectThreadStatus =
  | 'new'
  | 'in_progress'
  | 'waiting_person'
  | 'waiting_team'
  | 'resolved'
  | 'archived';

export type ConnectThreadMode = 'automatic' | 'approval' | 'human';

export type ConnectThreadEventType =
  | 'CONVERSATION_OPENED'
  | 'MESSAGE_REPLIED'
  | 'THREAD_ASSIGNED'
  | 'HANDOFF_CREATED'
  | 'THREAD_WAITING_PERSON'
  | 'THREAD_RESOLVED'
  | 'THREAD_REOPENED'
  | 'THREAD_ARCHIVED';

export interface ConnectThreadEvent {
  eventId: string;
  eventType: ConnectThreadEventType;
  occurredAt: string;
  recordedAt: string;
  organizationId: string;
  conversationId: string;
  sourceApp: 'connect';
  evidenceRef: string;
  sensitivity: 'internal';
  version: 1;
  payload: {
    channel?: string;
    assigneeType?: 'user' | 'team';
    assigneeRef?: string;
    reasonCode?: string;
    resultingStatus?: ConnectThreadStatus;
  };
}

export interface ConnectThreadProjection {
  schemaVersion: 1;
  organizationId: string;
  conversationId: string;
  status: ConnectThreadStatus;
  mode: ConnectThreadMode;
  automationPaused: boolean;
  assignedTo?: {
    type: 'user' | 'team';
    ref: string;
  };
  openedAt: string;
  updatedAt: string;
  lastEventId: string;
  sourceEventCount: number;
  lastEvidenceRef: string;
}

export interface CreateConnectThreadEventInput {
  eventType: ConnectThreadEventType;
  requestId: string;
  organizationId: string;
  conversationId: string;
  evidenceRef: string;
  channel?: string;
  assigneeType?: 'user' | 'team';
  assigneeRef?: string;
  reasonCode?: string;
  occurredAt?: Date;
}

function safeSegment(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 180);
  return normalized || fallback;
}

function safeEvidenceRef(value: string): string {
  return safeSegment(value, 'connect-evidence:unknown');
}

function resultingStatus(eventType: ConnectThreadEventType): ConnectThreadStatus {
  switch (eventType) {
    case 'CONVERSATION_OPENED':
      return 'new';
    case 'MESSAGE_REPLIED':
    case 'THREAD_ASSIGNED':
    case 'THREAD_REOPENED':
      return 'in_progress';
    case 'HANDOFF_CREATED':
      return 'waiting_team';
    case 'THREAD_WAITING_PERSON':
      return 'waiting_person';
    case 'THREAD_RESOLVED':
      return 'resolved';
    case 'THREAD_ARCHIVED':
      return 'archived';
  }
}

/**
 * Canonical, PII-minimal Inbox event.
 *
 * Message bodies, phone numbers, contact names and free-form pastoral notes are
 * intentionally excluded. Domain apps/providers may keep their own evidence;
 * Connect only keeps stable references required for audit and projection.
 */
export function createConnectThreadEvent(
  input: CreateConnectThreadEventInput,
): ConnectThreadEvent {
  const occurredAt = (input.occurredAt ?? new Date()).toISOString();
  const requestId = safeSegment(input.requestId, 'unknown-request');
  const organizationId = safeSegment(input.organizationId, 'unknown-organization');
  const conversationId = safeSegment(input.conversationId, 'unknown-conversation');
  const assigneeRef = input.assigneeRef
    ? safeSegment(input.assigneeRef, 'unknown-assignee')
    : undefined;
  const reasonCode = input.reasonCode
    ? safeSegment(input.reasonCode, 'unspecified')
    : undefined;

  if (
    (input.eventType === 'THREAD_ASSIGNED' || input.eventType === 'HANDOFF_CREATED') &&
    (!input.assigneeType || !assigneeRef)
  ) {
    throw new Error('ASSIGNEE_REQUIRED');
  }

  return {
    eventId: `connect:${requestId}:thread:${conversationId}:${input.eventType.toLowerCase()}`,
    eventType: input.eventType,
    occurredAt,
    recordedAt: occurredAt,
    organizationId,
    conversationId,
    sourceApp: 'connect',
    evidenceRef: safeEvidenceRef(input.evidenceRef),
    sensitivity: 'internal',
    version: 1,
    payload: {
      channel: input.channel ? safeSegment(input.channel, 'unknown') : undefined,
      assigneeType: input.assigneeType,
      assigneeRef,
      reasonCode,
      resultingStatus: resultingStatus(input.eventType),
    },
  };
}

function compareEventOrder(a: ConnectThreadEvent, b: ConnectThreadEvent): number {
  if (a.occurredAt !== b.occurredAt) return a.occurredAt.localeCompare(b.occurredAt);
  return a.eventId.localeCompare(b.eventId);
}

function assertTransition(
  previous: ConnectThreadProjection | null,
  event: ConnectThreadEvent,
): void {
  if (!previous && event.eventType !== 'CONVERSATION_OPENED') {
    throw new Error('CONVERSATION_OPEN_REQUIRED');
  }
  if (!previous) return;

  if (previous.status === 'archived') {
    throw new Error('ARCHIVED_THREAD_IMMUTABLE');
  }
  if (event.eventType === 'CONVERSATION_OPENED') {
    throw new Error('CONVERSATION_ALREADY_OPEN');
  }
  if (event.eventType === 'THREAD_ARCHIVED' && previous.status !== 'resolved') {
    throw new Error('THREAD_MUST_BE_RESOLVED_BEFORE_ARCHIVE');
  }
  if (event.eventType === 'THREAD_REOPENED' && previous.status !== 'resolved') {
    throw new Error('ONLY_RESOLVED_THREAD_CAN_REOPEN');
  }
}

/**
 * Deterministic thread projection used as the canonical Inbox state machine.
 *
 * The projection is rebuildable, event-id idempotent and tenant/thread pinned.
 * This file deliberately does not claim durable storage; a future Connect-owned
 * event sink can persist these same events without changing the state model.
 */
export function projectConnectThread(
  events: Iterable<ConnectThreadEvent>,
): ConnectThreadProjection | null {
  const unique = new Map<string, ConnectThreadEvent>();
  for (const event of events) {
    if (!unique.has(event.eventId)) unique.set(event.eventId, event);
  }
  const ordered = [...unique.values()].sort(compareEventOrder);
  if (ordered.length === 0) return null;

  const organizationId = ordered[0].organizationId;
  const conversationId = ordered[0].conversationId;
  let state: ConnectThreadProjection | null = null;

  for (const event of ordered) {
    if (
      event.organizationId !== organizationId ||
      event.conversationId !== conversationId
    ) {
      throw new Error('THREAD_SCOPE_MISMATCH');
    }

    assertTransition(state, event);
    const status = event.payload.resultingStatus ?? resultingStatus(event.eventType);

    if (!state) {
      state = {
        schemaVersion: 1,
        organizationId,
        conversationId,
        status,
        mode: 'automatic',
        automationPaused: false,
        openedAt: event.occurredAt,
        updatedAt: event.recordedAt,
        lastEventId: event.eventId,
        sourceEventCount: 1,
        lastEvidenceRef: event.evidenceRef,
      };
      continue;
    }

    const next: ConnectThreadProjection = {
      ...state,
      status,
      updatedAt: event.recordedAt > state.updatedAt ? event.recordedAt : state.updatedAt,
      lastEventId: event.eventId,
      sourceEventCount: state.sourceEventCount + 1,
      lastEvidenceRef: event.evidenceRef,
    };

    switch (event.eventType) {
      case 'THREAD_ASSIGNED':
        next.assignedTo = {
          type: event.payload.assigneeType!,
          ref: event.payload.assigneeRef!,
        };
        next.mode = 'human';
        next.automationPaused = true;
        break;
      case 'HANDOFF_CREATED':
        next.assignedTo = {
          type: event.payload.assigneeType!,
          ref: event.payload.assigneeRef!,
        };
        next.mode = 'human';
        next.automationPaused = true;
        break;
      case 'MESSAGE_REPLIED':
        // An inbound person reply must never silently continue automation.
        next.automationPaused = true;
        next.mode = state.mode === 'automatic' ? 'approval' : state.mode;
        break;
      case 'THREAD_REOPENED':
        next.automationPaused = true;
        next.mode = 'human';
        break;
      case 'THREAD_RESOLVED':
      case 'THREAD_ARCHIVED':
        next.automationPaused = true;
        break;
      default:
        break;
    }

    state = next;
  }

  return state;
}
