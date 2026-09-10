import {
  CanonicalContextProvider,
  ConnectCoreService,
  CoreAuditEvent,
  CoreAuditPort,
  MusicScaleReadToolPort,
  resolveConnectCoreIntent,
} from '../core/runtime/connectCore';

let passed = 0;
let total = 0;

function checkEqual(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) {
    console.error(`❌ ${message} - Expected: ${String(expected)}, Actual: ${String(actual)}`);
    throw new Error(message);
  }
  passed++;
}

function createResolvedContextProvider(overrides?: {
  organizationId?: string;
  musicscaleAccess?: boolean;
  permissions?: string[];
  capabilities?: string[];
  globalAccess?: boolean;
}): CanonicalContextProvider {
  return {
    async resolve() {
      return {
        status: 'resolved',
        context: {
          actorUid: 'user_01',
          systemRole: 'user',
          globalAccess: overrides?.globalAccess ?? false,
          organizationId: overrides?.organizationId ?? 'org_01',
          organizationRole: 'member',
          permissions: overrides?.permissions ?? ['musicscale.schedules.view'],
          capabilities: overrides?.capabilities ?? [],
          appAccess: { musicscale: overrides?.musicscaleAccess ?? true },
        },
      };
    },
  };
}

function createAuditPort(events: CoreAuditEvent[], shouldFail = false): CoreAuditPort {
  return {
    async record(event) {
      if (shouldFail) throw new Error('audit unavailable');
      events.push(event);
    },
  };
}

function createToolPort(counter: { calls: number }): MusicScaleReadToolPort {
  return {
    async getNextSchedule(input) {
      counter.calls++;
      checkEqual(
        input.requiredPermission,
        'musicscale.schedules.view',
        'Core forwards the canonical required permission to Tool Gateway port',
      );
      return {
        status: 'success',
        data: {
          organizationId: input.organizationId,
          eventName: 'Culto de domingo',
        },
        humanSummary: 'Sua próxima escala é no domingo.',
        auditId: 'audit_music_01',
        deepLink: '/scales/next',
      };
    },
  };
}

function baseRequest() {
  return {
    requestId: 'req_01',
    correlationId: 'cor_01',
    authToken: 'Bearer token-from-canonical-session',
    requestedOrganizationId: 'org_01',
    channel: { type: 'inapp', conversationId: 'conv_01' },
    locale: 'pt-BR',
    text: 'Qual é minha próxima escala?',
  };
}

console.log('--- Running Connect Core Runtime Foundation Tests ---');

checkEqual(
  resolveConnectCoreIntent('Qual é minha PRÓXIMA escala?'),
  'get_next_schedule',
  'PT-BR next schedule intent is recognized',
);
checkEqual(
  resolveConnectCoreIntent('What is my next schedule?'),
  'get_next_schedule',
  'EN next schedule intent is recognized',
);
checkEqual(
  resolveConnectCoreIntent('Cual es mi próxima escala?'),
  'get_next_schedule',
  'ES next schedule intent is recognized',
);
checkEqual(
  resolveConnectCoreIntent('Quero alterar o plano'),
  'unknown',
  'unknown intent is not silently mapped to MusicScale',
);

{
  const events: CoreAuditEvent[] = [];
  const toolCounter = { calls: 0 };
  let contextCalls = 0;
  const contextProvider: CanonicalContextProvider = {
    async resolve() {
      contextCalls++;
      return createResolvedContextProvider().resolve({ authToken: 'unused' });
    },
  };
  const service = new ConnectCoreService(
    contextProvider,
    createToolPort(toolCounter),
    createAuditPort(events),
  );

  const result = await service.handleMessage({ ...baseRequest(), authToken: undefined });
  checkEqual(result.status, 'needs_context', 'missing auth fails closed');
  checkEqual('code' in result ? result.code : '', 'AUTH_REQUIRED', 'missing auth exposes safe context action');
  checkEqual(contextCalls, 0, 'missing auth never reaches canonical context provider');
  checkEqual(toolCounter.calls, 0, 'missing auth never reaches MusicScale tool');
}

{
  const events: CoreAuditEvent[] = [];
  const toolCounter = { calls: 0 };
  const service = new ConnectCoreService(
    createResolvedContextProvider({ organizationId: 'org_02' }),
    createToolPort(toolCounter),
    createAuditPort(events),
  );

  const result = await service.handleMessage(baseRequest());
  checkEqual(result.status, 'denied', 'canonical tenant mismatch is denied');
  checkEqual('code' in result ? result.code : '', 'CONTEXT_MISMATCH', 'tenant mismatch has explicit safe code');
  checkEqual(toolCounter.calls, 0, 'tenant mismatch never reaches MusicScale tool');
}

{
  const events: CoreAuditEvent[] = [];
  const toolCounter = { calls: 0 };
  const service = new ConnectCoreService(
    createResolvedContextProvider({ musicscaleAccess: false }),
    createToolPort(toolCounter),
    createAuditPort(events),
  );

  const result = await service.handleMessage(baseRequest());
  checkEqual(result.status, 'denied', 'app access is enforced before tool invocation');
  checkEqual('code' in result ? result.code : '', 'APP_ACCESS_DENIED', 'app access denial is explicit');
  checkEqual(toolCounter.calls, 0, 'denied app access never invokes MusicScale');
}

{
  const events: CoreAuditEvent[] = [];
  const toolCounter = { calls: 0 };
  const service = new ConnectCoreService(
    createResolvedContextProvider({ permissions: [] }),
    createToolPort(toolCounter),
    createAuditPort(events),
  );

  const result = await service.handleMessage(baseRequest());
  checkEqual(result.status, 'success', 'Core does not invent a local permission bypass or deny policy');
  checkEqual(toolCounter.calls, 1, 'Tool Gateway port remains the final permission authority');
}

{
  const events: CoreAuditEvent[] = [];
  const toolCounter = { calls: 0 };
  const service = new ConnectCoreService(
    createResolvedContextProvider(),
    createToolPort(toolCounter),
    createAuditPort(events),
  );

  const result = await service.handleMessage({ ...baseRequest(), text: 'Me ajuda com outra coisa' });
  checkEqual(result.status, 'unsupported', 'unknown intent stays unsupported');
  checkEqual('code' in result ? result.code : '', 'UNSUPPORTED_INTENT', 'unsupported intent has explicit code');
  checkEqual(toolCounter.calls, 0, 'unsupported intent does not reach MusicScale');
}

{
  const events: CoreAuditEvent[] = [];
  const toolCounter = { calls: 0 };
  const service = new ConnectCoreService(
    createResolvedContextProvider(),
    createToolPort(toolCounter),
    createAuditPort(events),
  );

  const result = await service.handleMessage(baseRequest());
  checkEqual(result.status, 'success', 'authorized next schedule flow reaches success');
  checkEqual(toolCounter.calls, 1, 'authorized flow invokes MusicScale exactly once');
  checkEqual(events.some((event) => event.eventType === 'core_request_received'), true, 'request acceptance is audited');
  checkEqual(events.some((event) => event.eventType === 'core_tool_completed'), true, 'tool completion is audited');
  checkEqual(
    events.some((event) => event.details.includes(baseRequest().authToken)),
    false,
    'audit never records raw auth token',
  );
}

{
  const events: CoreAuditEvent[] = [];
  const toolCounter = { calls: 0 };
  const service = new ConnectCoreService(
    createResolvedContextProvider(),
    createToolPort(toolCounter),
    createAuditPort(events, true),
  );

  const result = await service.handleMessage(baseRequest());
  checkEqual(result.status, 'failed', 'audit failure blocks the read-only tool execution');
  checkEqual('code' in result ? result.code : '', 'AUDIT_UNAVAILABLE', 'audit failure is explicit');
  checkEqual(toolCounter.calls, 0, 'tool is not invoked if pre-execution audit cannot be recorded');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
