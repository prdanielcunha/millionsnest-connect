import { createHash } from 'node:crypto';

export type ConnectMessageChannel = 'whatsapp' | 'inapp' | 'instagram' | 'telegram' | string;
export type ConnectMessageDirection = 'inbound' | 'outbound';
export type ConnectMessageDeliveryStatus = 'received' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export type ConnectMessageContentRecord = {
  schemaVersion: 1;
  organizationId: string;
  conversationId: string;
  messageId: string;
  channel: ConnectMessageChannel;
  direction: ConnectMessageDirection;
  providerMessageId: string;
  senderRef: string;
  recipientRef?: string;
  messageType: string;
  body?: string;
  occurredAt: string;
  recordedAt: string;
  deliveryStatus: ConnectMessageDeliveryStatus;
  deliveryUpdatedAt?: string;
  evidenceRef: string;
};

export type ConnectMessageContentWriteResult = {
  kind: 'created' | 'duplicate';
  record: ConnectMessageContentRecord;
};

export interface ConnectMessageContentStore {
  put(record: ConnectMessageContentRecord): Promise<ConnectMessageContentWriteResult>;
  get(input: {
    organizationId: string;
    conversationId: string;
    messageId: string;
  }): Promise<ConnectMessageContentRecord | null>;
  getByProviderMessageId(input: {
    channel: string;
    providerMessageId: string;
  }): Promise<ConnectMessageContentRecord | null>;
  listConversation(input: {
    organizationId: string;
    conversationId: string;
    limit?: number;
  }): Promise<readonly ConnectMessageContentRecord[]>;
  updateDeliveryStatus(input: {
    organizationId: string;
    conversationId: string;
    messageId: string;
    deliveryStatus: ConnectMessageDeliveryStatus;
    occurredAt: string;
  }): Promise<ConnectMessageContentRecord | null>;
}

function cleanSegment(value: string, maxLength = 240): string {
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > maxLength ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.includes('/') ||
    normalized.includes('\\')
  ) {
    throw new Error('INVALID_MESSAGE_CONTENT_SEGMENT');
  }
  return normalized;
}

function cleanText(value: string | undefined, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\u0000/g, '').trim().slice(0, maxLength);
  return normalized || undefined;
}

export function createMessageEvidenceRef(
  channel: string,
  providerMessageId: string,
): string {
  const safeChannel = cleanSegment(channel, 40).replace(/[^a-zA-Z0-9._:-]/g, '-');
  const digest = createHash('sha256').update(providerMessageId.trim()).digest('hex').slice(0, 32);
  return `connect-message:${safeChannel}:${digest}`;
}

export function createConversationIdFromChannelIdentity(input: {
  organizationId: string;
  channel: string;
  connectionRef: string;
  channelUserId: string;
}): string {
  const material = [
    cleanSegment(input.organizationId, 180),
    cleanSegment(input.channel, 40),
    cleanSegment(input.connectionRef, 180),
    cleanSegment(input.channelUserId, 240),
  ].join('\u001f');
  const digest = createHash('sha256').update(material).digest('hex').slice(0, 40);
  return `${input.channel.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'channel'}_${digest}`;
}

export function normalizeMessageContentRecord(
  input: ConnectMessageContentRecord,
): ConnectMessageContentRecord {
  const record: ConnectMessageContentRecord = {
    schemaVersion: 1,
    organizationId: cleanSegment(input.organizationId, 180),
    conversationId: cleanSegment(input.conversationId, 180),
    messageId: cleanSegment(input.messageId, 300),
    channel: cleanSegment(input.channel, 40),
    direction: input.direction,
    providerMessageId: cleanSegment(input.providerMessageId, 300),
    senderRef: cleanSegment(input.senderRef, 240),
    recipientRef: input.recipientRef ? cleanSegment(input.recipientRef, 240) : undefined,
    messageType: cleanSegment(input.messageType, 64),
    body: cleanText(input.body, 4096),
    occurredAt: new Date(input.occurredAt).toISOString(),
    recordedAt: new Date(input.recordedAt).toISOString(),
    deliveryStatus: input.deliveryStatus,
    deliveryUpdatedAt: input.deliveryUpdatedAt
      ? new Date(input.deliveryUpdatedAt).toISOString()
      : undefined,
    evidenceRef: cleanSegment(input.evidenceRef, 300),
  };

  if (!['inbound', 'outbound'].includes(record.direction)) {
    throw new Error('INVALID_MESSAGE_DIRECTION');
  }
  if (!['received', 'queued', 'sent', 'delivered', 'read', 'failed'].includes(record.deliveryStatus)) {
    throw new Error('INVALID_MESSAGE_DELIVERY_STATUS');
  }
  return record;
}

export function createProviderMessageIndexId(
  channel: string,
  providerMessageId: string,
): string {
  const safeChannel = cleanSegment(channel, 40).replace(/[^a-zA-Z0-9._:-]/g, '-');
  const digest = createHash('sha256')
    .update(providerMessageId.trim())
    .digest('hex')
    .slice(0, 48);
  return `${safeChannel}:${digest}`;
}
