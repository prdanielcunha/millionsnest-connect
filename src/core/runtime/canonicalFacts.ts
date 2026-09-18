import type { MusicScaleReadToolPort } from './connectCore';
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

/**
 * Fan-out adapter used by the P1 foundation so one canonical fact can feed
 * observability and deterministic projections without coupling the Core to a
 * specific database/event-bus implementation.
 *
 * All sinks are attempted. If one or more fail, the caller receives a failure
 * after the other sinks had a chance to record the same event. The existing
 * FactRecording decorator remains fail-open for the user-facing read flow.
 */
export class CoreFactFanoutPort implements CoreFactPort {
  constructor(private readonly ports: CoreFactPort[]) {}

  async record(event: CanonicalFactEvent): Promise<void> {
    if (this.ports.length === 0) return;
    const results = await Promise.allSettled(
      this.ports.map((port) => port.record(event)),
    );
    if (results.some((result) => result.status === 'rejected')) {
      throw new Error('CORE_FACT_FANOUT_PARTIAL_FAILURE');
    }
  }
}

/**
 * Decorates the existing real MusicScale tool boundary with canonical facts.
 *
 * Fact recording is deliberately fail-open in this first slice: audit remains
 * fail-closed in Connect Core, while the Fact Stream starts as an additional
 * observable contract that cannot regress the already-working read flow.
 */
export class FactRecordingMusicScaleReadTool implements MusicScaleReadToolPort {
  constructor(
    private readonly delegate: MusicScaleReadToolPort,
    private readonly facts: CoreFactPort,
    private readonly logger: StructuredCoreAuditLogger = console,
  ) {}

  async getNextSchedule(
    input: Parameters<MusicScaleReadToolPort['getNextSchedule']>[0],
  ): ReturnType<MusicScaleReadToolPort['getNextSchedule']> {
    await this.tryRecord(createToolActionFact({
      eventType: 'TOOL_ACTION_REQUESTED',
      requestId: input.requestId,
      organizationId: input.organizationId,
      actorId: input.actorUid,
      intent: 'get_next_schedule',
      channel: input.channel.type,
      result: 'requested',
      requiredCapability: input.requiredCapability,
    }));

    try {
      const result = await this.delegate.getNextSchedule(input);

      await this.tryRecord(createToolActionFact({
        eventType: 'TOOL_ACTION_COMPLETED',
        requestId: input.requestId,
        organizationId: input.organizationId,
        actorId: input.actorUid,
        intent: 'get_next_schedule',
        channel: input.channel.type,
        result: result.status,
        requiredCapability: input.requiredCapability,
        downstreamAuditId: result.auditId,
      }));

      return result;
    } catch (error) {
      await this.tryRecord(createToolActionFact({
        eventType: 'TOOL_ACTION_COMPLETED',
        requestId: input.requestId,
        organizationId: input.organizationId,
        actorId: input.actorUid,
        intent: 'get_next_schedule',
        channel: input.channel.type,
        result: 'failed',
        requiredCapability: input.requiredCapability,
      }));
      throw error;
    }
  }

  private async tryRecord(event: CanonicalFactEvent): Promise<void> {
    try {
      await this.facts.record(event);
    } catch {
      try {
        this.logger.error?.('CONNECT_FACT_RECORD_FAILED', {
          eventId: safeText(event.eventId, 260),
          eventType: event.eventType,
          organizationId: safeText(event.organizationId, 180),
          sourceApp: event.sourceApp,
        });
      } catch {
        // Fact observability must not become a new failure mode in this slice.
      }
    }
  }
}
