import { createHash } from 'node:crypto';

export type PushSubscriptionData = { endpoint: string; keys: { p256dh: string; auth: string } };
export type PushDevice = {
  id: string; organizationId: string; actorUid: string; subscription: PushSubscriptionData;
  enabled: boolean; expiresAt: string; quietStart: number; quietEnd: number; timeZone: string;
};
export function pushId(...parts: string[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}
/** Strict provider allowlist: subscription endpoints are untrusted network destinations. */
export function validateSubscription(raw: unknown): PushSubscriptionData {
  const s = raw as PushSubscriptionData;
  if (!s || typeof s.endpoint !== 'string' || s.endpoint.length > 2048) throw new Error('INVALID_SUBSCRIPTION');
  const url = new URL(s.endpoint);
  const host = url.hostname;
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash ||
      !['fcm.googleapis.com', 'web.push.apple.com', 'updates.push.services.mozilla.com'].includes(host) &&
      !/^[a-z0-9-]+\.notify\.windows\.com$/.test(host)) throw new Error('INVALID_PUSH_PROVIDER');
  for (const [key, bytes] of [['p256dh', 65], ['auth', 16]] as const) {
    const value = s.keys?.[key];
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(value) ||
        Buffer.from(value, 'base64url').length !== bytes) throw new Error('INVALID_PUSH_KEY');
  }
  if (Buffer.from(s.keys.p256dh, 'base64url')[0] !== 4) throw new Error('INVALID_PUSH_KEY');
  return { endpoint: url.href, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
}
export function isQuiet(device: PushDevice, now: Date): boolean {
  if (device.quietStart === device.quietEnd) return false;
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: device.timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now));
  return device.quietStart < device.quietEnd
    ? hour >= device.quietStart && hour < device.quietEnd
    : hour >= device.quietStart || hour < device.quietEnd;
}
export function privatePushPayload(input: { organizationId: string; conversationId: string; messageId: string }) {
  return JSON.stringify({ title: 'MillionsNest Connect', body: 'Há uma nova mensagem para atendimento.',
    tag: pushId(input.organizationId, input.conversationId, input.messageId),
    url: `/inbox?organizationId=${encodeURIComponent(input.organizationId)}&conversationId=${encodeURIComponent(input.conversationId)}` });
}
