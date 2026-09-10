import { CanonicalContextProvider, ConnectCoreService, CoreAuditPort, MusicScaleReadToolPort } from '../core/runtime/connectCore';
import { createConnectCoreHttpHandler } from '../core/runtime/connectCoreHttpHandler';

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

function createResponseRecorder() {
  const captured = { status: 0, payload: null as any, headers: {} as Record<string, string> };
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: unknown) {
      captured.payload = payload;
      return payload;
    },
    setHeader(name: string, value: string) {
      captured.headers[name] = value;
    },
  };
  return { captured, response };
}

function createCore(overrides?: {
  contextProvider?: CanonicalContextProvider;
  tool?: MusicScaleReadToolPort;
  audit?: CoreAuditPort;
}) {
  const contextProvider: CanonicalContextProvider = overrides?.contextProvider ?? {
    async resolve({ requestedOrganizationId }) {
      return {
        status: 'resolved',
        context: {
          actorUid: 'user-01',
          systemRole: null,
          globalAccess: false,
          organizationId: requestedOrganizationId || 'org-01',
          organizationRole: 'member',
          permissions: [],
          capabilities: [],
          appAccess: { musicscale: true },
        },
      };
    },
  };

  const tool: MusicScaleReadToolPort = overrides?.tool ?? {
    async getNextSchedule(input) {
      return {
        status: 'success',
        auditId: 'audit-ms-01',
        humanSummary: 'Sua próxima escala é amanhã, às 19:00.',
        deepLink: '/scales/scale-01',
        data: {
          id: 'scale-01',
          organizationId: input.organizationId,
        },
      };
    },
  };

  const audit: CoreAuditPort = overrides?.audit ?? { async record() {} };
  return new ConnectCoreService(contextProvider, tool, audit);
}

console.log('--- Running Connect Core HTTP Handler Tests ---');

{
  let contextCalls = 0;
  const core = createCore({
    contextProvider: {
      async resolve() {
        contextCalls++;
        throw new Error('should not execute');
      },
    },
  });
  const handler = createConnectCoreHttpHandler(core, {
    createRequestId: () => 'req-fixed',
    createCorrelationId: () => 'cor-fixed',
  });
  const { captured, response } = createResponseRecorder();

  await handler({ headers: {}, body: { text: 'Qual é minha próxima escala?' } }, response);

  checkEqual(captured.status, 401, 'missing bearer is rejected at HTTP boundary');
  checkEqual(captured.payload.code, 'AUTH_REQUIRED', 'missing bearer exposes safe auth code');
  checkEqual(contextCalls, 0, 'missing bearer never reaches Core context resolution');
  checkEqual(captured.headers['Cache-Control'], 'no-store', 'responses are never cacheable');
}

{
  const core = createCore();
  const handler = createConnectCoreHttpHandler(core, {
    createRequestId: () => 'req-fixed',
    createCorrelationId: () => 'cor-fixed',
  });
  const { captured, response } = createResponseRecorder();

  await handler({ headers: { authorization: 'Bearer token' }, body: {} }, response);

  checkEqual(captured.status, 400, 'empty message is rejected');
  checkEqual(captured.payload.code, 'MESSAGE_REQUIRED', 'empty message has explicit code');
}

{
  let toolCalls = 0;
  let seenBearer = '';
  let seenOrg = '';
  let seenChannel = '';
  const core = createCore({
    tool: {
      async getNextSchedule(input) {
        toolCalls++;
        seenBearer = input.authToken;
        seenOrg = input.organizationId;
        seenChannel = input.channel.type;
        return {
          status: 'success',
          auditId: 'audit-ms-01',
          humanSummary: 'Sua próxima escala é amanhã, às 19:00.',
          deepLink: '/scales/scale-01',
          data: { id: 'scale-01', organizationId: input.organizationId },
        };
      },
    },
  });
  const handler = createConnectCoreHttpHandler(core, {
    createRequestId: () => 'req-fixed',
    createCorrelationId: () => 'cor-fixed',
  });
  const { captured, response } = createResponseRecorder();

  await handler(
    {
      headers: { authorization: 'Bearer real-user-token' },
      body: {
        text: 'Qual é minha próxima escala?',
        requestedOrganizationId: 'org-01',
        locale: 'pt-BR',
        conversationId: 'conv-inapp-01',
      },
    },
    response,
  );

  checkEqual(captured.status, 200, 'authorized in-app request succeeds');
  checkEqual(captured.payload.status, 'success', 'Core success is preserved');
  checkEqual(captured.payload.auditId, 'audit-ms-01', 'MusicScale audit id reaches caller');
  checkEqual(captured.payload.requestId, 'req-fixed', 'server request id is exposed for support');
  checkEqual(captured.payload.correlationId, 'cor-fixed', 'server correlation id is exposed for support');
  checkEqual(toolCalls, 1, 'MusicScale tool is invoked once');
  checkEqual(seenBearer, 'Bearer real-user-token', 'same user bearer reaches final authority boundary');
  checkEqual(seenOrg, 'org-01', 'canonical organization reaches final authority boundary');
  checkEqual(seenChannel, 'inapp', 'browser cannot promote itself to another channel');
}

{
  const core = createCore({
    contextProvider: {
      async resolve() {
        return { status: 'organization_required', reason: 'De qual igreja/organização você está falando?' };
      },
    },
  });
  const handler = createConnectCoreHttpHandler(core, {
    createRequestId: () => 'req-fixed',
    createCorrelationId: () => 'cor-fixed',
  });
  const { captured, response } = createResponseRecorder();

  await handler(
    { headers: { authorization: 'Bearer token' }, body: { text: 'Minha próxima escala' } },
    response,
  );

  checkEqual(captured.status, 409, 'organization choice is represented as a context conflict');
  checkEqual(captured.payload.code, 'ORGANIZATION_REQUIRED', 'organization choice keeps explicit code');
}

{
  const core = createCore({
    contextProvider: {
      async resolve() {
        return { status: 'denied', reason: 'Acesso negado.' };
      },
    },
  });
  const handler = createConnectCoreHttpHandler(core, {
    createRequestId: () => 'req-fixed',
    createCorrelationId: () => 'cor-fixed',
  });
  const { captured, response } = createResponseRecorder();

  await handler(
    { headers: { authorization: 'Bearer token' }, body: { text: 'Minha próxima escala' } },
    response,
  );

  checkEqual(captured.status, 403, 'canonical denial is an HTTP 403');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
