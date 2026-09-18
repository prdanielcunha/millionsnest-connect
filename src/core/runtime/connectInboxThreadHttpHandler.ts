import express from 'express';
import type {
  CanonicalContextProvider,
  CanonicalContextResolution,
} from './connectCore';
import {
  evaluateConnectInboxAuthority,
} from '../inbox/inboxAuthority';
import {
  ConnectThreadCommandService,
} from '../inbox/threadService';
import type {
  ConnectThreadStore,
} from '../inbox/threadStore';

export interface ConnectInboxThreadHttpHandlerOptions {
  contextProvider: CanonicalContextProvider;
  store: ConnectThreadStore;
}

type InboxCommandAction =
  | 'assign'
  | 'handoff'
  | 'wait_for_person'
  | 'resolve'
  | 'reopen'
  | 'archive';

const COMMAND_FIELDS = new Set([
  'organizationId',
  'action',
  'requestId',
  'evidenceRef',
  'assigneeType',
  'assigneeRef',
  'reasonCode',
]);

function bearerFromRequest(req: express.Request): string {
  const value = req.headers.authorization;
  return typeof value === 'string' && /^Bearer\s+\S+$/i.test(value.trim())
    ? value.trim()
    : '';
}

function safeScopedId(value: unknown, maxLength = 180): string {
  if (typeof value !== 'string') return '';
  const clean = value.trim();
  if (
    !clean ||
    clean.length > maxLength ||
    clean.includes('/') ||
    clean.includes('\\')
  ) {
    return '';
  }
  return clean;
}

function safeRef(value: unknown, maxLength = 260): string {
  if (typeof value !== 'string') return '';
  const clean = value.trim();
  return /^[a-zA-Z0-9._:/-]{3,260}$/.test(clean)
    ? clean.slice(0, maxLength)
    : '';
}

function safeReasonCode(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  if (!clean || !/^[a-zA-Z0-9._:-]{2,120}$/.test(clean)) return undefined;
  return clean;
}

function resolveStatus(resolution: CanonicalContextResolution): {
  status: number;
  code: string;
  summary: string;
} {
  if (resolution.status === 'identity_required') {
    return {
      status: 401,
      code: 'IDENTITY_REQUIRED',
      summary: 'Sua sessão precisa ser confirmada novamente.',
    };
  }
  if (resolution.status === 'organization_required') {
    return {
      status: 400,
      code: 'ORGANIZATION_REQUIRED',
      summary: 'Selecione uma organização válida no MillionsNest.',
    };
  }
  return {
    status: 403,
    code: 'INBOX_ACCESS_DENIED',
    summary: 'Sua conta não está autorizada a acessar esta caixa de entrada.',
  };
}

async function resolveAuthorizedContext(
  req: express.Request,
  res: express.Response,
  options: ConnectInboxThreadHttpHandlerOptions,
  organizationId: string,
  action: 'read' | 'manage',
) {
  const authorization = bearerFromRequest(req);
  if (!authorization) {
    res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED',
      humanSummary: 'Sua sessão precisa ser confirmada novamente.',
    });
    return null;
  }

  let resolution: CanonicalContextResolution;
  try {
    resolution = await options.contextProvider.resolve({
      authToken: authorization,
      requestedOrganizationId: organizationId,
    });
  } catch {
    res.status(503).json({
      success: false,
      code: 'CANONICAL_CONTEXT_UNAVAILABLE',
      humanSummary: 'Não foi possível confirmar sua autorização agora.',
    });
    return null;
  }

  if (resolution.status !== 'resolved') {
    const mapped = resolveStatus(resolution);
    res.status(mapped.status).json({
      success: false,
      code: mapped.code,
      humanSummary: mapped.summary,
    });
    return null;
  }

  if (resolution.context.organizationId !== organizationId) {
    res.status(409).json({
      success: false,
      code: 'ORGANIZATION_CONTEXT_MISMATCH',
      humanSummary: 'A organização ativa mudou. Abra o Connect novamente pelo MillionsNest.',
    });
    return null;
  }

  const decision = evaluateConnectInboxAuthority(resolution.context, action);
  if (!decision.allowed) {
    res.status(403).json({
      success: false,
      code: decision.reason,
      humanSummary: action === 'read'
        ? 'Você não possui acesso à caixa de entrada desta organização.'
        : 'Você não possui permissão para alterar esta conversa.',
    });
    return null;
  }

  return resolution.context;
}

function mapCommandError(error: unknown): {
  status: number;
  code: string;
  summary: string;
} {
  const code = error instanceof Error ? error.message : 'INBOX_COMMAND_FAILED';

  if (
    code === 'THREAD_VERSION_CONFLICT' ||
    code === 'EVENT_ID_COLLISION' ||
    code === 'THREAD_MUST_REOPEN' ||
    code === 'THREAD_MUST_BE_RESOLVED_BEFORE_ARCHIVE' ||
    code === 'ONLY_RESOLVED_THREAD_CAN_REOPEN' ||
    code === 'ARCHIVED_THREAD_IMMUTABLE'
  ) {
    return {
      status: 409,
      code,
      summary: 'A conversa mudou enquanto você agia. Atualize o contexto e tente novamente.',
    };
  }

  if (
    code === 'ASSIGNEE_REQUIRED' ||
    code === 'INVALID_EXPECTED_VERSION' ||
    code.startsWith('INVALID_')
  ) {
    return {
      status: 400,
      code,
      summary: 'Os dados da ação não são válidos.',
    };
  }

  return {
    status: 503,
    code: 'INBOX_COMMAND_FAILED',
    summary: 'Não foi possível concluir esta ação agora.',
  };
}

function setPrivateResponseHeaders(res: express.Response): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
}

export function createConnectInboxThreadReadHttpHandler(
  options: ConnectInboxThreadHttpHandlerOptions,
) {
  return async function connectInboxThreadReadHttpHandler(
    req: express.Request,
    res: express.Response,
  ) {
    setPrivateResponseHeaders(res);

    const organizationId = safeScopedId(req.query.organizationId);
    const conversationId = safeScopedId(req.params.conversationId);

    if (!organizationId || !conversationId) {
      return res.status(400).json({
        success: false,
        code: 'INBOX_SCOPE_REQUIRED',
        humanSummary: 'Organização e conversa válidas são obrigatórias.',
      });
    }

    const context = await resolveAuthorizedContext(
      req,
      res,
      options,
      organizationId,
      'read',
    );
    if (!context) return;

    const projection = await options.store.load({
      organizationId: context.organizationId,
      conversationId,
    });

    if (!projection) {
      return res.status(404).json({
        success: false,
        code: 'THREAD_NOT_FOUND',
        humanSummary: 'Esta conversa ainda não existe na caixa de entrada.',
      });
    }

    return res.status(200).json({
      success: true,
      thread: projection,
    });
  };
}

export function createConnectInboxThreadCommandHttpHandler(
  options: ConnectInboxThreadHttpHandlerOptions,
) {
  const service = new ConnectThreadCommandService(options.store);

  return async function connectInboxThreadCommandHttpHandler(
    req: express.Request,
    res: express.Response,
  ) {
    setPrivateResponseHeaders(res);

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_REQUEST',
        humanSummary: 'A ação enviada não é válida.',
      });
    }

    const body = req.body as Record<string, unknown>;
    const unknownFields = Object.keys(body).filter((key) => !COMMAND_FIELDS.has(key));
    if (unknownFields.length > 0) {
      return res.status(400).json({
        success: false,
        code: 'UNKNOWN_FIELD',
        humanSummary: 'A ação contém campos que não são aceitos.',
      });
    }

    const organizationId = safeScopedId(body.organizationId);
    const conversationId = safeScopedId(req.params.conversationId);
    const requestId = safeScopedId(body.requestId);
    const evidenceRef = safeRef(body.evidenceRef);
    const action = typeof body.action === 'string'
      ? body.action.trim() as InboxCommandAction
      : '';
    const reasonCode = safeReasonCode(body.reasonCode);

    const allowedActions = new Set<InboxCommandAction>([
      'assign',
      'handoff',
      'wait_for_person',
      'resolve',
      'reopen',
      'archive',
    ]);

    if (
      !organizationId ||
      !conversationId ||
      !requestId ||
      !evidenceRef ||
      !allowedActions.has(action as InboxCommandAction) ||
      (body.reasonCode !== undefined && !reasonCode)
    ) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_REQUEST',
        humanSummary: 'A ação enviada não é válida.',
      });
    }

    const context = await resolveAuthorizedContext(
      req,
      res,
      options,
      organizationId,
      'manage',
    );
    if (!context) return;

    const base = {
      requestId,
      organizationId: context.organizationId,
      conversationId,
      evidenceRef,
      reasonCode,
    };

    try {
      let result;
      if (action === 'assign' || action === 'handoff') {
        const assigneeType =
          body.assigneeType === 'user' || body.assigneeType === 'team'
            ? body.assigneeType
            : null;
        const assigneeRef = safeScopedId(body.assigneeRef);
        if (!assigneeType || !assigneeRef) {
          return res.status(400).json({
            success: false,
            code: 'ASSIGNEE_REQUIRED',
            humanSummary: 'Selecione uma pessoa ou equipe válida para esta ação.',
          });
        }

        result = action === 'assign'
          ? await service.assign({ ...base, assigneeType, assigneeRef })
          : await service.handoff({ ...base, assigneeType, assigneeRef });
      } else if (action === 'wait_for_person') {
        result = await service.waitForPerson(base);
      } else if (action === 'resolve') {
        result = await service.resolve(base);
      } else if (action === 'reopen') {
        result = await service.reopen(base);
      } else {
        result = await service.archive(base);
      }

      return res.status(200).json({
        success: true,
        outcome: result.kind,
        thread: result.projection,
      });
    } catch (error) {
      const mapped = mapCommandError(error);
      return res.status(mapped.status).json({
        success: false,
        code: mapped.code,
        humanSummary: mapped.summary,
      });
    }
  };
}
