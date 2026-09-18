import { evaluateZeroCostPolicy } from '../policies/zeroCost/zeroCostPolicy';
import { normalizeWhatsAppPhone } from '../client/whatsappDelivery';

export type OutboundDeliveryChannel = 'whatsapp';
export type OutboundDeliveryCategory = 'service_update' | 'maintenance_reminder';

export interface OutboundDeliveryAuthority {
  organizationId: string;
  sourceApp: string;
  capabilities: string[];
}

export interface OutboundDeliveryRequest {
  requestId: string;
  organizationId: string;
  sourceApp: string;
  channel: OutboundDeliveryChannel;
  category: OutboundDeliveryCategory;
  recipient: {
    kind: 'phone';
    value: string;
  };
  templateName: string;
  language: 'pt_BR' | 'en_US' | 'es';
  consentEvidenceRef: string;
  idempotencyKey: string;
  variables?: Record<string, string>;
}

export type OutboundDeliveryBlockReason =
  | 'INVALID_REQUEST'
  | 'TENANT_MISMATCH'
  | 'SOURCE_APP_MISMATCH'
  | 'CAPABILITY_REQUIRED'
  | 'INVALID_DESTINATION'
  | 'APPROVED_TEMPLATE_REQUIRED'
  | 'CONSENT_EVIDENCE_REQUIRED'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'PROVIDER_POLICY_BLOCKED';

export interface OutboundDeliveryDecision {
  status: 'eligible' | 'blocked';
  reason?: OutboundDeliveryBlockReason;
  normalized?: {
    organizationId: string;
    sourceApp: string;
    channel: OutboundDeliveryChannel;
    category: OutboundDeliveryCategory;
    recipientPhone: string;
    templateName: string;
    language: OutboundDeliveryRequest['language'];
    consentEvidenceRef: string;
    idempotencyKey: string;
    variables: Record<string, string>;
  };
  providerPolicy?: {
    resourceId: string;
    status: string;
    reason?: string;
    financialCostBrl: number;
  };
}

export interface OutboundDeliveryAuditRecord {
  requestId: string;
  organizationId: string;
  sourceApp: string;
  channel: OutboundDeliveryChannel;
  category: OutboundDeliveryCategory;
  recipientMasked: string;
  templateName: string;
  consentEvidenceRef: string;
  idempotencyKey: string;
  decision: 'eligible' | 'blocked';
  blockReason?: OutboundDeliveryBlockReason;
}

const TEMPLATE_NAME = /^[a-z0-9_]{1,512}$/;
const SAFE_REF = /^[a-zA-Z0-9._:/-]{3,260}$/;
const SAFE_IDEMPOTENCY = /^[a-zA-Z0-9._:/-]{8,220}$/;
const SAFE_SOURCE_APP = /^[a-z0-9_-]{2,80}$/;
const REQUIRED_CAPABILITY = 'channels.whatsapp.send';

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeVariables(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .slice(0, 20)
    .map(([key, raw]) => [
      clean(key).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 50),
      clean(raw).slice(0, 500),
    ] as const)
    .filter(([key]) => Boolean(key));
  return Object.fromEntries(entries);
}

function maskPhone(phone: string): string {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return '***';
  return normalized.length <= 4 ? '***' : `***${normalized.slice(-4)}`;
}

/**
 * Validates an outbound delivery request without sending anything.
 *
 * The authority object must come from a server-side authenticated boundary.
 * Browser-supplied roles/capabilities must never be used to construct it.
 */
export function evaluateOutboundDelivery(
  authority: OutboundDeliveryAuthority,
  request: OutboundDeliveryRequest,
): OutboundDeliveryDecision {
  const organizationId = clean(request.organizationId);
  const sourceApp = clean(request.sourceApp).toLowerCase();
  const requestId = clean(request.requestId);

  if (!requestId || !organizationId || !sourceApp || !SAFE_SOURCE_APP.test(sourceApp)) {
    return { status: 'blocked', reason: 'INVALID_REQUEST' };
  }

  if (organizationId !== clean(authority.organizationId)) {
    return { status: 'blocked', reason: 'TENANT_MISMATCH' };
  }

  if (sourceApp !== clean(authority.sourceApp).toLowerCase()) {
    return { status: 'blocked', reason: 'SOURCE_APP_MISMATCH' };
  }

  if (!Array.isArray(authority.capabilities) || !authority.capabilities.includes(REQUIRED_CAPABILITY)) {
    return { status: 'blocked', reason: 'CAPABILITY_REQUIRED' };
  }

  const recipientPhone = normalizeWhatsAppPhone(request.recipient?.value);
  if (request.channel !== 'whatsapp' || request.recipient?.kind !== 'phone' || !recipientPhone) {
    return { status: 'blocked', reason: 'INVALID_DESTINATION' };
  }

  const templateName = clean(request.templateName).toLowerCase();
  if (!TEMPLATE_NAME.test(templateName)) {
    return { status: 'blocked', reason: 'APPROVED_TEMPLATE_REQUIRED' };
  }

  const consentEvidenceRef = clean(request.consentEvidenceRef);
  if (!SAFE_REF.test(consentEvidenceRef)) {
    return { status: 'blocked', reason: 'CONSENT_EVIDENCE_REQUIRED' };
  }

  const idempotencyKey = clean(request.idempotencyKey);
  if (!SAFE_IDEMPOTENCY.test(idempotencyKey)) {
    return { status: 'blocked', reason: 'IDEMPOTENCY_KEY_REQUIRED' };
  }

  const providerPolicy = evaluateZeroCostPolicy('meta.whatsapp');
  const providerDecision = {
    resourceId: providerPolicy.resource,
    status: providerPolicy.status,
    reason: providerPolicy.reason,
    financialCostBrl: providerPolicy.financialCostBrl,
  };

  if (!['allowed', 'near_limit'].includes(providerPolicy.status)) {
    return {
      status: 'blocked',
      reason: 'PROVIDER_POLICY_BLOCKED',
      providerPolicy: providerDecision,
    };
  }

  return {
    status: 'eligible',
    normalized: {
      organizationId,
      sourceApp,
      channel: 'whatsapp',
      category: request.category,
      recipientPhone,
      templateName,
      language: request.language,
      consentEvidenceRef,
      idempotencyKey,
      variables: normalizeVariables(request.variables),
    },
    providerPolicy: providerDecision,
  };
}

/**
 * Produces a PII-minimized audit projection. The full phone and template
 * variables are intentionally excluded.
 */
export function buildOutboundDeliveryAuditRecord(
  authority: OutboundDeliveryAuthority,
  request: OutboundDeliveryRequest,
  decision: OutboundDeliveryDecision,
): OutboundDeliveryAuditRecord {
  return {
    requestId: clean(request.requestId).slice(0, 180),
    organizationId: clean(authority.organizationId).slice(0, 180),
    sourceApp: clean(authority.sourceApp).slice(0, 80),
    channel: 'whatsapp',
    category: request.category,
    recipientMasked: maskPhone(request.recipient?.value || ''),
    templateName: clean(request.templateName).slice(0, 512),
    consentEvidenceRef: clean(request.consentEvidenceRef).slice(0, 260),
    idempotencyKey: clean(request.idempotencyKey).slice(0, 220),
    decision: decision.status,
    blockReason: decision.reason,
  };
}
