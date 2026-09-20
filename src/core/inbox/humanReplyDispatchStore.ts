import { createHash } from 'node:crypto';

export type HumanReplyDispatchStatus =
  | 'dispatching'
  | 'sent'
  | 'failed'
  | 'ambiguous_after_provider_accept';

export type HumanReplyDispatchRecord = {
  schemaVersion: 1;
  organizationId: string;
  conversationId: string;
  dispatchId: string;
  requestId: string;
  bodyFingerprint: string;
  status: HumanReplyDispatchStatus;
  createdAt: string;
  updatedAt: string;
  providerMessageId?: string;
  errorCode?: string;
};

export type BeginHumanReplyDispatchResult =
  | { kind: 'created'; record: HumanReplyDispatchRecord }
  | { kind: 'existing'; record: HumanReplyDispatchRecord };

export interface HumanReplyDispatchStore {
  begin(input: {
    organizationId: string;
    conversationId: string;
    requestId: string;
    bodyFingerprint: string;
    now: string;
  }): Promise<BeginHumanReplyDispatchResult>;
  markSent(input: {
    record: HumanReplyDispatchRecord;
    providerMessageId: string;
    now: string;
  }): Promise<HumanReplyDispatchRecord>;
  markFailed(input: {
    record: HumanReplyDispatchRecord;
    errorCode: string;
    now: string;
  }): Promise<HumanReplyDispatchRecord>;
  markAmbiguous(input: {
    record: HumanReplyDispatchRecord;
    providerMessageId: string;
    errorCode: string;
    now: string;
  }): Promise<HumanReplyDispatchRecord>;
}

function safe(value: string, maxLength: number): string {
  const clean = value.trim();
  if (
    !clean ||
    clean.length > maxLength ||
    clean.includes('/') ||
    clean.includes('\\')
  ) {
    throw new Error('INVALID_HUMAN_REPLY_DISPATCH_FIELD');
  }
  return clean;
}

export function fingerprintReplyBody(text: string): string {
  const normalized = text.replace(/\u0000/g, '').trim();
  if (!normalized || normalized.length > 4096) {
    throw new Error('WHATSAPP_REPLY_TEXT_INVALID');
  }
  return createHash('sha256').update(normalized).digest('hex');
}

export function createHumanReplyDispatchId(input: {
  organizationId: string;
  conversationId: string;
  requestId: string;
}): string {
  const material = [
    safe(input.organizationId, 180),
    safe(input.conversationId, 180),
    safe(input.requestId, 180),
  ].join('\u001f');
  return createHash('sha256').update(material).digest('hex').slice(0, 48);
}
