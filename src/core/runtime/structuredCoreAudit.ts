import { CoreAuditEvent, CoreAuditPort } from './connectCore';

export interface StructuredCoreAuditLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error?(message: string, meta?: Record<string, unknown>): void;
}

function maskActorUid(uid: string | undefined): string | undefined {
  if (!uid) return undefined;
  const value = uid.trim();
  if (!value) return undefined;
  if (value.length <= 6) return '***';
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

function safeText(value: string, maxLength: number): string {
  return value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLength);
}

/**
 * Initial production-neutral audit adapter for the first Connect Core vertical.
 *
 * It deliberately does not persist raw credentials, message content, email,
 * phone or the full actor uid. A durable audit store can replace this port
 * later without changing the Core contract.
 */
export class StructuredLogCoreAuditPort implements CoreAuditPort {
  constructor(private readonly logger: StructuredCoreAuditLogger = console) {}

  async record(event: CoreAuditEvent): Promise<void> {
    this.logger.info('CONNECT_CORE_AUDIT', {
      eventType: event.eventType,
      requestId: safeText(event.requestId, 120),
      correlationId: safeText(event.correlationId, 120),
      actor: maskActorUid(event.actorUid),
      organizationId: event.organizationId
        ? safeText(event.organizationId, 160)
        : undefined,
      appId: event.appId,
      intent: event.intent,
      channel: safeText(event.channel, 40),
      result: event.result,
      details: safeText(event.details, 240),
    });
  }
}
