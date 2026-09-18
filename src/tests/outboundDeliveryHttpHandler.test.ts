import {
  createOutboundDeliveryHttpHandler,
} from '../core/runtime/outboundDeliveryHttpHandler';
import type {
  CanonicalContextProvider,
  CanonicalContextResolution,
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

function request(overrides: Record<string, unknown> = {}) {
  return {
    requestId: 'req_12345678',
    organizationId: 'org_01',
    sourceApp: 'nestlocal',
    channel: 'whatsapp',
    category: 'maintenance_reminder',
    recipient: { kind: 'phone', value: '5543987654321' },
    templateName: 'nestlocal_maintenance_reminder',
    language: 'pt_BR',
    consentEvidenceRef: 'nestlocal-consent:customer_01:maintenance_reminders',
    idempotencyKey: 'nestlocal:customer_01:maintenance:2026-09-18',
    variables: { customer_name: 'Pessoa Exemplo' },
    ...overrides,
  };
}

function resolvedContext(
  nestlocal = true,
  organizationId = 'org_01',
): CanonicalContextResolution {
  return {
    status: 'resolved',
    context: {
      actorUid: 'user_123456',
      systemRole: null,
      globalAccess: false,
      organizationId,
      organizationRole: 'owner',
      permissions: ['nestlocal.manage'],
      capabilities: [],
      appAccess: {
        musicscale: false,
        nestlocal,
      },
    },
  };
}

function mockReq(body: unknown, authorization = 'Bearer firebase-token') {
  return {
    headers: { authorization },
    body,
  } as any;
}

function mockRes() {
  const state: any = { statusCode: 200, body: null, headers: {} };
  state.setHeader = (key: string, value: string) => {
    state.headers[key.toLowerCase()] = value;
    return state;
  };
  state.status = (code: number) => {
    state.statusCode = code;
    return state;
  };
  state.json = (body: unknown) => {
    state.body = body;
    return state;
  };
  return state;
}

function provider(result: CanonicalContextResolution): CanonicalContextProvider {
  return {
    async resolve() {
      return result;
    },
  };
}

console.log('--- Running Outbound Delivery HTTP Validation Tests ---');

{
  const handler = createOutboundDeliveryHttpHandler({
    contextProvider: provider(resolvedContext()),
    env: {},
  });
  const res = mockRes();
  await handler(mockReq(request(), ''), res);
  checkEqual(res.statusCode, 401, 'missing bearer is blocked');
  checkEqual(res.body.code, 'AUTH_REQUIRED', 'missing bearer code');
}

{
  const handler = createOutboundDeliveryHttpHandler({
    contextProvider: provider({
      status: 'identity_required',
      reason: 'identity',
    }),
    env: {},
  });
  const res = mockRes();
  await handler(mockReq(request()), res);
  checkEqual(res.statusCode, 401, 'Hub identity requirement remains blocked');
  checkEqual(res.body.code, 'IDENTITY_REQUIRED', 'identity requirement code');
}

{
  const handler = createOutboundDeliveryHttpHandler({
    contextProvider: provider(resolvedContext(false)),
    env: {},
  });
  const res = mockRes();
  await handler(mockReq(request()), res);
  checkEqual(res.statusCode, 403, 'missing NestLocal app access is denied');
  checkEqual(res.body.code, 'NESTLOCAL_ACCESS_DENIED', 'NestLocal app access code');
}

{
  const contextProvider: CanonicalContextProvider = {
    async resolve({ requestedOrganizationId }) {
      checkEqual(requestedOrganizationId, 'org_01', 'requested tenant is sent to canonical context provider');
      return resolvedContext(true, 'org_02');
    },
  };
  const handler = createOutboundDeliveryHttpHandler({
    contextProvider,
    env: {},
  });
  const res = mockRes();
  await handler(mockReq(request()), res);
  checkEqual(res.statusCode, 409, 'canonical tenant mismatch is denied');
  checkEqual(res.body.code, 'TENANT_MISMATCH', 'tenant mismatch code');
}

{
  const handler = createOutboundDeliveryHttpHandler({
    contextProvider: provider(resolvedContext()),
    env: {},
  });
  const res = mockRes();
  await handler(mockReq(request({ sourceApp: 'musicscale' })), res);
  checkEqual(res.statusCode, 200, 'source mismatch is a validation result');
  checkEqual(res.body.status, 'blocked', 'source mismatch blocks');
  checkEqual(res.body.reason, 'SOURCE_APP_MISMATCH', 'source app is server-bound');
  checkEqual(res.body.dispatch, 'not_implemented', 'validation boundary never dispatches');
}

{
  const handler = createOutboundDeliveryHttpHandler({
    contextProvider: provider(resolvedContext()),
    env: { CONNECT_WHATSAPP_OUTBOUND_VALIDATION_ENABLED: 'false' },
  });
  const res = mockRes();
  await handler(mockReq(request()), res);
  checkEqual(res.statusCode, 200, 'disabled validation channel returns decision');
  checkEqual(res.body.reason, 'CAPABILITY_REQUIRED', 'client cannot invent channel capability');
  checkEqual(res.body.dispatch, 'not_implemented', 'disabled channel never dispatches');
}

{
  let auditMeta: Record<string, unknown> | undefined;
  const handler = createOutboundDeliveryHttpHandler({
    contextProvider: provider(resolvedContext()),
    env: { CONNECT_WHATSAPP_OUTBOUND_VALIDATION_ENABLED: 'true' },
    logger: {
      info(_message, meta) {
        auditMeta = meta;
      },
    },
  });
  const res = mockRes();
  const body = request();
  await handler(mockReq(body), res);
  checkEqual(res.statusCode, 200, 'enabled validation path returns policy decision');
  checkEqual(res.body.status, 'blocked', 'paid provider is still blocked');
  checkEqual(res.body.reason, 'PROVIDER_POLICY_BLOCKED', 'zero-cost policy remains authoritative');
  checkEqual(res.body.providerPolicy.resourceId, 'meta.whatsapp', 'provider policy identifies WhatsApp resource');
  checkEqual(res.body.providerPolicy.financialCostBrl, 0, 'blocked validation incurs zero cost');
  checkEqual(res.body.dispatch, 'not_implemented', 'provider dispatch is absent');

  const serializedAudit = JSON.stringify(auditMeta);
  const serializedResponse = JSON.stringify(res.body);
  checkEqual(serializedAudit.includes('5543987654321'), false, 'audit excludes full phone');
  checkEqual(serializedAudit.includes('Pessoa Exemplo'), false, 'audit excludes template variables');
  checkEqual(serializedResponse.includes('5543987654321'), false, 'response excludes full phone');
  checkEqual(serializedResponse.includes('Pessoa Exemplo'), false, 'response excludes template variables');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
