import type { StructuredCoreAuditLogger } from './structuredCoreAudit';

export type CanonicalFactEventType =
  | 'TOOL_ACTION_REQUESTED'
  | 'TOOL_ACTION_COMPLETED';

export type CanonicalFactSensitivity =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted';

export interface CanonicalFactEvent {
  eventId: string;
  eventType: CanonicalFactEventType;
  occurredAt: string;
  recordedAt: string;
  organizationId: string;
  actorId?: string;
  subjectRef: string;
  sourceApp: 'connect';
  scope: string;
  evidenceRef: string;
  sensitivity: CanonicalFactSensitivity;
  version: 1;
  payload: {
    toolId: string;
    targetApp: string;
    intent: string;
    result: 'requested' | 'success' | 'denied' | 'failed' | 'conflict';
    channel: string;
    requiredCapability?: string;
    downstreamAuditId?: string;
  };
}

export interface CoreFactPort {
  record(event: CanonicalFactEvent): Promise<void>;
}

export interface ToolActionFactInput {
  eventType: CanonicalFactEventType;
  requestId: string;
  organizationId: string;
  actorId?: string;
  intent: string;
  channel: string;
  result: CanonicalFactEvent['payload']['result'];
  requiredCapability?: string;
  downstreamAuditId?: string;
  occurredAt?: Date;
}

const TOOL_ID = 'musicscale.get_next_schedule';

function safeIdPart(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 180);
  return normalized || fallback;
}

/**
 * Canonical P1 Fact Foundation event for the first real Connect vertical.
 *
 * The payload intentionally excludes raw message text, bearer tokens, email,
 * phone and other unnecessary PII. `eventId` is stable for a given server-side
 * request + phase, which makes duplicate recording detectable by a durable
 * sink introduced later without changing this contract.
 */
export function createToolActionFact(input: ToolActionFactInput): CanonicalFactEvent {
  const occurredAt = input.occurredAt ?? new Date();
  const timestamp = occurredAt.toISOString();
  const phase = input.eventType === 'TOOL_ACTION_REQUESTED' ? 'requested' : 'completed';
  const requestId = safeIdPart(input.requestId, 'unknown-request');
  const organizationId = safeIdPart(input.organizationId, 'unknown-organization');
  const evidenceRef = input.downstreamAuditId?.trim()
    ? `musicscale-audit:${safeIdPart(input.downstreamAuditId, 'unknown-audit')}`
    : `connect-request:${requestId}`;

  return {
    eventId: `connect:${requestId}:${TOOL_ID}:${phase}`,
    eventType: input.eventType,
    occurredAt: timestamp,
    recordedAt: timestamp,
    organizationId,
    actorId: input.actorId?.trim() || undefined,
    subjectRef: `tool:${TOOL_ID}`,
    sourceApp: 'connect',
    scope: `organization:${organizationId}`,
    evidenceRef,
    sensitivity: 'internal',
    version: 1,
    payload: {
      toolId: TOOL_ID,
      targetApp: 'musicscale',
      intent: input.intent,
      result: input.result,
      channel: input.channel,
      requiredCapability: input.requiredCapability,
      downstreamAuditId: input.downstreamAuditId?.trim() || undefined,
    },
  };
}

function maskActorId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const actorId = value.trim();
  if (!actorId) return undefined;
  if (actorId.length <= 6) return '***';
  return `${actorId.slice(0, 3)}***${actorId.slice(-3)}`;
}

function safeText(value: string, maxLength: number): string {
  return value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLength);
}

/**
 * Initial transport-neutral Fact Stream adapter.
 *
 * It deliberately uses structured PII-safe logging rather than introducing a
 * new database or event bus before the shared persistence contract is chosen.
 * A durable sink can replace this port without changing Connect Core.
 */
export class StructuredLogCoreFactPort implements CoreFactPort {
  constructor(private readonly logger: StructuredCoreAuditLogger = console) {}

  async record(event: CanonicalFactEvent): Promise<void> {
    this.logger.info('MILLIONSNEST_CANONICAL_FACT', {
      eventId: safeText(event.eventId, 260),
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      recordedAt: event.recordedAt,
      organizationId: safeText(event.organizationId, 180),
      actor: maskActorId(event.actorId),
      subjectRef: safeText(event.subjectRef, 220),
      sourceApp: event.sourceApp,
      scope: safeText(event.scope, 220),
      evidenceRef: safeText(event.evidenceRef, 260),
      sensitivity: event.sensitivity,
      version: event.version,
      payload: {
        toolId: safeText(event.payload.toolId, 160),
        targetApp: safeText(event.payload.targetApp, 80),
        intent: safeText(event.payload.intent, 120),
        result: event.payload.result,
        channel: safeText(event.payload.channel, 40),
        requiredCapability: event.payload.requiredCapability
          ? safeText(event.payload.requiredCapability, 120)
          : undefined,
        downstreamAuditId: event.payload.downstreamAuditId
          ? safeText(event.payload.downstreamAuditId, 180)
          : undefined,
      },
    });
  }
}
