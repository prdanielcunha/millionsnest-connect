export type ConnectCoreIntent = 'get_next_schedule' | 'unknown';

export type ConnectChannelType = 'inapp' | 'whatsapp' | 'instagram' | 'telegram' | string;

export interface ConnectCoreMessageRequest {
  requestId: string;
  correlationId: string;
  authToken?: string;
  requestedOrganizationId?: string;
  channel: {
    type: ConnectChannelType;
    conversationId: string;
  };
  locale: string;
  text: string;
}

export interface CanonicalCoreContext {
  actorUid: string;
  systemRole: string | null;
  globalAccess: boolean;
  organizationId: string;
  organizationRole: string | null;
  permissions: string[];
  capabilities: string[];
  appAccess: {
    musicscale: boolean;
  };
}

export type CanonicalContextResolution =
  | { status: 'resolved'; context: CanonicalCoreContext }
  | { status: 'identity_required'; reason: string }
  | { status: 'organization_required'; reason: string }
  | { status: 'denied'; reason: string };

export interface CanonicalContextProvider {
  resolve(input: {
    authToken: string;
    requestedOrganizationId?: string;
  }): Promise<CanonicalContextResolution>;
}

export type MusicScaleNextScheduleResult =
  | {
      status: 'success';
      data: unknown;
      humanSummary: string;
      auditId: string;
      deepLink?: string;
    }
  | {
      status: 'denied' | 'failed' | 'conflict';
      humanSummary: string;
      auditId?: string;
      retryable?: boolean;
    };

export interface MusicScaleReadToolPort {
  /**
   * This port represents the real server-side Tool Gateway boundary.
   * The adapter MUST revalidate identity, tenant and requiredPermission.
   * Connect Core passes canonical context as evidence; it does not grant authority.
   */
  getNextSchedule(input: {
    actorUid: string;
    systemRole: string | null;
    globalAccess: boolean;
    organizationId: string;
    organizationRole: string | null;
    permissions: string[];
    capabilities: string[];
    requiredPermission: 'musicscale.schedules.view';
    requestId: string;
    correlationId: string;
    channel: ConnectCoreMessageRequest['channel'];
    locale: string;
  }): Promise<MusicScaleNextScheduleResult>;
}

export interface CoreAuditEvent {
  eventType:
    | 'core_request_received'
    | 'core_request_denied'
    | 'core_tool_completed'
    | 'core_request_failed';
  requestId: string;
  correlationId: string;
  actorUid?: string;
  organizationId?: string;
  appId?: 'musicscale';
  intent: ConnectCoreIntent;
  channel: string;
  result: 'received' | 'success' | 'denied' | 'failed' | 'needs_context';
  details: string;
}

export interface CoreAuditPort {
  record(event: CoreAuditEvent): Promise<void>;
}

export type ConnectCoreResponse =
  | {
      status: 'success';
      intent: 'get_next_schedule';
      humanSummary: string;
      data: unknown;
      auditId: string;
      deepLink?: string;
    }
  | {
      status: 'needs_context' | 'denied' | 'unsupported' | 'failed';
      intent: ConnectCoreIntent;
      code:
        | 'AUTH_REQUIRED'
        | 'IDENTITY_REQUIRED'
        | 'ORGANIZATION_REQUIRED'
        | 'CONTEXT_MISMATCH'
        | 'APP_ACCESS_DENIED'
        | 'UNSUPPORTED_INTENT'
        | 'TOOL_DENIED'
        | 'TOOL_CONFLICT'
        | 'TOOL_FAILED'
        | 'AUDIT_UNAVAILABLE'
        | 'CORE_UNAVAILABLE';
      humanSummary: string;
      retryable?: boolean;
    };

const NEXT_SCHEDULE_PERMISSION = 'musicscale.schedules.view' as const;

function normalizeForIntent(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function resolveConnectCoreIntent(text: string): ConnectCoreIntent {
  const normalized = normalizeForIntent(text);

  const knownPhrases = [
    'qual e minha proxima escala',
    'qual minha proxima escala',
    'minha proxima escala',
    'what is my next schedule',
    'whats my next schedule',
    'my next schedule',
    'cual es mi proxima escala',
    'mi proxima escala',
  ];

  return knownPhrases.some((phrase) => normalized.includes(phrase))
    ? 'get_next_schedule'
    : 'unknown';
}

function safeReason(value: string): string {
  return value.trim().slice(0, 240) || 'Operação não autorizada.';
}

export class ConnectCoreService {
  constructor(
    private readonly contextProvider: CanonicalContextProvider,
    private readonly musicScaleReadTool: MusicScaleReadToolPort,
    private readonly audit: CoreAuditPort,
  ) {}

  async handleMessage(request: ConnectCoreMessageRequest): Promise<ConnectCoreResponse> {
    const intent = resolveConnectCoreIntent(request.text);

    if (!request.authToken?.trim()) {
      await this.tryAudit({
        eventType: 'core_request_denied',
        requestId: request.requestId,
        correlationId: request.correlationId,
        intent,
        channel: request.channel.type,
        result: 'needs_context',
        details: 'Authentication token was not provided.',
      });

      return {
        status: 'needs_context',
        intent,
        code: 'AUTH_REQUIRED',
        humanSummary: 'Antes de acessar informações da sua igreja, precisamos confirmar sua conta.',
      };
    }

    let resolution: CanonicalContextResolution;
    try {
      resolution = await this.contextProvider.resolve({
        authToken: request.authToken,
        requestedOrganizationId: request.requestedOrganizationId,
      });
    } catch {
      return {
        status: 'failed',
        intent,
        code: 'CORE_UNAVAILABLE',
        humanSummary: 'Não consegui confirmar sua conta agora. Tente novamente em instantes.',
        retryable: true,
      };
    }

    if (resolution.status !== 'resolved') {
      const code =
        resolution.status === 'identity_required'
          ? 'IDENTITY_REQUIRED'
          : resolution.status === 'organization_required'
            ? 'ORGANIZATION_REQUIRED'
            : 'APP_ACCESS_DENIED';

      await this.tryAudit({
        eventType: 'core_request_denied',
        requestId: request.requestId,
        correlationId: request.correlationId,
        intent,
        channel: request.channel.type,
        result: resolution.status === 'denied' ? 'denied' : 'needs_context',
        details: safeReason(resolution.reason),
      });

      return {
        status: resolution.status === 'denied' ? 'denied' : 'needs_context',
        intent,
        code,
        humanSummary: safeReason(resolution.reason),
      };
    }

    const { context } = resolution;

    if (
      request.requestedOrganizationId &&
      request.requestedOrganizationId !== context.organizationId
    ) {
      await this.tryAudit({
        eventType: 'core_request_denied',
        requestId: request.requestId,
        correlationId: request.correlationId,
        actorUid: context.actorUid,
        organizationId: context.organizationId,
        appId: 'musicscale',
        intent,
        channel: request.channel.type,
        result: 'denied',
        details: 'Requested organization does not match canonical resolved organization.',
      });

      return {
        status: 'denied',
        intent,
        code: 'CONTEXT_MISMATCH',
        humanSummary: 'A organização solicitada não corresponde ao contexto autorizado da sua conta.',
      };
    }

    if (!context.appAccess.musicscale) {
      await this.tryAudit({
        eventType: 'core_request_denied',
        requestId: request.requestId,
        correlationId: request.correlationId,
        actorUid: context.actorUid,
        organizationId: context.organizationId,
        appId: 'musicscale',
        intent,
        channel: request.channel.type,
        result: 'denied',
        details: 'Canonical context denied MusicScale app access.',
      });

      return {
        status: 'denied',
        intent,
        code: 'APP_ACCESS_DENIED',
        humanSummary: 'Sua conta não possui acesso ao MusicScale nesta organização.',
      };
    }

    if (intent !== 'get_next_schedule') {
      await this.tryAudit({
        eventType: 'core_request_denied',
        requestId: request.requestId,
        correlationId: request.correlationId,
        actorUid: context.actorUid,
        organizationId: context.organizationId,
        intent,
        channel: request.channel.type,
        result: 'denied',
        details: 'Intent is not part of the first production vertical.',
      });

      return {
        status: 'unsupported',
        intent,
        code: 'UNSUPPORTED_INTENT',
        humanSummary: 'Ainda não consigo resolver esse pedido por aqui.',
      };
    }

    const auditReady = await this.tryAudit({
      eventType: 'core_request_received',
      requestId: request.requestId,
      correlationId: request.correlationId,
      actorUid: context.actorUid,
      organizationId: context.organizationId,
      appId: 'musicscale',
      intent,
      channel: request.channel.type,
      result: 'received',
      details: 'Authenticated read-only MusicScale request accepted by Connect Core.',
    });

    if (!auditReady) {
      return {
        status: 'failed',
        intent,
        code: 'AUDIT_UNAVAILABLE',
        humanSummary: 'Não consegui registrar esta consulta com segurança. Tente novamente em instantes.',
        retryable: true,
      };
    }

    let toolResult: MusicScaleNextScheduleResult;
    try {
      toolResult = await this.musicScaleReadTool.getNextSchedule({
        actorUid: context.actorUid,
        systemRole: context.systemRole,
        globalAccess: context.globalAccess,
        organizationId: context.organizationId,
        organizationRole: context.organizationRole,
        permissions: [...context.permissions],
        capabilities: [...context.capabilities],
        requiredPermission: NEXT_SCHEDULE_PERMISSION,
        requestId: request.requestId,
        correlationId: request.correlationId,
        channel: request.channel,
        locale: request.locale,
      });
    } catch {
      await this.tryAudit({
        eventType: 'core_request_failed',
        requestId: request.requestId,
        correlationId: request.correlationId,
        actorUid: context.actorUid,
        organizationId: context.organizationId,
        appId: 'musicscale',
        intent,
        channel: request.channel.type,
        result: 'failed',
        details: 'MusicScale read tool threw an unexpected error.',
      });

      return {
        status: 'failed',
        intent,
        code: 'TOOL_FAILED',
        humanSummary: 'Não consegui consultar o MusicScale agora. Tente novamente em instantes.',
        retryable: true,
      };
    }

    const completionAudited = await this.tryAudit({
      eventType: toolResult.status === 'success' ? 'core_tool_completed' : 'core_request_failed',
      requestId: request.requestId,
      correlationId: request.correlationId,
      actorUid: context.actorUid,
      organizationId: context.organizationId,
      appId: 'musicscale',
      intent,
      channel: request.channel.type,
      result: toolResult.status === 'success' ? 'success' : toolResult.status === 'denied' ? 'denied' : 'failed',
      details: `MusicScale read tool completed with status ${toolResult.status}.`,
    });

    if (!completionAudited) {
      return {
        status: 'failed',
        intent,
        code: 'AUDIT_UNAVAILABLE',
        humanSummary: 'A consulta terminou, mas não consegui registrar o resultado com segurança.',
        retryable: true,
      };
    }

    if (toolResult.status === 'success') {
      return {
        status: 'success',
        intent,
        humanSummary: toolResult.humanSummary,
        data: toolResult.data,
        auditId: toolResult.auditId,
        deepLink: toolResult.deepLink,
      };
    }

    return {
      status: toolResult.status === 'denied' ? 'denied' : 'failed',
      intent,
      code:
        toolResult.status === 'denied'
          ? 'TOOL_DENIED'
          : toolResult.status === 'conflict'
            ? 'TOOL_CONFLICT'
            : 'TOOL_FAILED',
      humanSummary: safeReason(toolResult.humanSummary),
      retryable: toolResult.retryable,
    };
  }

  private async tryAudit(event: CoreAuditEvent): Promise<boolean> {
    try {
      await this.audit.record(event);
      return true;
    } catch {
      return false;
    }
  }
}
