import webPush from 'web-push';
import { createConversationIdFromChannelIdentity, createProviderMessageIndexId, createMessageEvidenceRef } from '../inbox/messageContentStore';
import type { WhatsAppNormalizedEvent } from '../channels/whatsappOfficial';
import type { WhatsAppConnectionRegistry } from '../channels/whatsappConnectionRegistry';
import type { ConnectThreadStore } from '../inbox/threadStore';
import type { ConnectInboxOperatorDirectory } from '../inbox/hubFirestoreInboxOperatorDirectory';
import type { PushStore } from './firestorePushStore';
import { isQuiet, privatePushPayload, pushId, validateSubscription, type PushDevice } from './pushPolicy';

export type PushSender = (device: PushDevice, payload: string) => Promise<void>;
export function createWebPushSender(publicKey: string, privateKey: string, subject: string): PushSender {
  // Validate secrets at composition; no global mutable VAPID configuration.
  webPush.generateRequestDetails({ endpoint: 'https://web.push.apple.com/test', keys: {
    p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64)]).toString('base64url'), auth: Buffer.alloc(16).toString('base64url'),
  } }, null, { vapidDetails: { subject, publicKey, privateKey } });
  return async (device, payload) => {
    await webPush.sendNotification(validateSubscription(device.subscription), payload, {
      vapidDetails: { subject, publicKey, privateKey }, TTL: 300, timeout: 5000,
    });
  };
}
export class InboxPushService {
  constructor(private readonly store: PushStore, private readonly threads: ConnectThreadStore,
    private readonly directory: ConnectInboxOperatorDirectory, private readonly send: PushSender,
    private readonly registry: WhatsAppConnectionRegistry, private readonly now = () => new Date()) {}
  async afterIngest(events: WhatsAppNormalizedEvent[]) {
    for (const event of events) {
      if (event.kind !== 'message') continue;
      const binding = this.registry.resolve(event.phoneNumberId);
      if (!binding) continue;
      const scope = { organizationId: binding.organizationId, conversationId: createConversationIdFromChannelIdentity({
        organizationId: binding.organizationId, channel: 'whatsapp', connectionRef: binding.connectionRef, channelUserId: event.from,
      }) };
      const thread = await this.threads.load(scope);
      if (!thread || ['resolved', 'archived', 'waiting_person'].includes(thread.status)) continue;
      // A stale webhook retry must not alert after a later reply/resolve.
      const messageId = createProviderMessageIndexId('whatsapp', event.providerMessageId);
      if (thread.lastEvidenceRef !== createMessageEvidenceRef('whatsapp', event.providerMessageId)) continue;
      const devices = await this.store.list(scope.organizationId);
      let attempted = 0;
      for (const device of devices) {
        if (!device.enabled || Date.parse(device.expiresAt) <= this.now().getTime() || isQuiet(device, this.now())) continue;
        if (thread.assignedTo && (thread.assignedTo.type !== 'user' || thread.assignedTo.ref !== device.actorUid)) continue;
        // Cap upstream checks as well as sends so one webhook has bounded work.
        if (++attempted > 10) break;
        if (!await this.directory.verify({ organizationId: scope.organizationId, uid: device.actorUid })) continue;
        const currentDevice = await this.store.get(device.id);
        if (!currentDevice || JSON.stringify(currentDevice) !== JSON.stringify(device)) continue;
        // Recheck canonical thread after potentially slow authority lookup.
        const latest = await this.threads.load(scope);
        if (!latest || latest.lastEventId !== thread.lastEventId) continue;
        const id = pushId(scope.organizationId, messageId, device.id);
        if (!await this.store.claim(id, new Date(this.now().getTime() + 30 * 86400000).toISOString())) continue;
        try {
          await this.send(device, privatePushPayload({ ...scope, messageId }));
          await this.store.result(id, 'accepted_by_push_service');
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await this.store.remove(scope.organizationId, device.actorUid, device.id);
          // Ambiguous network errors are not automatically retried (could already have delivered).
          await this.store.result(id, status === 404 || status === 410 ? 'expired' : 'failed_or_unknown');
        }
      }
    }
  }
}
