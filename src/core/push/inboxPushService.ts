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
    private readonly registry: WhatsAppConnectionRegistry, private readonly now = () => new Date(),
    private readonly logger?: { info(message: string, meta?: Record<string, unknown>): void; warn?(message: string, meta?: Record<string, unknown>): void }) {}
  async afterIngest(events: WhatsAppNormalizedEvent[]) {
    const aggregate = { accepted: 0, failed: 0 };
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
      const outcome = await this.notifyThread(scope, messageId);
      aggregate.accepted += outcome.accepted;
      aggregate.failed += outcome.failed;
    }
    return aggregate;
  }
  async notifyAutomation(input: { organizationId: string; conversationId: string; recipientUid: string; eventId: string }) {
    return this.notifyThread(input, input.eventId, input.recipientUid);
  }
  private async notifyThread(scope: { organizationId: string; conversationId: string }, messageId: string, recipientUid?: string) {
    const outcome = { accepted: 0, failed: 0 };
    const thread = await this.threads.load(scope);
    if (!thread || ['resolved', 'archived', 'waiting_person'].includes(thread.status)) return outcome;
    const devices = await this.store.list(scope.organizationId);
      let attempted = 0;
      for (const device of devices) {
        try {
        if (recipientUid && device.actorUid !== recipientUid) continue;
        if (!device.enabled || Date.parse(device.expiresAt) <= this.now().getTime() || isQuiet(device, this.now())) continue;
        if (thread.assignedTo && (thread.assignedTo.type !== 'user' || thread.assignedTo.ref !== device.actorUid)) continue;
        // Cap upstream checks as well as sends so one webhook has bounded work.
        if (++attempted > 10) break;
        if (!await this.directory.verify({ organizationId: scope.organizationId, uid: device.actorUid })) continue;
        const readMarkers = await this.store.readMarkers(scope.organizationId, device.actorUid);
        if (!recipientUid && readMarkers[scope.conversationId]?.eventId === thread.lastEventId) continue;
        const currentDevice = await this.store.get(device.id);
        if (!currentDevice || JSON.stringify(currentDevice) !== JSON.stringify(device)) continue;
        // Recheck canonical thread after potentially slow authority lookup.
        const latest = await this.threads.load(scope);
        // An unchanged event ID does not imply the recipient is still eligible:
        // status and assignment may change during the Hub/device lookups.
        if (!latest || latest.lastEventId !== thread.lastEventId ||
            ['resolved', 'archived', 'waiting_person'].includes(latest.status) ||
            (latest.assignedTo && (latest.assignedTo.type !== 'user' || latest.assignedTo.ref !== device.actorUid))) continue;
        const id = pushId(scope.organizationId, messageId, device.id);
        if (!await this.store.claim(id, new Date(this.now().getTime() + 30 * 86400000).toISOString())) {
          const status = await this.store.deliveryStatus(id);
          if (status !== 'accepted_by_push_service' && status !== 'expired') outcome.failed++;
          continue;
        }
        try {
          await this.send(device, privatePushPayload({ ...scope, messageId }));
          await this.store.result(id, 'accepted_by_push_service');
          outcome.accepted++;
          this.logger?.info('CONNECT_WEB_PUSH_PROVIDER_ACCEPTED');
        } catch (error) {
          outcome.failed++;
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await this.store.remove(scope.organizationId, device.actorUid, device.id);
          // Ambiguous network errors are not automatically retried (could already have delivered).
          await this.store.result(id, status === 404 || status === 410 ? 'expired' : 'failed_or_unknown');
          this.logger?.warn?.('CONNECT_WEB_PUSH_DELIVERY_FAILED', { status: status === 404 || status === 410 ? 'expired' : 'failed_or_unknown' });
        }
        } catch {
          // One revoked/broken device or failed lookup must not prevent other recipients.
          outcome.failed++;
          this.logger?.warn?.('CONNECT_WEB_PUSH_DEVICE_UNAVAILABLE');
        }
      }
    return outcome;
  }
}
