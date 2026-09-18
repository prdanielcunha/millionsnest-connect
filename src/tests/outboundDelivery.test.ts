import {
  buildOutboundDeliveryAuditRecord,
  evaluateOutboundDelivery,
  type OutboundDeliveryAuthority,
  type OutboundDeliveryRequest,
} from '../core/services/outboundDelivery';

let passed = 0;
let total = 0;

function checkEqual(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual === expected) {
    passed++;
    return;
  }
  console.error(`❌ ${message} - Expected: ${String(expected)}, Actual: ${String(actual)}`);
  throw new Error(message);
}

function validAuthority(): OutboundDeliveryAuthority {
  return {
    organizationId: 'org_123',
    sourceApp: 'nestlocal',
    capabilities: ['channels.whatsapp.send'],
  };
}

function validRequest(): OutboundDeliveryRequest {
  return {
    requestId: 'req_12345678',
    organizationId: 'org_123',
    sourceApp: 'nestlocal',
    channel: 'whatsapp',
    category: 'service_update',
    recipient: { kind: 'phone', value: '5543999999999' },
    templateName: 'nestlocal_service_update',
    language: 'pt_BR',
    consentEvidenceRef: 'nestlocal-consent:req_12345678',
    idempotencyKey: 'nestlocal:req_12345678:service_update:v1',
    variables: {
      customer_name: 'Cliente Exemplo',
      request_status: 'scheduled',
    },
  };
}

console.log('--- Running Outbound Delivery Contract Tests ---');

{
  const authority = validAuthority();
  const request = validRequest();
  request.organizationId = 'org_other';
  const decision = evaluateOutboundDelivery(authority, request);
  checkEqual(decision.status, 'blocked', 'tenant mismatch blocks');
  checkEqual(decision.reason, 'TENANT_MISMATCH', 'tenant mismatch reason');
}

{
  const authority = validAuthority();
  const request = validRequest();
  request.sourceApp = 'musicscale';
  const decision = evaluateOutboundDelivery(authority, request);
  checkEqual(decision.reason, 'SOURCE_APP_MISMATCH', 'source app mismatch blocks');
}

{
  const authority = validAuthority();
  authority.capabilities = [];
  const decision = evaluateOutboundDelivery(authority, validRequest());
  checkEqual(decision.reason, 'CAPABILITY_REQUIRED', 'capability required');
}

{
  const request = validRequest();
  request.recipient.value = '123';
  const decision = evaluateOutboundDelivery(validAuthority(), request);
  checkEqual(decision.reason, 'INVALID_DESTINATION', 'invalid phone blocks');
}


{
  const request = validRequest() as unknown as Record<string, unknown>;
  request.category = 'marketing';
  const decision = evaluateOutboundDelivery(validAuthority(), request as unknown as OutboundDeliveryRequest);
  checkEqual(decision.reason, 'INVALID_CATEGORY', 'invalid category blocks');
}

{
  const request = validRequest() as unknown as Record<string, unknown>;
  request.language = 'fr_FR';
  const decision = evaluateOutboundDelivery(validAuthority(), request as unknown as OutboundDeliveryRequest);
  checkEqual(decision.reason, 'UNSUPPORTED_LANGUAGE', 'unsupported language blocks');
}

{
  const request = validRequest();
  request.templateName = 'Template With Spaces';
  const decision = evaluateOutboundDelivery(validAuthority(), request);
  checkEqual(decision.reason, 'APPROVED_TEMPLATE_REQUIRED', 'approved template naming required');
}

{
  const request = validRequest();
  request.consentEvidenceRef = '';
  const decision = evaluateOutboundDelivery(validAuthority(), request);
  checkEqual(decision.reason, 'CONSENT_EVIDENCE_REQUIRED', 'consent evidence required');
}

{
  const request = validRequest();
  request.idempotencyKey = '';
  const decision = evaluateOutboundDelivery(validAuthority(), request);
  checkEqual(decision.reason, 'IDEMPOTENCY_KEY_REQUIRED', 'idempotency required');
}

{
  const authority = validAuthority();
  const request = validRequest();
  const decision = evaluateOutboundDelivery(authority, request);
  checkEqual(decision.status, 'blocked', 'current paid provider policy blocks real delivery');
  checkEqual(decision.reason, 'PROVIDER_POLICY_BLOCKED', 'provider policy block reason');
  checkEqual(decision.providerPolicy?.resourceId, 'meta.whatsapp', 'provider policy resource');
  checkEqual(decision.providerPolicy?.financialCostBrl, 0, 'no cost incurred when blocked');

  const audit = buildOutboundDeliveryAuditRecord(authority, request, decision);
  checkEqual(audit.recipientMasked, '***9999', 'audit masks recipient');
  checkEqual('variables' in (audit as unknown as Record<string, unknown>), false, 'audit excludes template variables');
  checkEqual(JSON.stringify(audit).includes('5543999999999'), false, 'audit excludes full phone');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
