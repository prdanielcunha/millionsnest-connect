var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_dotenv = __toESM(require("dotenv"), 1);

// src/server/createConnectServer.ts
var import_express2 = __toESM(require("express"), 1);

// src/core/runtime/connectCoreHttpHandler.ts
var import_node_crypto = __toESM(require("node:crypto"), 1);
var MAX_MESSAGE_CHARS = 4e3;
var MAX_ORG_ID_CHARS = 180;
var MAX_CONVERSATION_ID_CHARS = 180;
function headerValue(value) {
  if (Array.isArray(value)) return value[0]?.trim() || "";
  return typeof value === "string" ? value.trim() : "";
}
function getHeader(req, name) {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (key.toLowerCase() === target) return headerValue(value);
  }
  return "";
}
function bodyObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function cleanString(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
function normalizeLocale(value) {
  const locale = cleanString(value, 32).toLowerCase();
  if (locale.startsWith("en")) return "en";
  if (locale.startsWith("es")) return "es";
  return "pt-BR";
}
function responseStatus(result) {
  if (result.status === "success") return 200;
  if (result.status === "unsupported") return 400;
  if (result.status === "denied") return 403;
  if (result.code === "AUTH_REQUIRED" || result.code === "IDENTITY_REQUIRED") return 401;
  if (result.code === "ORGANIZATION_REQUIRED" || result.code === "TOOL_CONFLICT") return 409;
  return 503;
}
function createConnectCoreHttpHandler(core, options = {}) {
  const createRequestId = options.createRequestId ?? (() => `core-${import_node_crypto.default.randomUUID()}`);
  const createCorrelationId = options.createCorrelationId ?? (() => `cor-${import_node_crypto.default.randomUUID()}`);
  return async function handleConnectCoreRequest(req, res) {
    res.setHeader?.("Cache-Control", "no-store");
    const requestId = createRequestId();
    const correlationId = createCorrelationId();
    const authorization = getHeader(req, "authorization");
    if (!authorization || !/^Bearer\s+\S+/i.test(authorization)) {
      return res.status(401).json({
        status: "needs_context",
        code: "AUTH_REQUIRED",
        humanSummary: "Antes de acessar informa\xE7\xF5es da sua igreja, precisamos confirmar sua conta.",
        requestId,
        correlationId
      });
    }
    const body = bodyObject(req.body);
    const text = cleanString(body.text, MAX_MESSAGE_CHARS);
    if (!text) {
      return res.status(400).json({
        status: "unsupported",
        code: "MESSAGE_REQUIRED",
        humanSummary: "Escreva o que voc\xEA precisa para eu poder ajudar.",
        requestId,
        correlationId
      });
    }
    const requestedOrganizationId = cleanString(
      body.requestedOrganizationId,
      MAX_ORG_ID_CHARS
    );
    const conversationId = cleanString(body.conversationId, MAX_CONVERSATION_ID_CHARS) || `inapp-${requestId}`;
    try {
      const result = await core.handleMessage({
        requestId,
        correlationId,
        authToken: authorization,
        requestedOrganizationId: requestedOrganizationId || void 0,
        channel: {
          type: "inapp",
          conversationId
        },
        locale: normalizeLocale(body.locale),
        text
      });
      return res.status(responseStatus(result)).json({
        ...result,
        requestId,
        correlationId
      });
    } catch {
      return res.status(503).json({
        status: "failed",
        code: "CORE_UNAVAILABLE",
        humanSummary: "N\xE3o consegui concluir essa consulta agora. Tente novamente em instantes.",
        requestId,
        correlationId
      });
    }
  };
}

// src/core/runtime/connectCore.ts
var NEXT_SCHEDULE_CAPABILITY = "scales.read";
function normalizeForIntent(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}
function resolveConnectCoreIntent(text) {
  const normalized = normalizeForIntent(text);
  const knownPhrases = [
    "qual e minha proxima escala",
    "qual minha proxima escala",
    "minha proxima escala",
    "what is my next schedule",
    "whats my next schedule",
    "my next schedule",
    "cual es mi proxima escala",
    "mi proxima escala"
  ];
  return knownPhrases.some((phrase) => normalized.includes(phrase)) ? "get_next_schedule" : "unknown";
}
function safeReason(value) {
  return value.trim().slice(0, 240) || "Opera\xE7\xE3o n\xE3o autorizada.";
}
var ConnectCoreService = class {
  constructor(contextProvider, musicScaleReadTool, audit) {
    this.contextProvider = contextProvider;
    this.musicScaleReadTool = musicScaleReadTool;
    this.audit = audit;
  }
  async handleMessage(request) {
    const intent = resolveConnectCoreIntent(request.text);
    if (!request.authToken?.trim()) {
      await this.tryAudit({
        eventType: "core_request_denied",
        requestId: request.requestId,
        correlationId: request.correlationId,
        intent,
        channel: request.channel.type,
        result: "needs_context",
        details: "Authentication token was not provided."
      });
      return {
        status: "needs_context",
        intent,
        code: "AUTH_REQUIRED",
        humanSummary: "Antes de acessar informa\xE7\xF5es da sua igreja, precisamos confirmar sua conta."
      };
    }
    let resolution;
    try {
      resolution = await this.contextProvider.resolve({
        authToken: request.authToken,
        requestedOrganizationId: request.requestedOrganizationId
      });
    } catch {
      return {
        status: "failed",
        intent,
        code: "CORE_UNAVAILABLE",
        humanSummary: "N\xE3o consegui confirmar sua conta agora. Tente novamente em instantes.",
        retryable: true
      };
    }
    if (resolution.status !== "resolved") {
      const code = resolution.status === "identity_required" ? "IDENTITY_REQUIRED" : resolution.status === "organization_required" ? "ORGANIZATION_REQUIRED" : "APP_ACCESS_DENIED";
      await this.tryAudit({
        eventType: "core_request_denied",
        requestId: request.requestId,
        correlationId: request.correlationId,
        intent,
        channel: request.channel.type,
        result: resolution.status === "denied" ? "denied" : "needs_context",
        details: safeReason(resolution.reason)
      });
      return {
        status: resolution.status === "denied" ? "denied" : "needs_context",
        intent,
        code,
        humanSummary: safeReason(resolution.reason)
      };
    }
    const { context } = resolution;
    if (request.requestedOrganizationId && request.requestedOrganizationId !== context.organizationId) {
      await this.tryAudit({
        eventType: "core_request_denied",
        requestId: request.requestId,
        correlationId: request.correlationId,
        actorUid: context.actorUid,
        organizationId: context.organizationId,
        appId: "musicscale",
        intent,
        channel: request.channel.type,
        result: "denied",
        details: "Requested organization does not match canonical resolved organization."
      });
      return {
        status: "denied",
        intent,
        code: "CONTEXT_MISMATCH",
        humanSummary: "A organiza\xE7\xE3o solicitada n\xE3o corresponde ao contexto autorizado da sua conta."
      };
    }
    if (!context.appAccess.musicscale) {
      await this.tryAudit({
        eventType: "core_request_denied",
        requestId: request.requestId,
        correlationId: request.correlationId,
        actorUid: context.actorUid,
        organizationId: context.organizationId,
        appId: "musicscale",
        intent,
        channel: request.channel.type,
        result: "denied",
        details: "Canonical context denied MusicScale app access."
      });
      return {
        status: "denied",
        intent,
        code: "APP_ACCESS_DENIED",
        humanSummary: "Sua conta n\xE3o possui acesso ao MusicScale nesta organiza\xE7\xE3o."
      };
    }
    if (intent !== "get_next_schedule") {
      await this.tryAudit({
        eventType: "core_request_denied",
        requestId: request.requestId,
        correlationId: request.correlationId,
        actorUid: context.actorUid,
        organizationId: context.organizationId,
        intent,
        channel: request.channel.type,
        result: "denied",
        details: "Intent is not part of the first production vertical."
      });
      return {
        status: "unsupported",
        intent,
        code: "UNSUPPORTED_INTENT",
        humanSummary: "Ainda n\xE3o consigo resolver esse pedido por aqui."
      };
    }
    const auditReady = await this.tryAudit({
      eventType: "core_request_received",
      requestId: request.requestId,
      correlationId: request.correlationId,
      actorUid: context.actorUid,
      organizationId: context.organizationId,
      appId: "musicscale",
      intent,
      channel: request.channel.type,
      result: "received",
      details: "Authenticated read-only MusicScale request accepted by Connect Core."
    });
    if (!auditReady) {
      return {
        status: "failed",
        intent,
        code: "AUDIT_UNAVAILABLE",
        humanSummary: "N\xE3o consegui registrar esta consulta com seguran\xE7a. Tente novamente em instantes.",
        retryable: true
      };
    }
    let toolResult;
    try {
      toolResult = await this.musicScaleReadTool.getNextSchedule({
        authToken: request.authToken,
        actorUid: context.actorUid,
        systemRole: context.systemRole,
        globalAccess: context.globalAccess,
        organizationId: context.organizationId,
        organizationRole: context.organizationRole,
        permissions: [...context.permissions],
        capabilities: [...context.capabilities],
        requiredCapability: NEXT_SCHEDULE_CAPABILITY,
        requestId: request.requestId,
        correlationId: request.correlationId,
        channel: request.channel,
        locale: request.locale
      });
    } catch {
      await this.tryAudit({
        eventType: "core_request_failed",
        requestId: request.requestId,
        correlationId: request.correlationId,
        actorUid: context.actorUid,
        organizationId: context.organizationId,
        appId: "musicscale",
        intent,
        channel: request.channel.type,
        result: "failed",
        details: "MusicScale read tool threw an unexpected error."
      });
      return {
        status: "failed",
        intent,
        code: "TOOL_FAILED",
        humanSummary: "N\xE3o consegui consultar o MusicScale agora. Tente novamente em instantes.",
        retryable: true
      };
    }
    const completionAudited = await this.tryAudit({
      eventType: toolResult.status === "success" ? "core_tool_completed" : "core_request_failed",
      requestId: request.requestId,
      correlationId: request.correlationId,
      actorUid: context.actorUid,
      organizationId: context.organizationId,
      appId: "musicscale",
      intent,
      channel: request.channel.type,
      result: toolResult.status === "success" ? "success" : toolResult.status === "denied" ? "denied" : "failed",
      details: `MusicScale read tool completed with status ${toolResult.status}.`
    });
    if (!completionAudited) {
      return {
        status: "failed",
        intent,
        code: "AUDIT_UNAVAILABLE",
        humanSummary: "A consulta terminou, mas n\xE3o consegui registrar o resultado com seguran\xE7a.",
        retryable: true
      };
    }
    if (toolResult.status === "success") {
      return {
        status: "success",
        intent,
        humanSummary: toolResult.humanSummary,
        data: toolResult.data,
        auditId: toolResult.auditId,
        deepLink: toolResult.deepLink
      };
    }
    return {
      status: toolResult.status === "denied" ? "denied" : "failed",
      intent,
      code: toolResult.status === "denied" ? "TOOL_DENIED" : toolResult.status === "conflict" ? "TOOL_CONFLICT" : "TOOL_FAILED",
      humanSummary: safeReason(toolResult.humanSummary),
      retryable: toolResult.retryable
    };
  }
  async tryAudit(event) {
    try {
      await this.audit.record(event);
      return true;
    } catch {
      return false;
    }
  }
};

// src/core/runtime/hubSessionContextAdapter.ts
function uniqueStrings(...groups) {
  return Array.from(
    new Set(
      groups.flatMap((group) => group ?? []).map((value) => value.trim()).filter(Boolean)
    )
  );
}
function mapHubConnectSessionContext(payload) {
  if (!payload.success || !payload.user?.uid) {
    return {
      status: "identity_required",
      reason: "Antes de acessar informa\xE7\xF5es da sua igreja, precisamos confirmar sua conta."
    };
  }
  const activeOrganization = payload.activeOrganization;
  const activeOrganizationId = payload.activeOrganizationId;
  if (!activeOrganization || !activeOrganizationId) {
    return {
      status: "organization_required",
      reason: "De qual igreja/organiza\xE7\xE3o voc\xEA est\xE1 falando?"
    };
  }
  if (activeOrganization.id !== activeOrganizationId) {
    return {
      status: "denied",
      reason: "O contexto da organiza\xE7\xE3o retornado pelo Hub est\xE1 inconsistente."
    };
  }
  const musicScaleAccess = payload.appAccess?.musicscale;
  if (musicScaleAccess && musicScaleAccess.organizationId !== activeOrganizationId) {
    return {
      status: "denied",
      reason: "O acesso do MusicScale n\xE3o corresponde \xE0 organiza\xE7\xE3o ativa."
    };
  }
  const context = {
    actorUid: payload.user.uid,
    systemRole: payload.user.systemRole ?? null,
    globalAccess: payload.globalAccess === true,
    organizationId: activeOrganizationId,
    organizationRole: activeOrganization.organizationRole ?? null,
    permissions: uniqueStrings(activeOrganization.permissions),
    capabilities: uniqueStrings(
      payload.user.capabilities,
      activeOrganization.capabilities
    ),
    appAccess: {
      musicscale: musicScaleAccess?.accessible === true && musicScaleAccess.decisionState === "granted"
    }
  };
  return { status: "resolved", context };
}

// src/core/runtime/hubSessionContextHttpProvider.ts
var HUB_SESSION_CONTEXT_PATH = "/api/ecosystem/connect/session-context";
var DEFAULT_TIMEOUT_MS = 8e3;
function normalizeHubOrigin(rawOrigin) {
  const trimmed = rawOrigin.trim();
  if (!trimmed) {
    throw new Error("MILLIONSNEST_HUB_ORIGIN is required.");
  }
  const parsed = new URL(trimmed);
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("MILLIONSNEST_HUB_ORIGIN must use http or https.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("MILLIONSNEST_HUB_ORIGIN must not contain credentials.");
  }
  return parsed.origin;
}
function normalizeAuthorizationHeader(authToken2) {
  const trimmed = authToken2.trim();
  if (!trimmed) return "";
  return /^bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}
function isHubPayload(value) {
  return Boolean(
    value && typeof value === "object" && "success" in value && typeof value.success === "boolean"
  );
}
var HubSessionContextHttpProvider = class {
  constructor(options) {
    const origin = normalizeHubOrigin(options.hubOrigin);
    this.endpoint = new URL(HUB_SESSION_CONTEXT_PATH, origin).toString();
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.timeoutMs = Math.max(1e3, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  }
  async resolve(input) {
    const authorization = normalizeAuthorizationHeader(input.authToken);
    if (!authorization) {
      return {
        status: "identity_required",
        reason: "Antes de acessar informa\xE7\xF5es da sua igreja, precisamos confirmar sua conta."
      };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: "GET",
        headers: {
          Authorization: authorization,
          Accept: "application/json"
        },
        signal: controller.signal
      });
      if (response.status === 401 || response.status === 404) {
        return {
          status: "identity_required",
          reason: "Antes de acessar informa\xE7\xF5es da sua igreja, precisamos confirmar sua conta."
        };
      }
      if (response.status === 403) {
        return {
          status: "denied",
          reason: "Sua conta n\xE3o est\xE1 autorizada a acessar este contexto."
        };
      }
      if (!response.ok) {
        throw new Error(`Hub session context failed with status ${response.status}.`);
      }
      const payload = await response.json();
      if (!isHubPayload(payload)) {
        throw new Error("Hub session context returned an invalid payload.");
      }
      const resolution = mapHubConnectSessionContext(payload);
      if (resolution.status === "resolved" && input.requestedOrganizationId && resolution.context.organizationId !== input.requestedOrganizationId) {
        return {
          status: "organization_required",
          reason: "De qual igreja/organiza\xE7\xE3o voc\xEA est\xE1 falando?"
        };
      }
      return resolution;
    } finally {
      clearTimeout(timeout);
    }
  }
};

// src/core/runtime/musicScaleNextScheduleHttpTool.ts
var MUSIC_SCALE_NEXT_SCHEDULE_PATH = "/api/v1/connect/next-schedule";
var DEFAULT_TIMEOUT_MS2 = 8e3;
function normalizeOrigin(rawOrigin) {
  const trimmed = rawOrigin.trim();
  if (!trimmed) throw new Error("MUSICSCALE_ORIGIN is required.");
  const parsed = new URL(trimmed);
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("MUSICSCALE_ORIGIN must use http or https.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("MUSICSCALE_ORIGIN must not contain credentials.");
  }
  return parsed.origin;
}
function normalizeAuthorizationHeader2(authToken2) {
  const trimmed = authToken2.trim();
  if (!trimmed) return "";
  return /^bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}
function safeSummary(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 300) : fallback;
}
function isPayload(value) {
  return Boolean(
    value && typeof value === "object" && "success" in value && typeof value.success === "boolean"
  );
}
var MusicScaleNextScheduleHttpTool = class {
  constructor(options) {
    const origin = normalizeOrigin(options.musicScaleOrigin);
    this.endpoint = new URL(MUSIC_SCALE_NEXT_SCHEDULE_PATH, origin).toString();
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.timeoutMs = Math.max(1e3, options.timeoutMs ?? DEFAULT_TIMEOUT_MS2);
  }
  async getNextSchedule(input) {
    const authorization = normalizeAuthorizationHeader2(input.authToken);
    if (!authorization) {
      return {
        status: "denied",
        humanSummary: "Antes de consultar o MusicScale, precisamos confirmar sua conta."
      };
    }
    if (!input.organizationId.trim()) {
      return {
        status: "conflict",
        humanSummary: "De qual igreja/organiza\xE7\xE3o voc\xEA est\xE1 falando?"
      };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: "GET",
        headers: {
          Authorization: authorization,
          "X-Connect-User-Authorization": authorization,
          "X-Organization-Id": input.organizationId,
          "X-Request-Id": input.requestId,
          "X-Correlation-Id": input.correlationId,
          "Accept-Language": input.locale || "pt-BR",
          Accept: "application/json"
        },
        signal: controller.signal
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (response.status === 401 || response.status === 403) {
        return {
          status: "denied",
          humanSummary: safeSummary(
            isPayload(payload) ? payload.humanSummary : null,
            "O MusicScale negou acesso a essa informa\xE7\xE3o."
          ),
          auditId: isPayload(payload) ? payload.auditId : void 0
        };
      }
      if (response.status === 400 || response.status === 409) {
        return {
          status: "conflict",
          humanSummary: safeSummary(
            isPayload(payload) ? payload.humanSummary : null,
            "N\xE3o foi poss\xEDvel resolver o contexto da organiza\xE7\xE3o para esta consulta."
          ),
          auditId: isPayload(payload) ? payload.auditId : void 0
        };
      }
      if (!response.ok) {
        return {
          status: "failed",
          humanSummary: "N\xE3o consegui consultar o MusicScale agora. Tente novamente em instantes.",
          auditId: isPayload(payload) ? payload.auditId : void 0,
          retryable: response.status >= 500
        };
      }
      if (!isPayload(payload) || payload.success !== true || !payload.auditId) {
        return {
          status: "failed",
          humanSummary: "O MusicScale respondeu em um formato inesperado.",
          retryable: false
        };
      }
      if (payload.organizationId !== input.organizationId) {
        return {
          status: "conflict",
          humanSummary: "A organiza\xE7\xE3o devolvida pelo MusicScale n\xE3o corresponde ao contexto autorizado.",
          auditId: payload.auditId
        };
      }
      if (payload.schedule && payload.schedule.organizationId && payload.schedule.organizationId !== input.organizationId) {
        return {
          status: "conflict",
          humanSummary: "A escala devolvida pelo MusicScale n\xE3o pertence \xE0 organiza\xE7\xE3o autorizada.",
          auditId: payload.auditId
        };
      }
      return {
        status: "success",
        data: payload.schedule ?? null,
        humanSummary: safeSummary(
          payload.humanSummary,
          payload.schedule ? "Encontrei sua pr\xF3xima escala no MusicScale." : "N\xE3o encontrei uma pr\xF3xima escala atribu\xEDda a voc\xEA."
        ),
        auditId: payload.auditId,
        deepLink: payload.schedule && typeof payload.schedule.deepLink === "string" ? payload.schedule.deepLink : void 0
      };
    } catch (error) {
      return {
        status: "failed",
        humanSummary: "N\xE3o consegui consultar o MusicScale agora. Tente novamente em instantes.",
        retryable: true
      };
    } finally {
      clearTimeout(timeout);
    }
  }
};

// src/core/runtime/structuredCoreAudit.ts
function maskActorUid(uid) {
  if (!uid) return void 0;
  const value = uid.trim();
  if (!value) return void 0;
  if (value.length <= 6) return "***";
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}
function safeText(value, maxLength) {
  return value.replace(/[\r\n\t]+/g, " ").trim().slice(0, maxLength);
}
var StructuredLogCoreAuditPort = class {
  constructor(logger = console) {
    this.logger = logger;
  }
  async record(event) {
    this.logger.info("CONNECT_CORE_AUDIT", {
      eventType: event.eventType,
      requestId: safeText(event.requestId, 120),
      correlationId: safeText(event.correlationId, 120),
      actor: maskActorUid(event.actorUid),
      organizationId: event.organizationId ? safeText(event.organizationId, 160) : void 0,
      appId: event.appId,
      intent: event.intent,
      channel: safeText(event.channel, 40),
      result: event.result,
      details: safeText(event.details, 240)
    });
  }
};

// src/core/runtime/connectCoreRuntimeFactory.ts
function createConnectCoreRuntime(options = {}) {
  const env = options.env ?? process.env;
  const hubOrigin = env.MILLIONSNEST_HUB_ORIGIN?.trim();
  const musicScaleOrigin = env.MUSICSCALE_ORIGIN?.trim();
  if (!hubOrigin) {
    throw new Error("MILLIONSNEST_HUB_ORIGIN is required for Connect Core runtime.");
  }
  if (!musicScaleOrigin) {
    throw new Error("MUSICSCALE_ORIGIN is required for Connect Core runtime.");
  }
  const fetchImpl = options.fetchImpl ? ((input, init) => options.fetchImpl(input, init)) : void 0;
  const contextProvider = new HubSessionContextHttpProvider({
    hubOrigin,
    fetchImpl,
    timeoutMs: options.timeoutMs
  });
  const musicScaleReadTool = new MusicScaleNextScheduleHttpTool({
    musicScaleOrigin,
    fetchImpl,
    timeoutMs: options.timeoutMs
  });
  const audit = new StructuredLogCoreAuditPort(options.logger ?? console);
  return new ConnectCoreService(contextProvider, musicScaleReadTool, audit);
}

// src/core/runtime/connectSessionHttpHandler.ts
function bearerFromRequest(req) {
  const value = req.headers.authorization;
  return typeof value === "string" && /^Bearer\s+\S+$/i.test(value.trim()) ? value.trim() : "";
}
function normalizeOrigin2(raw) {
  const value = raw.trim();
  if (!value) throw new Error("MILLIONSNEST_HUB_ORIGIN is required.");
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("MILLIONSNEST_HUB_ORIGIN is invalid.");
  }
  return url.origin;
}
function createConnectSessionHttpHandler(options) {
  const endpoint = new URL(
    "/api/ecosystem/connect/session-context",
    normalizeOrigin2(options.hubOrigin)
  );
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = Math.max(1e3, options.timeoutMs ?? 8e3);
  return async function connectSessionHttpHandler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    const authorization = bearerFromRequest(req);
    if (!authorization) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        humanSummary: "Sua sess\xE3o precisa ser confirmada novamente."
      });
    }
    const requestedOrganizationId = typeof req.query.organizationId === "string" ? req.query.organizationId.trim() : "";
    if (!requestedOrganizationId || requestedOrganizationId.length > 256 || requestedOrganizationId.includes("/") || requestedOrganizationId.includes("\\")) {
      return res.status(400).json({
        success: false,
        code: "ORGANIZATION_REQUIRED",
        humanSummary: "Selecione uma organiza\xE7\xE3o v\xE1lida no MillionsNest."
      });
    }
    const upstreamUrl = new URL(endpoint.toString());
    upstreamUrl.searchParams.set("organizationId", requestedOrganizationId);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const upstream = await fetchImpl(upstreamUrl.toString(), {
        method: "GET",
        headers: {
          Authorization: authorization,
          Accept: "application/json",
          "Cache-Control": "no-store"
        },
        signal: controller.signal
      });
      const payload = await upstream.json().catch(() => null);
      if (upstream.status === 401) {
        return res.status(401).json({
          success: false,
          code: "AUTH_REQUIRED",
          humanSummary: "Sua sess\xE3o expirou. Abra o Connect novamente pelo MillionsNest."
        });
      }
      if (!upstream.ok || !payload || payload.success !== true) {
        return res.status(upstream.status >= 400 && upstream.status < 500 ? upstream.status : 503).json({
          success: false,
          code: "CANONICAL_CONTEXT_UNAVAILABLE",
          humanSummary: "N\xE3o foi poss\xEDvel confirmar seu contexto no MillionsNest."
        });
      }
      const activeOrganizationId = typeof payload.activeOrganizationId === "string" ? payload.activeOrganizationId.trim() : "";
      const activeObjectId = typeof payload.activeOrganization?.id === "string" ? payload.activeOrganization.id.trim() : "";
      if (activeOrganizationId !== requestedOrganizationId || activeObjectId !== requestedOrganizationId || typeof payload.user?.uid !== "string" || !payload.user.uid.trim()) {
        return res.status(409).json({
          success: false,
          code: "ORGANIZATION_CONTEXT_MISMATCH",
          humanSummary: "A organiza\xE7\xE3o ativa mudou. Abra o Connect novamente pelo MillionsNest."
        });
      }
      return res.status(200).json(payload);
    } catch (error) {
      return res.status(503).json({
        success: false,
        code: "CANONICAL_CONTEXT_UNAVAILABLE",
        humanSummary: error instanceof Error && error.name === "AbortError" ? "A confirma\xE7\xE3o da sess\xE3o demorou mais que o esperado." : "N\xE3o foi poss\xEDvel confirmar seu contexto no MillionsNest."
      });
    } finally {
      clearTimeout(timeout);
    }
  };
}

// src/personal/storage/firestorePersonalVault.ts
var DEFAULT_PROJECT_ID = "millionsnest";
var DEFAULT_BATCH_SIZE = 80;
function encodeValue(value) {
  if (value === null || value === void 0) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { nullValue: null };
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === "object") {
    const fields = {};
    for (const [key, nested] of Object.entries(value)) {
      fields[key] = encodeValue(nested);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}
function decodeValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue?.values || []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue?.fields || {});
  return null;
}
function encodeFields(record) {
  const fields = {};
  for (const [key, value] of Object.entries(record)) fields[key] = encodeValue(value);
  return fields;
}
function decodeFields(fields) {
  const record = {};
  for (const [key, value] of Object.entries(fields || {})) record[key] = decodeValue(value);
  return record;
}
function cleanBearer(raw) {
  const value = raw.trim();
  if (!value) throw new Error("AUTH_REQUIRED");
  return /^Bearer\s+/i.test(value) ? value : `Bearer ${value}`;
}
function safeSegment(raw) {
  const value = raw.trim();
  if (!value || value === "." || value === ".." || value.includes("/") || value.includes("\\")) {
    throw new Error("INVALID_DOCUMENT_SEGMENT");
  }
  return value;
}
function encodedPath(segments) {
  return segments.map((segment) => encodeURIComponent(safeSegment(segment))).join("/");
}
var FirestorePersonalVault = class {
  constructor(options = {}) {
    this.projectId = options.projectId?.trim() || DEFAULT_PROJECT_ID;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const database = `projects/${this.projectId}/databases/(default)`;
    this.documentsBase = `https://firestore.googleapis.com/v1/${database}/documents`;
    this.commitUrl = `https://firestore.googleapis.com/v1/${database}/documents:commit`;
  }
  ownerRoot(uid) {
    return ["users", safeSegment(uid), "connect", "state"];
  }
  fullDocumentName(uid, relativePath) {
    const all = [...this.ownerRoot(uid), ...relativePath.map(safeSegment)];
    return `projects/${this.projectId}/databases/(default)/documents/${all.join("/")}`;
  }
  async get(authToken2, uid, relativePath) {
    const path = encodedPath([...this.ownerRoot(uid), ...relativePath]);
    const response = await this.fetchImpl(`${this.documentsBase}/${path}`, {
      method: "GET",
      headers: { Authorization: cleanBearer(authToken2), Accept: "application/json" },
      cache: "no-store"
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`FIRESTORE_GET_${response.status}`);
    const body = await response.json();
    return {
      id: String(body.name || "").split("/").pop() || "",
      ...decodeFields(body.fields || {})
    };
  }
  async list(authToken2, uid, relativeCollectionPath, maxDocuments = 1500) {
    const path = encodedPath([...this.ownerRoot(uid), ...relativeCollectionPath]);
    const result = [];
    let pageToken = "";
    do {
      const url = new URL(`${this.documentsBase}/${path}`);
      url.searchParams.set("pageSize", "300");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const response = await this.fetchImpl(url.toString(), {
        method: "GET",
        headers: { Authorization: cleanBearer(authToken2), Accept: "application/json" },
        cache: "no-store"
      });
      if (response.status === 404) return result;
      if (!response.ok) throw new Error(`FIRESTORE_LIST_${response.status}`);
      const body = await response.json();
      for (const document of body.documents || []) {
        result.push({
          id: String(document.name || "").split("/").pop() || "",
          ...decodeFields(document.fields || {})
        });
        if (result.length >= maxDocuments) return result;
      }
      pageToken = typeof body.nextPageToken === "string" ? body.nextPageToken : "";
    } while (pageToken);
    return result;
  }
  async writeMany(authToken2, uid, writes) {
    for (let offset = 0; offset < writes.length; offset += DEFAULT_BATCH_SIZE) {
      const batch = writes.slice(offset, offset + DEFAULT_BATCH_SIZE);
      const response = await this.fetchImpl(this.commitUrl, {
        method: "POST",
        headers: {
          Authorization: cleanBearer(authToken2),
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          writes: batch.map((write) => ({
            update: {
              name: this.fullDocumentName(uid, write.path),
              fields: encodeFields(write.data)
            }
          }))
        })
      });
      if (!response.ok) throw new Error(`FIRESTORE_COMMIT_${response.status}`);
    }
  }
  async deleteMany(authToken2, uid, paths) {
    for (let offset = 0; offset < paths.length; offset += DEFAULT_BATCH_SIZE) {
      const batch = paths.slice(offset, offset + DEFAULT_BATCH_SIZE);
      const response = await this.fetchImpl(this.commitUrl, {
        method: "POST",
        headers: {
          Authorization: cleanBearer(authToken2),
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          writes: batch.map((path) => ({ delete: this.fullDocumentName(uid, path) }))
        })
      });
      if (!response.ok) throw new Error(`FIRESTORE_DELETE_${response.status}`);
    }
  }
};

// src/personal/radar/personalRadarService.ts
var import_node_crypto3 = __toESM(require("node:crypto"), 1);

// src/personal/whatsapp/whatsappExport.ts
var import_node_zlib = require("node:zlib");
var MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
var MAX_TEXT_BYTES = 5 * 1024 * 1024;
var MAX_MESSAGES = 25e3;
var MAX_ZIP_ENTRIES = 500;
function cleanText(value) {
  return value.replace(/\u200e|\u200f|\u202a|\u202c/g, "").replace(/\r\n?/g, "\n");
}
function readUInt16(buffer, offset) {
  if (offset < 0 || offset + 2 > buffer.length) throw new Error("ZIP_INVALID");
  return buffer.readUInt16LE(offset);
}
function readUInt32(buffer, offset) {
  if (offset < 0 || offset + 4 > buffer.length) throw new Error("ZIP_INVALID");
  return buffer.readUInt32LE(offset);
}
function extractWhatsAppText(fileName, bytes) {
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) throw new Error("IMPORT_FILE_SIZE_INVALID");
  const lowerName = fileName.trim().toLowerCase();
  if (!lowerName.endsWith(".zip")) {
    if (!lowerName.endsWith(".txt")) throw new Error("IMPORT_FILE_TYPE_INVALID");
    const text = cleanText(bytes.toString("utf8"));
    if (!text.trim()) throw new Error("IMPORT_EMPTY");
    return text;
  }
  const minEocd = 22;
  if (bytes.length < minEocd) throw new Error("ZIP_INVALID");
  let eocd = -1;
  const scanStart = Math.max(0, bytes.length - 65557);
  for (let offset2 = bytes.length - minEocd; offset2 >= scanStart; offset2--) {
    if (readUInt32(bytes, offset2) === 101010256) {
      eocd = offset2;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP_INVALID");
  const entryCount = readUInt16(bytes, eocd + 10);
  const centralSize = readUInt32(bytes, eocd + 12);
  const centralOffset = readUInt32(bytes, eocd + 16);
  if (entryCount <= 0 || entryCount > MAX_ZIP_ENTRIES) throw new Error("ZIP_INVALID");
  if (centralOffset + centralSize > bytes.length) throw new Error("ZIP_INVALID");
  let offset = centralOffset;
  for (let i = 0; i < entryCount; i++) {
    if (readUInt32(bytes, offset) !== 33639248) throw new Error("ZIP_INVALID");
    const flags = readUInt16(bytes, offset + 8);
    const method = readUInt16(bytes, offset + 10);
    const compressedSize = readUInt32(bytes, offset + 20);
    const uncompressedSize = readUInt32(bytes, offset + 24);
    const nameLength = readUInt16(bytes, offset + 28);
    const extraLength = readUInt16(bytes, offset + 30);
    const commentLength = readUInt16(bytes, offset + 32);
    const localOffset = readUInt32(bytes, offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > bytes.length) throw new Error("ZIP_INVALID");
    const entryName = bytes.subarray(nameStart, nameEnd).toString("utf8");
    if (entryName.toLowerCase().endsWith(".txt") && !entryName.endsWith("/")) {
      if ((flags & 1) !== 0) throw new Error("ZIP_ENCRYPTED_UNSUPPORTED");
      if (method !== 0 && method !== 8) throw new Error("ZIP_COMPRESSION_UNSUPPORTED");
      if (!uncompressedSize || uncompressedSize > MAX_TEXT_BYTES) throw new Error("IMPORT_FILE_SIZE_INVALID");
      if (compressedSize > MAX_UPLOAD_BYTES) throw new Error("IMPORT_FILE_SIZE_INVALID");
      if (compressedSize > 0 && uncompressedSize / compressedSize > 120) throw new Error("ZIP_RATIO_INVALID");
      if (readUInt32(bytes, localOffset) !== 67324752) throw new Error("ZIP_INVALID");
      const localNameLength = readUInt16(bytes, localOffset + 26);
      const localExtraLength = readUInt16(bytes, localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataStart < 0 || dataEnd > bytes.length) throw new Error("ZIP_INVALID");
      const compressed = bytes.subarray(dataStart, dataEnd);
      const extracted = method === 0 ? Buffer.from(compressed) : (0, import_node_zlib.inflateRawSync)(compressed);
      if (extracted.length !== uncompressedSize || extracted.length > MAX_TEXT_BYTES) throw new Error("ZIP_INVALID");
      const text = cleanText(extracted.toString("utf8"));
      if (!text.trim()) throw new Error("IMPORT_EMPTY");
      return text;
    }
    offset = nameEnd + extraLength + commentLength;
    if (offset > centralOffset + centralSize) throw new Error("ZIP_INVALID");
  }
  throw new Error("WHATSAPP_TXT_NOT_FOUND");
}
function normalizeYear(raw) {
  const value = Number(raw);
  return raw.length === 2 ? value >= 70 ? 1900 + value : 2e3 + value : value;
}
function toDateParts(dayRaw, monthRaw, yearRaw, hourRaw, minuteRaw, secondRaw, meridiemRaw) {
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = normalizeYear(yearRaw);
  let hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw || "0");
  const meridiem = (meridiemRaw || "").toUpperCase();
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "PM" && hour !== 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
  }
  if (year < 2e3 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const dateKey = `${year}-${pad(month)}-${pad(day)}`;
  return {
    dateKey,
    timestampLocal: `${dateKey}T${pad(hour)}:${pad(minute)}:${pad(second)}`
  };
}
var BRACKETED = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s*(?:-\s*)?([^:]{1,180}):\s?(.*)$/;
var DASHED_24H = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*-\s*([^:]{1,180}):\s?(.*)$/;
var DASHED_12H = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s*(\d{1,2}):(\d{2})\s*([AP]M)\s*-\s*([^:]{1,180}):\s?(.*)$/i;
function parseHeader(line) {
  let match = BRACKETED.exec(line);
  if (match) {
    const parts = toDateParts(match[1], match[2], match[3], match[4], match[5], match[6]);
    if (!parts) return null;
    return { ...parts, sender: match[7].trim(), text: match[8] || "" };
  }
  match = DASHED_24H.exec(line);
  if (match) {
    const parts = toDateParts(match[1], match[2], match[3], match[4], match[5], match[6]);
    if (!parts) return null;
    return { ...parts, sender: match[7].trim(), text: match[8] || "" };
  }
  match = DASHED_12H.exec(line);
  if (match) {
    const parts = toDateParts(match[1], match[2], match[3], match[4], match[5], void 0, match[6]);
    if (!parts) return null;
    return { ...parts, sender: match[7].trim(), text: match[8] || "" };
  }
  return null;
}
function parseWhatsAppExport(text) {
  const normalized = cleanText(text);
  const lines = normalized.split("\n");
  const messages = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/\u00a0/g, " ");
    const header = parseHeader(line);
    if (header?.sender) {
      if (messages.length >= MAX_MESSAGES) throw new Error("IMPORT_MESSAGE_LIMIT_EXCEEDED");
      messages.push({
        index: messages.length,
        sender: header.sender.slice(0, 180),
        text: header.text.slice(0, 2e4),
        dateKey: header.dateKey,
        timestampLocal: header.timestampLocal
      });
      continue;
    }
    const previous = messages[messages.length - 1];
    if (previous && line) {
      previous.text = `${previous.text}
${line}`.slice(0, 2e4);
    }
  }
  if (!messages.length) throw new Error("WHATSAPP_FORMAT_UNRECOGNIZED");
  const participants = Array.from(new Set(messages.map((message) => message.sender))).sort((a, b) => a.localeCompare(b));
  return {
    messages,
    participants,
    firstDateKey: messages[0]?.dateKey || null,
    lastDateKey: messages[messages.length - 1]?.dateKey || null
  };
}

// src/personal/radar/radarSignals.ts
var import_node_crypto2 = __toESM(require("node:crypto"), 1);
var PRODUCT_PATTERNS = [
  /\bmusicscale\b/i,
  /\bapp(?:licativo)?\b/i,
  /\bsistema\b/i,
  /\bplataforma\b/i,
  /\bpre[cç]o\b/i,
  /\bvalor\b/i,
  /\bquanto\s+custa\b/i,
  /\bteste\b/i,
  /\bexperimentar\b/i,
  /\bfunciona\b/i
];
var MUSIC_SCALE_FIT_PATTERNS = [
  /\bescala(?:s|do|da|r)?\b/i,
  /\brepert[oó]rio(?:s)?\b/i,
  /\bcifra(?:s)?\b/i,
  /\bchord(?:s)?\b/i,
  /\btom\b/i,
  /\btonalidade\b/i,
  /\btranspo(?:r|si[cç][aã]o)\b/i,
  /\blouvor\b/i,
  /\bworship\b/i,
  /\bminist[eé]rio\s+de\s+(?:louvor|m[uú]sica)\b/i,
  /\bl[ií]der\s+de\s+louvor\b/i,
  /\bministro(?:a)?\s+de\s+louvor\b/i,
  /\bvocal(?:ista|istas)?\b/i,
  /\bback\s*vocal\b/i,
  /\bm[uú]sic[oa]s?\b/i,
  /\binstrumentista(?:s)?\b/i,
  /\bbanda\b/i,
  /\bensaio(?:s)?\b/i,
  /\bset\s*list\b/i,
  /\bplaylist\b/i,
  /\bconfirma(?:r|[cç][aã]o)\b/i,
  /\bpresen[cç]a\b/i,
  /\bdisponibilidade\b/i,
  /\bfaltar\s+(?:no|ao)\s+(?:ensaio|culto)\b/i,
  /\btrocar\s+(?:o\s+)?tom\b/i,
  /\bm[uú]sicas?\s+(?:do|para\s+o)\s+culto\b/i,
  /\borganiza(?:r|[cç][aã]o|do|da)\b.{0,45}\b(?:louvor|m[uú]sic|equipe|banda|escala|repert[oó]rio)\b/i,
  /\b(?:louvor|m[uú]sic|equipe|banda|escala|repert[oó]rio)\b.{0,45}\borganiza(?:r|[cç][aã]o|do|da)\b/i,
  /\bwhatsapp\b.{0,55}\b(?:escala|repert[oó]rio|cifra|louvor|ensaio|m[uú]sic|equipe|banda)\b/i,
  /\b(?:escala|repert[oó]rio|cifra|louvor|ensaio|m[uú]sic|equipe|banda)\b.{0,55}\bwhatsapp\b/i
];
var LEADERSHIP_ROLE_PATTERNS = [
  /\bpastor(?:a)?\s+(?:titular|presidente|s[eê]nior|senior|respons[aá]vel)\b/i,
  /\bpr\.?\s*(?:titular|presidente)\b/i,
  /\bpresidente\s+(?:da|de)\s+igreja\b/i,
  /\bl[ií]der\s+(?:do\s+)?(?:louvor|worship|minist[eé]rio\s+de\s+m[uú]sica)\b/i,
  /\bministro(?:a)?\s+de\s+louvor\b/i,
  /\bcoordenador(?:a)?\s+(?:de\s+)?(?:louvor|m[uú]sica)\b/i,
  /\bdirigente\s+(?:de\s+)?(?:louvor|m[uú]sica)\b/i,
  /\brespons[aá]vel\s+(?:pelo|por|do|da)\s+(?:louvor|m[uú]sica)\b/i
];
var PASTOR_ROLE_PATTERNS = [
  /(^|\s)pr\.?($|\s)/i,
  /(^|\s)pra\.?($|\s)/i,
  /\bpastor(?:a)?\b/i,
  /\bbispo(?:a)?\b/i,
  /\bpresb[ií]tero(?:a)?\b/i,
  /\bap[oó]stolo(?:a)?\b/i,
  /\breverendo(?:a)?\b/i
];
function normalizeName(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
}
function normalizeText(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function stableId(prefix, value) {
  return `${prefix}_${import_node_crypto2.default.createHash("sha256").update(value).digest("hex").slice(0, 20)}`;
}
function snippet(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}
function evidence(message) {
  return {
    messageIndex: message.index,
    dateKey: message.dateKey,
    sender: message.sender,
    snippet: snippet(message.text)
  };
}
function extractPhone(sender) {
  const digits = sender.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}
function daysBetween(dateA, dateB) {
  const a = Date.parse(`${dateA}T00:00:00Z`);
  const b = Date.parse(`${dateB}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 864e5);
}
function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}
function hasExplicitProductInterest(text) {
  if (/\bmusicscale\b/i.test(text)) return true;
  return hasAny(text, PRODUCT_PATTERNS) && hasAny(text, MUSIC_SCALE_FIT_PATTERNS);
}
function hasMusicScaleFit(text) {
  return hasExplicitProductInterest(text) || hasAny(text, MUSIC_SCALE_FIT_PATTERNS);
}
function selfMentioned(text, selfNames) {
  const normalized = ` ${normalizeText(text).replace(/[^a-z0-9@+]+/g, " ")} `;
  return selfNames.some((rawName) => {
    const full = normalizeName(rawName);
    if (!full) return false;
    const candidates = new Set([full, full.split(" ")[0]].filter((value) => value.length >= 3));
    for (const candidate of candidates) {
      if (normalized.includes(` ${candidate} `) || normalized.includes(` @${candidate} `)) return true;
    }
    return false;
  });
}
function roleEvidenceText(displayName, messages) {
  return `${displayName} ${messages.map((message) => message.text).join(" ")}`;
}
function isLeadershipRole(displayName, messages) {
  return hasAny(roleEvidenceText(displayName, messages), LEADERSHIP_ROLE_PATTERNS);
}
function isPastoralRole(displayName, messages) {
  return isLeadershipRole(displayName, messages) || hasAny(roleEvidenceText(displayName, messages), PASTOR_ROLE_PATTERNS);
}
function deriveRadarPeople(input) {
  const self = new Set(input.selfNames.map(normalizeName).filter(Boolean));
  const today = input.todayDateKey || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const grouped = /* @__PURE__ */ new Map();
  for (const message of input.messages) {
    const key = normalizeName(message.sender);
    if (!key || self.has(key)) continue;
    const list = grouped.get(key) || [];
    list.push(message);
    grouped.set(key, list);
  }
  const ownerMessages = input.messages.filter((message) => self.has(normalizeName(message.sender)));
  const isDirectConversation = self.size > 0 && grouped.size === 1;
  const people = [];
  for (const [normalizedName, messages] of grouped.entries()) {
    const ordered = [...messages].sort((a, b) => a.index - b.index);
    const displayName = ordered[ordered.length - 1]?.sender || normalizedName;
    const personId = stableId("person", normalizedName);
    const signals = [];
    const lastPersonMessage = ordered[ordered.length - 1];
    const fitMessages = ordered.filter((message) => hasMusicScaleFit(message.text));
    if (fitMessages.length > 0) {
      const selected = fitMessages.slice(-3);
      signals.push({
        id: stableId("signal", `${personId}:music_scale_fit:${selected.map((item) => item.index).join(",")}`),
        type: "explicit_product_interest",
        reason: /\bmusicscale\b/i.test(selected.map((item) => item.text).join(" ")) ? "Esta pessoa j\xE1 citou o MusicScale ou demonstrou interesse direto em algo que o produto resolve." : "Esta pessoa falou sobre uma necessidade diretamente ligada ao MusicScale, como louvor, escala, repert\xF3rio, cifras, ensaio, equipe, confirma\xE7\xE3o ou organiza\xE7\xE3o.",
        nextAction: "Retomar exatamente o assunto citado e fazer uma pergunta curta antes de apresentar o MusicScale.",
        evidence: selected.map(evidence)
      });
    }
    const directInteraction = isDirectConversation && ownerMessages.length > 0 && ordered.length > 0;
    const mentionMessages = ordered.filter((message) => selfMentioned(message.text, input.selfNames));
    const explicitlyMentioned = mentionMessages.length > 0;
    if (directInteraction || explicitlyMentioned) {
      const selected = explicitlyMentioned ? mentionMessages.slice(-2) : [lastPersonMessage].filter(Boolean);
      signals.push({
        id: stableId("signal", `${personId}:relationship:${selected.map((item) => item.index).join(",") || "direct"}`),
        type: "commercial_followup_due",
        reason: explicitlyMentioned ? "Esta pessoa chamou voc\xEA pelo nome ou marcou voc\xEA na conversa, ent\xE3o j\xE1 existe um ponto natural para retomar o contato." : "Voc\xEAs j\xE1 tiveram uma conversa direta neste hist\xF3rico, o que torna uma abordagem pessoal mais natural do que um contato frio.",
        nextAction: "Retomar a rela\xE7\xE3o de forma pessoal e descobrir como essa pessoa organiza hoje o louvor e a equipe.",
        evidence: selected.map(evidence)
      });
    }
    if (isDirectConversation) {
      const ownerSalesMessages = ownerMessages.filter(
        (message) => /\bmusicscale\b/i.test(message.text) || hasAny(message.text, PRODUCT_PATTERNS) && hasAny(message.text, MUSIC_SCALE_FIT_PATTERNS)
      );
      const lastOwnerSales = ownerSalesMessages.filter((ownerMessage) => {
        const previousPerson = ordered.some((personMessage) => personMessage.index < ownerMessage.index);
        const laterPerson = ordered.some((personMessage) => personMessage.index > ownerMessage.index);
        return previousPerson && !laterPerson;
      }).slice(-1)[0];
      if (lastOwnerSales && daysBetween(lastOwnerSales.dateKey, today) >= 2) {
        signals.push({
          id: stableId("signal", `${personId}:commercial_followup_due:${lastOwnerSales.index}`),
          type: "commercial_followup_due",
          reason: "Voc\xEA j\xE1 apresentou o MusicScale ou uma solu\xE7\xE3o relacionada e n\xE3o h\xE1 resposta posterior da pessoa neste export.",
          nextAction: "Fazer um follow-up curto, \xFAtil e sem press\xE3o, retomando o ponto que voc\xEAs j\xE1 conversaram.",
          evidence: [evidence(lastOwnerSales)]
        });
      }
    }
    const leadershipRole = isLeadershipRole(displayName, ordered);
    const pastoralRole = isPastoralRole(displayName, ordered);
    if (leadershipRole) {
      signals.push({
        id: stableId("signal", `${personId}:leadership_role`),
        type: "unanswered_conversation",
        reason: "O hist\xF3rico indica um papel de lideran\xE7a com influ\xEAncia direta na igreja ou no minist\xE9rio de louvor.",
        nextAction: "Fazer uma abordagem respeitosa e consultiva, come\xE7ando por como a equipe de louvor \xE9 organizada hoje.",
        evidence: lastPersonMessage ? [evidence(lastPersonMessage)] : []
      });
    } else if (pastoralRole) {
      signals.push({
        id: stableId("signal", `${personId}:pastoral_contact`),
        type: "recurring_relevant_topic",
        reason: "Este contato aparenta ser pastor ou lideran\xE7a pastoral e pode ser relevante para uma apresenta\xE7\xE3o futura do MusicScale.",
        nextAction: "S\xF3 abordar depois dos contatos com dor ou relacionamento mais forte; use uma mensagem pessoal, curta e sem press\xE3o.",
        evidence: lastPersonMessage ? [evidence(lastPersonMessage)] : []
      });
    }
    if (!signals.length) continue;
    people.push({
      id: personId,
      displayName,
      normalizedName,
      phone: extractPhone(displayName),
      messageCount: ordered.length,
      firstDateKey: ordered[0]?.dateKey || null,
      lastDateKey: ordered[ordered.length - 1]?.dateKey || null,
      signals
    });
  }
  const priority = {
    explicit_product_interest: 0,
    commercial_followup_due: 1,
    unanswered_conversation: 2,
    recurring_relevant_topic: 3
  };
  return people.sort((a, b) => {
    const aRank = Math.min(...a.signals.map((signal) => priority[signal.type]));
    const bRank = Math.min(...b.signals.map((signal) => priority[signal.type]));
    if (aRank !== bRank) return aRank - bRank;
    return (b.lastDateKey || "").localeCompare(a.lastDateKey || "");
  });
}

// src/personal/radar/composerPlaybook.ts
function firstName(value) {
  const clean = String(value || "").trim();
  if (!clean || /^\+?\d/.test(clean)) return "";
  return clean.split(/\s+/)[0] || "";
}
function evidenceText(signal) {
  return signal.evidence.map((item) => item.snippet).join(" ");
}
function topic(signal) {
  const text = evidenceText(signal);
  if (/cifra|repert[oó]rio|tom|tonalidade/i.test(text)) return "repert\xF3rio, cifras e tons";
  if (/ensaio/i.test(text)) return "ensaio e prepara\xE7\xE3o da equipe";
  if (/confirma|presen[cç]a|disponibilidade|faltar/i.test(text)) return "confirma\xE7\xE3o e disponibilidade da equipe";
  if (/whatsapp/i.test(text)) return "organiza\xE7\xE3o do louvor pelo WhatsApp";
  if (/escala/i.test(text)) return "escalas do louvor";
  if (/louvor|worship|minist[eé]rio|banda|vocal|m[uú]sic/i.test(text)) return "organiza\xE7\xE3o da equipe de louvor";
  return "organiza\xE7\xE3o do louvor";
}
function isPastoral(signal) {
  return signal.type === "unanswered_conversation" || signal.type === "recurring_relevant_topic";
}
function hasProductInterest(signal) {
  return signal.type === "explicit_product_interest";
}
function hasRelationship(signal) {
  return signal.type === "commercial_followup_due";
}
function resolveStage(signal, objective) {
  if (objective === "pedir_video") return 4;
  if (objective === "explicar_dor") return 7;
  if (objective === "convidar_trial") return 8;
  if (objective === "acompanhar_trial") return 9;
  if (objective === "fechar") return 10;
  if (objective === "retomar_conversa") return 1;
  if (objective === "descobrir_dor") return 2;
  if (hasProductInterest(signal)) return 2;
  return 1;
}
function stageLabel(stage) {
  return {
    1: "Abertura",
    2: "Descoberta",
    3: "Hist\xF3ria",
    4: "Permiss\xE3o",
    5: "Demonstra\xE7\xE3o",
    6: "Diagn\xF3stico",
    7: "Resposta focada",
    8: "Trial",
    9: "Ativa\xE7\xE3o",
    10: "Fechamento"
  }[stage] || "Descoberta";
}
function defaultObjective(stage) {
  if (stage === 1) return "iniciar_conversa";
  if (stage === 2) return "descobrir_dor";
  if (stage === 4) return "pedir_video";
  if (stage === 7) return "explicar_dor";
  if (stage === 8) return "convidar_trial";
  if (stage === 9) return "acompanhar_trial";
  if (stage === 10) return "fechar";
  return "descobrir_dor";
}
function defaultStyle(signal) {
  if (isPastoral(signal)) return "pastoral";
  if (hasRelationship(signal)) return "proximo";
  if (hasProductInterest(signal)) return "consultivo";
  return "amigavel";
}
function greeting(name, style) {
  if (style === "pastoral") return name ? `Ol\xE1, ${name}! Tudo bem?` : "Ol\xE1! Tudo bem?";
  if (style === "descontraido") return name ? `\xD4, ${name}!` : "Oi!";
  return name ? `Oi, ${name}! Tudo bem?` : "Oi! Tudo bem?";
}
function soften(style, text) {
  if (style === "objetivo") return text.replace(/Tudo bem\?\s*/g, "").replace(/Queria te fazer uma pergunta rapidinha:/g, "Uma pergunta r\xE1pida:");
  if (style === "profissional") return text.replace("\xD4, ", "Ol\xE1, ").replace("rapidinho", "brevemente").replace("uma coisa", "um ponto");
  if (style === "pastoral") return text.replace("voc\xEAs", "voc\xEAs a\xED na igreja");
  return text;
}
function openingVariants(name, signal, style) {
  const g = greeting(name, style);
  const t = topic(signal);
  if (hasProductInterest(signal)) {
    return [
      `${g} Vi o que voc\xEA comentou sobre ${t}. Hoje voc\xEAs ainda organizam isso mais pelo WhatsApp ou j\xE1 usam alguma ferramenta?`,
      `${g} Lembrei do que voc\xEA falou sobre ${t}. O que mais d\xE1 trabalho para voc\xEAs hoje nessa parte?`,
      `${g} Posso te fazer uma pergunta r\xE1pida? Como voc\xEAs organizam ${t} hoje na pr\xE1tica?`
    ].map((text) => soften(style, text));
  }
  if (isPastoral(signal)) {
    return [
      `${g} Queria te fazer uma pergunta rapidinha sobre o louvor. Hoje voc\xEAs organizam m\xFAsicas, cifras, tons e escala mais pelo WhatsApp ou usam algum sistema?`,
      `${g} Uma curiosidade: como voc\xEAs organizam hoje escala, m\xFAsicas e confirma\xE7\xF5es do pessoal do louvor?`,
      `${g} Posso te fazer uma pergunta r\xE1pida sobre como voc\xEAs organizam o minist\xE9rio de louvor hoje?`
    ].map((text) => soften(style, text));
  }
  if (hasRelationship(signal)) {
    return [
      `${g} Lembrei de voc\xEA e queria te perguntar uma coisa: voc\xEAs ainda organizam o louvor mais pelo WhatsApp?`,
      `${g} Deixa eu te perguntar uma coisa sobre o louvor da\xED: como voc\xEAs montam escala e repert\xF3rio hoje?`,
      `${g} Posso te fazer uma pergunta rapidinha? O que mais d\xE1 trabalho para organizar o pessoal do louvor hoje?`
    ].map((text) => soften(style, text));
  }
  return [
    `${g} Posso te fazer uma pergunta r\xE1pida sobre como voc\xEAs organizam o louvor hoje?`,
    `${g} Como voc\xEAs organizam escala, repert\xF3rio e confirma\xE7\xF5es do louvor atualmente?`,
    `${g} Hoje voc\xEAs usam mais WhatsApp para organizar o louvor ou j\xE1 t\xEAm alguma ferramenta?`
  ].map((text) => soften(style, text));
}
function permissionVariants(name, signal, style) {
  const g = greeting(name, style);
  const t = topic(signal);
  return [
    `${g} Pelo que voc\xEA comentou sobre ${t}, acho que faz sentido te mostrar uma coisa. Posso te mandar um v\xEDdeo de uns 30 segundos do MusicScale?`,
    `${g} A gente viveu algo bem parecido por aqui e acabou criando o MusicScale. Posso te mandar um v\xEDdeo curtinho para voc\xEA ver como funciona?`,
    `${g} Em vez de te explicar tudo por texto, posso te mandar um v\xEDdeo bem r\xE1pido mostrando como a gente resolveu essa parte no MusicScale?`
  ].map((text) => soften(style, text));
}
function focusedVariants(name, signal, style) {
  const g = greeting(name, style);
  const t = topic(signal);
  return [
    `${g} Sobre ${t}: no MusicScale essa parte fica centralizada para a equipe, ent\xE3o ningu\xE9m precisa procurar informa\xE7\xE3o espalhada. Se voc\xEA quiser, te mostro s\xF3 esse fluxo.`,
    `${g} O ponto que voc\xEA comentou sobre ${t} \xE9 justamente uma das coisas que o MusicScale resolve. Quer que eu te mostre especificamente essa parte?`,
    `${g} Pensando no que voc\xEA falou sobre ${t}, eu n\xE3o te mostraria o app inteiro agora. Eu come\xE7aria s\xF3 por essa fun\xE7\xE3o. Posso te mostrar?`
  ].map((text) => soften(style, text));
}
function trialVariants(name, style) {
  const g = greeting(name, style);
  return [
    `${g} Pelo que voc\xEA viu at\xE9 aqui, acho que o melhor \xE9 testar na realidade de voc\xEAs. Quer criar a organiza\xE7\xE3o da igreja e usar os 7 dias para montar uma escala real?`,
    `${g} Se fizer sentido, o pr\xF3ximo passo pode ser bem simples: testar por 7 dias com a pr\xF3pria equipe e ver se facilita de verdade. Quer que eu te mostre como come\xE7ar?`,
    `${g} Em vez de decidir s\xF3 pelo v\xEDdeo, vale testar numa escala real. Quer come\xE7ar os 7 dias e colocar a equipe para usar?`
  ].map((text) => soften(style, text));
}
function followupVariants(name, signal, style) {
  const g = greeting(name, style);
  const t = topic(signal);
  return [
    `${g} Passando s\xF3 para retomar aquele assunto sobre ${t}. Voc\xEA conseguiu ver com calma?`,
    `${g} Lembrei da nossa conversa sobre ${t}. Ficou alguma d\xFAvida ou alguma parte que voc\xEA queria ver melhor?`,
    `${g} S\xF3 retomando sem pressa: aquilo sobre ${t} ainda \xE9 uma dificuldade a\xED para voc\xEAs?`
  ].map((text) => soften(style, text));
}
function closingVariants(name, style) {
  const g = greeting(name, style);
  return [
    `${g} Agora que voc\xEAs j\xE1 usaram numa rotina real: facilitou a organiza\xE7\xE3o do louvor?`,
    `${g} Depois desse teste, queria saber uma coisa bem simples: ficou mais f\xE1cil para a equipe se organizar?`,
    `${g} O teste ajudou de verdade na rotina de voc\xEAs? Se sim, eu te explico como fica a continuidade para a igreja inteira.`
  ].map((text) => soften(style, text));
}
function audioVariants(name, signal, style) {
  const g = greeting(name, style);
  const t = topic(signal);
  return [
    `${g} Olha, aqui a gente tamb\xE9m passava por muita coisa espalhada no WhatsApp, principalmente ${t}. Minha esposa lidera e ministra no louvor, e eu fui vendo de perto o trabalho que dava. Como eu trabalho com tecnologia, a gente acabou criando o MusicScale para resolver primeiro a nossa pr\xF3pria rotina: escala, repert\xF3rio e confirma\xE7\xE3o da equipe num lugar s\xF3. Se voc\xEA quiser, eu te mando um v\xEDdeo bem curto mostrando como funciona.`,
    `${g} A ideia do MusicScale nasceu de uma necessidade nossa mesmo na igreja. A gente tinha dificuldade com ${t} e muita informa\xE7\xE3o ficava perdida em conversa. Ent\xE3o fomos montando uma ferramenta simples para a equipe inteira acompanhar escala, m\xFAsicas e confirma\xE7\xF5es. Se fizer sentido para voc\xEA, eu posso te mostrar em um v\xEDdeo de poucos segundos.`,
    `${g} N\xE3o foi um app que a gente inventou procurando o que vender. Ele nasceu porque a gente vivia essa rotina de louvor e queria facilitar ${t}. A ideia foi colocar o que a equipe precisa num lugar s\xF3 e tirar peso do l\xEDder. Posso te mandar um v\xEDdeo rapidinho para voc\xEA ver se faria sentido a\xED tamb\xE9m?`
  ].map((text) => soften(style, text));
}
function buildComposerPlan(input) {
  const stage = resolveStage(input.signal, input.objective);
  const objective = input.objective || defaultObjective(stage);
  const style = input.style || defaultStyle(input.signal);
  const name = firstName(input.person.displayName);
  const t = topic(input.signal);
  const channel = input.channel || (objective === "retomar_conversa" ? "followup" : "texto");
  let texts;
  let effectiveChannel = channel;
  if (channel === "audio") {
    texts = audioVariants(name, input.signal, style);
  } else if (objective === "pedir_video") {
    texts = permissionVariants(name, input.signal, style);
  } else if (objective === "explicar_dor") {
    texts = focusedVariants(name, input.signal, style);
  } else if (objective === "convidar_trial" || objective === "acompanhar_trial") {
    texts = trialVariants(name, style);
  } else if (objective === "retomar_conversa" || channel === "followup") {
    texts = followupVariants(name, input.signal, style);
    effectiveChannel = "followup";
  } else if (objective === "fechar") {
    texts = closingVariants(name, style);
  } else {
    texts = openingVariants(name, input.signal, style);
  }
  const factsUsed = input.signal.evidence.slice(0, 3).map((item) => `${item.dateKey}: ${item.snippet}`);
  const recommendation = stage <= 2 ? "Comece com uma pergunta curta. N\xE3o apresente o MusicScale inteiro ainda." : stage === 4 ? "Pe\xE7a permiss\xE3o antes de mandar o v\xEDdeo. O pr\xF3ximo passo \xE9 um pequeno \u201Csim\u201D." : stage === 7 ? `Fale somente da parte ligada a ${t}; n\xE3o despeje todos os recursos.` : stage === 8 ? "S\xF3 convide para o trial quando houver inten\xE7\xE3o real. Use uma rotina da pr\xF3pria igreja." : stage === 10 ? "Pergunte primeiro se facilitou. S\xF3 depois apresente continuidade e plano vigente." : "Avance uma etapa por vez e adapte a pr\xF3xima mensagem \xE0 resposta real.";
  const why = hasProductInterest(input.signal) ? `A pr\xF3pria conversa trouxe uma dor ligada a ${t}, ent\xE3o vale come\xE7ar por esse contexto real.` : hasRelationship(input.signal) ? "J\xE1 existe relacionamento comprovado, ent\xE3o uma abordagem natural \xE9 melhor que uma apresenta\xE7\xE3o comercial fria." : isPastoral(input.signal) ? "\xC9 um contato pastoral/de lideran\xE7a; use respeito, calor humano e descoberta antes de apresentar produto." : "H\xE1 contexto suficiente para uma abertura curta e consultiva.";
  const tip = effectiveChannel === "audio" ? "Fale como conversa, com frases curtas e pausas naturais. N\xE3o leia como an\xFAncio." : "Envie uma pergunta por vez. Espere a resposta antes de avan\xE7ar para a pr\xF3xima etapa.";
  const nextSmallYes = stage <= 2 ? "Conseguir uma resposta sobre como eles organizam o louvor hoje." : stage === 4 ? "Conseguir permiss\xE3o para enviar um v\xEDdeo curto." : stage === 7 ? "Confirmar se a fun\xE7\xE3o ligada \xE0 dor faz sentido para aquela igreja." : stage === 8 ? "Conseguir concord\xE2ncia para testar 7 dias numa organiza\xE7\xE3o pr\xF3pria." : stage === 9 ? "Levar a equipe a criar/publicar uma escala real e confirmar presen\xE7a." : "Confirmar se o MusicScale facilitou a rotina antes de falar em continuidade.";
  return {
    stage,
    stageLabel: stageLabel(stage),
    objective,
    recommendedChannel: effectiveChannel,
    recommendedStyle: style,
    recommendation,
    why,
    tip,
    nextSmallYes,
    estimatedDurationSeconds: effectiveChannel === "audio" ? stage === 3 ? 45 : 30 : void 0,
    factsUsed,
    options: texts.slice(0, 3).map((text, index) => ({
      id: `option_${index + 1}`,
      text,
      style,
      channel: effectiveChannel
    }))
  };
}

// src/personal/radar/personalRadarService.ts
var DAY_MS = 864e5;
function isoNow(now) {
  return new Date(now()).toISOString();
}
function sourceIdFromText(text) {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  return `wa_${import_node_crypto3.default.createHash("sha256").update(normalized).digest("hex").slice(0, 24)}`;
}
function safeBase64(value) {
  if (typeof value !== "string" || !value || value.length > 8e6) throw new Error("IMPORT_PAYLOAD_INVALID");
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(value)) throw new Error("IMPORT_PAYLOAD_INVALID");
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error("IMPORT_FILE_SIZE_INVALID");
  return bytes;
}
function normalizeSelfNames(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter((value) => typeof value === "string").map((value) => value.trim()).filter(Boolean).slice(0, 8)));
}
function chunkMessages(messages, size = 100) {
  const chunks = [];
  for (let i = 0; i < messages.length; i += size) chunks.push(messages.slice(i, i + size));
  return chunks;
}
function signalPriority(signal) {
  const rank = {
    explicit_product_interest: 0,
    commercial_followup_due: 1,
    unanswered_conversation: 2,
    recurring_relevant_topic: 3
  };
  return rank[signal.type];
}
function personPriority(person) {
  return person.signals.length ? Math.min(...person.signals.map(signalPriority)) : 99;
}
function legacyComposerPreferences(tone) {
  if (tone === "audio") return { channel: "audio", style: "proximo" };
  if (tone === "video") return { channel: "texto", objective: "pedir_video", style: "amigavel" };
  if (tone === "conversa") return { channel: "texto", objective: "descobrir_dor", style: "consultivo" };
  return { channel: "texto", style: "objetivo" };
}
function isActivelySnoozed(person, nowMs) {
  if (person.radarState !== "snoozed") return false;
  const untilMs = Date.parse(String(person.snoozedUntil || ""));
  return Number.isFinite(untilMs) && untilMs > nowMs;
}
function resolveSnoozeDays(value) {
  const days = value === void 0 ? 7 : Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error("SNOOZE_DAYS_INVALID");
  return days;
}
var PersonalRadarService = class {
  constructor(contextProvider, vault, now = Date.now, logger = console) {
    this.contextProvider = contextProvider;
    this.vault = vault;
    this.now = now;
    this.logger = logger;
  }
  async resolvePilotContext(input) {
    const resolution = await this.contextProvider.resolve({
      authToken: input.authToken,
      requestedOrganizationId: input.organizationId
    });
    if (resolution.status !== "resolved") throw new Error("RADAR_CONTEXT_DENIED");
    if (!resolution.context.globalAccess) throw new Error("RADAR_PILOT_FORBIDDEN");
    if (resolution.context.organizationId !== input.organizationId) throw new Error("RADAR_TENANT_MISMATCH");
    return resolution.context;
  }
  async importWhatsApp(request, input) {
    const context = await this.resolvePilotContext(request);
    const fileName = typeof input.fileName === "string" ? input.fileName.trim().slice(0, 240) : "";
    if (!fileName) throw new Error("IMPORT_FILENAME_REQUIRED");
    const bytes = safeBase64(input.contentBase64);
    const text = extractWhatsAppText(fileName, bytes);
    const sourceId = sourceIdFromText(text);
    const existing = await this.vault.get(request.authToken, context.actorUid, ["personalSources", sourceId]);
    if (existing) {
      return {
        status: "deduplicated",
        sourceId,
        messageCount: Number(existing.messageCount || 0),
        participantCount: Number(existing.participantCount || 0),
        radarCount: Number(existing.radarCount || 0)
      };
    }
    const parsed = parseWhatsAppExport(text);
    const selfNames = normalizeSelfNames(input.selfNames);
    const people = deriveRadarPeople({ messages: parsed.messages, selfNames }).slice(0, 250);
    const createdAt = isoNow(this.now);
    const chunks = chunkMessages(parsed.messages);
    const writes = [
      {
        path: ["personalSources", sourceId],
        data: {
          id: sourceId,
          type: "whatsapp_export",
          fileName,
          ownerUid: context.actorUid,
          createdAt,
          firstDateKey: parsed.firstDateKey,
          lastDateKey: parsed.lastDateKey,
          messageCount: parsed.messages.length,
          participantCount: parsed.participants.length,
          radarCount: people.length,
          sourceHash: sourceId.replace(/^wa_/, ""),
          organizationHint: request.organizationId,
          privacyScope: "owner_only"
        }
      },
      {
        path: ["importRuns", sourceId],
        data: {
          id: sourceId,
          sourceId,
          ownerUid: context.actorUid,
          status: "completed",
          createdAt,
          messageCount: parsed.messages.length,
          participantCount: parsed.participants.length,
          radarCount: people.length
        }
      },
      {
        path: ["personalConversations", sourceId],
        data: {
          id: sourceId,
          sourceId,
          ownerUid: context.actorUid,
          fileName,
          createdAt,
          firstDateKey: parsed.firstDateKey,
          lastDateKey: parsed.lastDateKey,
          participantNames: parsed.participants.slice(0, 300),
          messageCount: parsed.messages.length,
          selfNames
        }
      },
      ...chunks.map((messages, index) => ({
        path: ["personalConversations", sourceId, "messageChunks", String(index).padStart(4, "0")],
        data: {
          sourceId,
          chunkIndex: index,
          messages
        }
      })),
      ...people.map((person) => ({
        path: ["personalPeople", `${sourceId}_${person.id}`],
        data: {
          ...person,
          id: `${sourceId}_${person.id}`,
          sourceId,
          ownerUid: context.actorUid,
          importedAt: createdAt,
          radarState: "active",
          snoozedUntil: null,
          priority: personPriority(person)
        }
      }))
    ];
    await this.vault.writeMany(request.authToken, context.actorUid, writes);
    this.logger.info("RADAR_WHATSAPP_IMPORT_COMPLETED", {
      sourceId,
      actorUid: context.actorUid.slice(0, 4) + "***",
      messageCount: parsed.messages.length,
      participantCount: parsed.participants.length,
      radarCount: people.length
    });
    return {
      status: "imported",
      sourceId,
      messageCount: parsed.messages.length,
      participantCount: parsed.participants.length,
      radarCount: people.length
    };
  }
  async getRadar(request) {
    const context = await this.resolvePilotContext(request);
    const people = await this.vault.list(request.authToken, context.actorUid, ["personalPeople"], 1e3);
    const nowMs = this.now();
    const active = people.filter((person) => person.radarState !== "ignored" && !isActivelySnoozed(person, nowMs)).sort((a, b) => {
      const rank = Number(a.priority ?? 99) - Number(b.priority ?? 99);
      if (rank !== 0) return rank;
      return String(b.lastDateKey || "").localeCompare(String(a.lastDateKey || ""));
    });
    return { people: active, count: active.length };
  }
  async search(request, rawQuery) {
    const context = await this.resolvePilotContext(request);
    const query = rawQuery.trim().toLocaleLowerCase("pt-BR");
    if (query.length < 2 || query.length > 120) throw new Error("SEARCH_QUERY_INVALID");
    const conversations = await this.vault.list(request.authToken, context.actorUid, ["personalConversations"], 80);
    const matches = [];
    for (const conversation of conversations) {
      if (matches.length >= 100) break;
      const sourceId = String(conversation.sourceId || conversation.id || "");
      if (!sourceId) continue;
      const chunks = await this.vault.list(
        request.authToken,
        context.actorUid,
        ["personalConversations", sourceId, "messageChunks"],
        400
      );
      for (const chunk of chunks) {
        const messages = Array.isArray(chunk.messages) ? chunk.messages : [];
        for (const message of messages) {
          const haystack = `${message?.sender || ""} ${message?.text || ""}`.toLocaleLowerCase("pt-BR");
          if (!haystack.includes(query)) continue;
          matches.push({
            sourceId,
            sender: String(message?.sender || ""),
            dateKey: String(message?.dateKey || ""),
            timestampLocal: String(message?.timestampLocal || ""),
            snippet: String(message?.text || "").replace(/\s+/g, " ").trim().slice(0, 300)
          });
          if (matches.length >= 100) break;
        }
        if (matches.length >= 100) break;
      }
    }
    return { query: rawQuery.trim(), matches };
  }
  async updatePerson(request, personDocumentId, input) {
    const context = await this.resolvePilotContext(request);
    const person = await this.vault.get(request.authToken, context.actorUid, ["personalPeople", personDocumentId]);
    if (!person) throw new Error("PERSON_NOT_FOUND");
    const digits = typeof input.phone === "string" ? input.phone.replace(/\D/g, "") : "";
    if (digits && (digits.length < 10 || digits.length > 15)) throw new Error("PHONE_INVALID");
    const radarState = input.radarState && ["active", "ignored", "snoozed"].includes(input.radarState) ? input.radarState : String(person.radarState || "active");
    let snoozedUntil = person.snoozedUntil || null;
    if (input.radarState === "snoozed") {
      const days = resolveSnoozeDays(input.snoozeDays);
      snoozedUntil = new Date(this.now() + days * DAY_MS).toISOString();
    } else if (input.radarState === "active" || input.radarState === "ignored") {
      snoozedUntil = null;
    }
    await this.vault.writeMany(request.authToken, context.actorUid, [{
      path: ["personalPeople", personDocumentId],
      data: {
        ...person,
        id: personDocumentId,
        phone: digits || person.phone || null,
        radarState,
        snoozedUntil,
        updatedAt: isoNow(this.now)
      }
    }]);
    return { success: true, radarState, snoozedUntil };
  }
  async promoteOpportunity(request, personDocumentId) {
    const context = await this.resolvePilotContext(request);
    const person = await this.vault.get(request.authToken, context.actorUid, ["personalPeople", personDocumentId]);
    if (!person) throw new Error("PERSON_NOT_FOUND");
    const createdAt = isoNow(this.now);
    await this.vault.writeMany(request.authToken, context.actorUid, [{
      path: ["relationshipOpportunities", personDocumentId],
      data: {
        id: personDocumentId,
        personId: personDocumentId,
        sourceId: person.sourceId || null,
        displayName: person.displayName || null,
        phone: person.phone || null,
        organizationId: request.organizationId,
        status: "open",
        promotedManually: true,
        createdAt,
        createdByUid: context.actorUid,
        privacyScope: "owner_only_pilot"
      }
    }]);
    return { success: true, opportunityId: personDocumentId };
  }
  async compose(request, personDocumentId, signalId, tone, preferences = {}) {
    const context = await this.resolvePilotContext(request);
    const person = await this.vault.get(request.authToken, context.actorUid, ["personalPeople", personDocumentId]);
    if (!person) throw new Error("PERSON_NOT_FOUND");
    const signals = Array.isArray(person.signals) ? person.signals : [];
    const signal = signals.find((item) => item?.id === signalId);
    if (!signal) throw new Error("SIGNAL_NOT_FOUND");
    if (!["curto", "conversa", "audio", "video"].includes(tone)) throw new Error("COMPOSER_TONE_INVALID");
    const legacy = legacyComposerPreferences(tone);
    const plan = buildComposerPlan({
      person,
      signal,
      style: preferences.style || legacy.style,
      channel: preferences.channel || legacy.channel,
      objective: preferences.objective || legacy.objective
    });
    return {
      draft: plan.options[0]?.text || "",
      options: plan.options,
      stage: plan.stage,
      stageLabel: plan.stageLabel,
      objective: plan.objective,
      recommendedChannel: plan.recommendedChannel,
      recommendedStyle: plan.recommendedStyle,
      recommendation: plan.recommendation,
      why: plan.why,
      tip: plan.tip,
      nextSmallYes: plan.nextSmallYes,
      estimatedDurationSeconds: plan.estimatedDurationSeconds || null,
      factsUsed: plan.factsUsed,
      tone,
      personId: personDocumentId,
      signalId,
      phone: person.phone || null,
      evidence: signal.evidence || [],
      automaticSend: false
    };
  }
  async deleteSource(request, sourceId) {
    const context = await this.resolvePilotContext(request);
    const source = await this.vault.get(request.authToken, context.actorUid, ["personalSources", sourceId]);
    if (!source) return { success: true, deleted: false };
    const chunks = await this.vault.list(
      request.authToken,
      context.actorUid,
      ["personalConversations", sourceId, "messageChunks"],
      500
    );
    const people = await this.vault.list(request.authToken, context.actorUid, ["personalPeople"], 1500);
    const opportunityDocs = await this.vault.list(request.authToken, context.actorUid, ["relationshipOpportunities"], 1500);
    const paths = [
      ...chunks.map((chunk) => ["personalConversations", sourceId, "messageChunks", chunk.id]),
      ...people.filter((person) => person.sourceId === sourceId).map((person) => ["personalPeople", person.id]),
      ...opportunityDocs.filter((item) => item.sourceId === sourceId).map((item) => ["relationshipOpportunities", item.id]),
      ["personalConversations", sourceId],
      ["importRuns", sourceId],
      ["personalSources", sourceId]
    ];
    await this.vault.deleteMany(request.authToken, context.actorUid, paths);
    return { success: true, deleted: true };
  }
};

// src/personal/radar/personalRadarHttp.ts
var import_express = __toESM(require("express"), 1);
function authToken(req) {
  const raw = req.headers.authorization;
  if (typeof raw !== "string" || !/^Bearer\s+\S+$/i.test(raw.trim())) throw new Error("AUTH_REQUIRED");
  return raw.trim();
}
function organizationId(req) {
  const header = req.headers["x-organization-id"];
  const bodyValue = req.body && typeof req.body === "object" ? req.body.organizationId : void 0;
  const value = typeof header === "string" ? header.trim() : typeof bodyValue === "string" ? bodyValue.trim() : "";
  if (!value || value.length > 256 || value.includes("/") || value.includes("\\")) {
    throw new Error("ORGANIZATION_REQUIRED");
  }
  return value;
}
function safeId(value) {
  const clean = value.trim();
  if (!clean || clean.length > 180 || clean.includes("/") || clean.includes("\\") || clean === "." || clean === "..") {
    throw new Error("INVALID_ID");
  }
  return clean;
}
function statusFor(error) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  if (code === "AUTH_REQUIRED") return 401;
  if (["RADAR_CONTEXT_DENIED", "RADAR_PILOT_FORBIDDEN", "RADAR_TENANT_MISMATCH"].includes(code)) return 403;
  if (["PERSON_NOT_FOUND", "SIGNAL_NOT_FOUND"].includes(code)) return 404;
  if (["IMPORT_FILE_SIZE_INVALID", "IMPORT_MESSAGE_LIMIT_EXCEEDED"].includes(code)) return 413;
  if (code.startsWith("FIRESTORE_")) return 503;
  return 400;
}
function publicCode(error) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  if (code.startsWith("FIRESTORE_")) return "PERSONAL_VAULT_UNAVAILABLE";
  if (code === "RADAR_CONTEXT_DENIED") return "RADAR_CONTEXT_DENIED";
  if (code === "RADAR_PILOT_FORBIDDEN") return "RADAR_PILOT_FORBIDDEN";
  if (code === "RADAR_TENANT_MISMATCH") return "RADAR_TENANT_MISMATCH";
  return code.replace(/[^A-Z0-9_]/g, "") || "RADAR_REQUEST_FAILED";
}
function humanSummary(error) {
  const code = publicCode(error);
  if (code === "AUTH_REQUIRED") return "Sua sess\xE3o precisa ser confirmada novamente.";
  if (code === "RADAR_PILOT_FORBIDDEN") return "O Radar ainda est\xE1 em piloto privado para administra\xE7\xE3o do ecossistema.";
  if (code === "PERSONAL_VAULT_UNAVAILABLE") return "Seu cofre pessoal est\xE1 temporariamente indispon\xEDvel.";
  if (code === "WHATSAPP_FORMAT_UNRECOGNIZED") return "N\xE3o reconhecemos este arquivo como uma exporta\xE7\xE3o de conversa do WhatsApp.";
  if (code === "WHATSAPP_TXT_NOT_FOUND") return "O ZIP n\xE3o cont\xE9m um arquivo TXT de conversa do WhatsApp.";
  if (code === "IMPORT_FILE_TYPE_INVALID") return "Use uma exporta\xE7\xE3o TXT ou ZIP do WhatsApp.";
  if (code === "IMPORT_FILE_SIZE_INVALID") return "O arquivo \xE9 grande demais para este piloto. Use uma exporta\xE7\xE3o de at\xE9 5 MB.";
  if (code === "IMPORT_MESSAGE_LIMIT_EXCEEDED") return "A conversa ultrapassa o limite de mensagens deste piloto.";
  if (code === "PERSON_NOT_FOUND") return "Esta pessoa n\xE3o foi encontrada no seu cofre pessoal.";
  if (code === "SIGNAL_NOT_FOUND") return "Este sinal n\xE3o est\xE1 mais dispon\xEDvel.";
  if (code === "SEARCH_QUERY_INVALID") return "Digite pelo menos dois caracteres para pesquisar.";
  if (code === "SNOOZE_DAYS_INVALID") return "Escolha um adiamento entre 1 e 90 dias.";
  return "N\xE3o foi poss\xEDvel concluir esta opera\xE7\xE3o do Radar.";
}
function createPersonalRadarRouter(service) {
  const router = import_express.default.Router();
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    next();
  });
  const execute = (handler) => async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      return res.status(statusFor(error)).json({
        success: false,
        code: publicCode(error),
        humanSummary: humanSummary(error)
      });
    }
  };
  router.post(
    "/imports/whatsapp",
    import_express.default.json({ limit: "8mb" }),
    execute(async (req, res) => {
      const body = req.body;
      const result = await service.importWhatsApp(
        { authToken: authToken(req), organizationId: organizationId(req) },
        {
          fileName: typeof body.fileName === "string" ? body.fileName : "",
          contentBase64: typeof body.contentBase64 === "string" ? body.contentBase64 : "",
          selfNames: Array.isArray(body.selfNames) ? body.selfNames : []
        }
      );
      return res.status(result.status === "deduplicated" ? 200 : 201).json({ success: true, ...result });
    })
  );
  router.get("/radar", execute(async (req, res) => {
    const result = await service.getRadar({
      authToken: authToken(req),
      organizationId: organizationId(req)
    });
    return res.status(200).json({ success: true, ...result });
  }));
  router.get("/search", execute(async (req, res) => {
    const result = await service.search(
      { authToken: authToken(req), organizationId: organizationId(req) },
      typeof req.query.q === "string" ? req.query.q : ""
    );
    return res.status(200).json({ success: true, ...result });
  }));
  router.patch(
    "/people/:personId",
    import_express.default.json({ limit: "32kb" }),
    execute(async (req, res) => {
      const body = req.body;
      const result = await service.updatePerson(
        { authToken: authToken(req), organizationId: organizationId(req) },
        safeId(req.params.personId),
        {
          phone: typeof body.phone === "string" ? body.phone : void 0,
          radarState: typeof body.radarState === "string" ? body.radarState : void 0,
          snoozeDays: typeof body.snoozeDays === "number" ? body.snoozeDays : void 0
        }
      );
      return res.status(200).json(result);
    })
  );
  router.post(
    "/opportunities/:personId/promote",
    import_express.default.json({ limit: "16kb" }),
    execute(async (req, res) => {
      const result = await service.promoteOpportunity(
        { authToken: authToken(req), organizationId: organizationId(req) },
        safeId(req.params.personId)
      );
      return res.status(200).json(result);
    })
  );
  router.post(
    "/composer/draft",
    import_express.default.json({ limit: "32kb" }),
    execute(async (req, res) => {
      const body = req.body;
      const result = await service.compose(
        { authToken: authToken(req), organizationId: organizationId(req) },
        safeId(String(body.personId || "")),
        safeId(String(body.signalId || "")),
        String(body.tone || "curto"),
        {
          style: typeof body.style === "string" ? body.style : void 0,
          channel: typeof body.channel === "string" ? body.channel : void 0,
          objective: typeof body.objective === "string" ? body.objective : void 0
        }
      );
      return res.status(200).json({ success: true, ...result });
    })
  );
  router.delete("/sources/:sourceId", execute(async (req, res) => {
    const result = await service.deleteSource(
      { authToken: authToken(req), organizationId: organizationId(req) },
      safeId(req.params.sourceId)
    );
    return res.status(200).json(result);
  }));
  return router;
}

// src/server/createConnectServer.ts
function createConnectServer(options = {}) {
  const app2 = (0, import_express2.default)();
  const logger = options.logger ?? console;
  const env = options.env ?? process.env;
  let core = options.core ?? null;
  let handler = core ? createConnectCoreHttpHandler(core) : null;
  let sessionHandler = null;
  let personalRadarRouter = null;
  const hubOrigin = env.MILLIONSNEST_HUB_ORIGIN?.trim();
  if (hubOrigin) {
    try {
      sessionHandler = createConnectSessionHttpHandler({
        hubOrigin,
        fetchImpl: options.fetchImpl
      });
      const personalContextProvider = new HubSessionContextHttpProvider({
        hubOrigin,
        fetchImpl: options.fetchImpl ? ((input, init) => options.fetchImpl(input, init)) : void 0
      });
      const vault = new FirestorePersonalVault({
        projectId: env.FIREBASE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || "millionsnest",
        fetchImpl: options.fetchImpl
      });
      const personalRadar = new PersonalRadarService(
        personalContextProvider,
        vault,
        Date.now,
        logger
      );
      personalRadarRouter = createPersonalRadarRouter(personalRadar);
    } catch (error) {
      logger.error?.("CONNECT_SESSION_CONFIGURATION_ERROR", {
        error: error instanceof Error ? error.message : "unknown_error"
      });
    }
  }
  app2.disable("x-powered-by");
  if (personalRadarRouter) {
    app2.use("/api/personal", personalRadarRouter);
  }
  app2.use(import_express2.default.json({ limit: "32kb" }));
  app2.get("/api/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      service: "millionsnest-connect-core",
      protocolVersion: "1.0.0"
    });
  });
  app2.get("/api/core/session", async (req, res) => {
    if (!sessionHandler) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).json({
        success: false,
        code: "CORE_CONFIGURATION_MISSING",
        humanSummary: "O Connect Core ainda n\xE3o est\xE1 configurado neste ambiente."
      });
    }
    return sessionHandler(req, res);
  });
  app2.post("/api/core/message", async (req, res) => {
    if (!handler) {
      try {
        core = createConnectCoreRuntime({
          env,
          logger,
          fetchImpl: options.fetchImpl
        });
        handler = createConnectCoreHttpHandler(core);
      } catch (error) {
        logger.error?.("CONNECT_CORE_CONFIGURATION_ERROR", {
          error: error instanceof Error ? error.message : "unknown_error"
        });
        res.setHeader("Cache-Control", "no-store");
        return res.status(503).json({
          status: "failed",
          code: "CORE_CONFIGURATION_MISSING",
          humanSummary: "O Connect Core ainda n\xE3o est\xE1 configurado neste ambiente."
        });
      }
    }
    return handler(req, res);
  });
  app2.use((error, _req, res, _next) => {
    res.setHeader("Cache-Control", "no-store");
    if (error?.type === "entity.too.large") {
      return res.status(413).json({
        status: "failed",
        code: "PAYLOAD_TOO_LARGE",
        humanSummary: "A mensagem enviada \xE9 grande demais."
      });
    }
    if (error instanceof SyntaxError) {
      return res.status(400).json({
        status: "failed",
        code: "INVALID_JSON_BODY",
        humanSummary: "O corpo da requisi\xE7\xE3o \xE9 inv\xE1lido."
      });
    }
    logger.error?.("CONNECT_CORE_HTTP_ERROR", {
      error: error instanceof Error ? error.message : "unknown_error"
    });
    return res.status(500).json({
      status: "failed",
      code: "INTERNAL_ERROR",
      humanSummary: "O Connect encontrou um erro inesperado."
    });
  });
  return app2;
}

// server.ts
import_dotenv.default.config();
var port = Number(process.env.PORT || 8080);
var app = createConnectServer();
app.listen(port, "0.0.0.0", () => {
  console.info("CONNECT_CORE_SERVER_STARTED", {
    port,
    service: "millionsnest-connect-core"
  });
});
//# sourceMappingURL=server.cjs.map
