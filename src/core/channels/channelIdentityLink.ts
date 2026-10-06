import { createHmac, timingSafeEqual } from 'node:crypto';

export type WhatsAppChannelLinkPayload = {
  version: 1;
  channel: 'whatsapp';
  channelIdentityRef: string;
  channelOrganizationId: string;
  conversationId: string;
  providerMessageId: string;
  issuedAtMs: number;
  expiresAtMs: number;
};

const LINK_TTL_MS = 15 * 60 * 1000;

function deriveKey(rootSecret: string, purpose: string): Buffer {
  const secret = rootSecret.trim();
  if (secret.length < 16) throw new Error('WHATSAPP_LINK_ROOT_SECRET_INVALID');
  return createHmac('sha256', secret).update(purpose, 'utf8').digest();
}

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function cleanSegment(value: string, maxLength: number): string {
  const clean = value.trim();
  if (
    !clean ||
    clean.length > maxLength ||
    clean.includes('/') ||
    clean.includes('\\') ||
    /[\x00-\x1F\x7F]/.test(clean)
  ) {
    throw new Error('WHATSAPP_LINK_VALUE_INVALID');
  }
  return clean;
}

function validIdentityRef(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

/**
 * Converts a provider user id (phone in the official WhatsApp webhook) into an
 * opaque stable ref. The raw provider identifier never becomes Hub identity
 * and never crosses the channel-link boundary.
 */
export function deriveWhatsAppChannelIdentityRef(
  providerUserId: string,
  rootSecret: string,
): string {
  const providerId = cleanSegment(providerUserId, 64);
  const key = deriveKey(rootSecret, 'millionsnest-connect-channel-identity-v1');
  return createHmac('sha256', key)
    .update(`whatsapp:${providerId}`, 'utf8')
    .digest('hex');
}

export function createWhatsAppChannelLinkToken(input: {
  channelIdentityRef: string;
  channelOrganizationId: string;
  conversationId: string;
  providerMessageId: string;
  rootSecret: string;
  nowMs?: number;
}): string {
  const now = input.nowMs ?? Date.now();
  const payload: WhatsAppChannelLinkPayload = {
    version: 1,
    channel: 'whatsapp',
    channelIdentityRef: input.channelIdentityRef.trim(),
    channelOrganizationId: cleanSegment(input.channelOrganizationId, 180),
    conversationId: cleanSegment(input.conversationId, 180),
    providerMessageId: cleanSegment(input.providerMessageId, 300),
    issuedAtMs: now,
    expiresAtMs: now + LINK_TTL_MS,
  };
  if (!validIdentityRef(payload.channelIdentityRef)) {
    throw new Error('WHATSAPP_LINK_IDENTITY_REF_INVALID');
  }

  const encoded = base64url(JSON.stringify(payload));
  const key = deriveKey(input.rootSecret, 'millionsnest-connect-channel-link-v1');
  const signature = createHmac('sha256', key).update(encoded, 'utf8').digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyWhatsAppChannelLinkToken(input: {
  token: string;
  rootSecret: string;
  nowMs?: number;
}): WhatsAppChannelLinkPayload {
  const token = input.token.trim();
  if (!token || token.length > 4096) throw new Error('WHATSAPP_LINK_TOKEN_INVALID');
  const [encoded, signature, extra] = token.split('.');
  if (!encoded || !signature || extra) throw new Error('WHATSAPP_LINK_TOKEN_INVALID');

  const key = deriveKey(input.rootSecret, 'millionsnest-connect-channel-link-v1');
  const expected = createHmac('sha256', key).update(encoded, 'utf8').digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, 'base64url');
  } catch {
    throw new Error('WHATSAPP_LINK_TOKEN_INVALID');
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error('WHATSAPP_LINK_TOKEN_INVALID');
  }

  let payload: WhatsAppChannelLinkPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as WhatsAppChannelLinkPayload;
  } catch {
    throw new Error('WHATSAPP_LINK_TOKEN_INVALID');
  }

  const now = input.nowMs ?? Date.now();
  if (
    payload?.version !== 1 ||
    payload.channel !== 'whatsapp' ||
    !validIdentityRef(String(payload.channelIdentityRef || '')) ||
    !Number.isFinite(payload.issuedAtMs) ||
    !Number.isFinite(payload.expiresAtMs) ||
    payload.expiresAtMs <= now ||
    payload.issuedAtMs > now + 60_000 ||
    payload.expiresAtMs - payload.issuedAtMs > LINK_TTL_MS + 60_000
  ) {
    throw new Error(payload?.expiresAtMs <= now ? 'WHATSAPP_LINK_TOKEN_EXPIRED' : 'WHATSAPP_LINK_TOKEN_INVALID');
  }

  return {
    version: 1,
    channel: 'whatsapp',
    channelIdentityRef: payload.channelIdentityRef,
    channelOrganizationId: cleanSegment(payload.channelOrganizationId, 180),
    conversationId: cleanSegment(payload.conversationId, 180),
    providerMessageId: cleanSegment(payload.providerMessageId, 300),
    issuedAtMs: payload.issuedAtMs,
    expiresAtMs: payload.expiresAtMs,
  };
}

export function buildWhatsAppChannelLinkUrl(origin: string, token: string): string {
  const parsed = new URL(origin.trim());
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('WHATSAPP_LINK_ORIGIN_INVALID');
  }
  const url = new URL('/link/whatsapp', parsed.origin);
  url.searchParams.set('token', token);
  return url.toString();
}
