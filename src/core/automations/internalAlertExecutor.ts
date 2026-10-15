import type { ConnectThreadStore } from '../inbox/threadStore';
import type { ConnectMessageContentStore } from '../inbox/messageContentStore';
import { createMessageEvidenceRef, createProviderMessageIndexId } from '../inbox/messageContentStore';
import type { ConnectInboxOperatorDirectory } from '../inbox/hubFirestoreInboxOperatorDirectory';
import type { InboxPushService } from '../push/inboxPushService';
import { jobId, type InternalAutomationEvent } from './eventJobs';

/** Durable internal review is independent of optional physical push delivery.
 * This executor never reads app domain data or dispatches a Meta message.
 */
export function createInternalAlertExecutor(options: {
  threads: Pick<ConnectThreadStore, 'load'>;
  messages: Pick<ConnectMessageContentStore, 'get'>;
  directory: Pick<ConnectInboxOperatorDirectory, 'verify'>;
  push?: Pick<InboxPushService, 'afterIngest' | 'notifyAutomation'> | null;
}) {
  return async (event: InternalAutomationEvent): Promise<'complete' | 'needs_review'> => {
    const scope = { organizationId: event.organizationId, conversationId: event.conversationId };
    const thread = await options.threads.load(scope);
    if (!thread || thread.organizationId !== scope.organizationId || thread.conversationId !== scope.conversationId) return 'needs_review';
    // An operator reply or resolution supersedes queued alerts. Never reopen a
    // conversation or manufacture delivery just to finish an old event.
    if (['resolved', 'archived', 'waiting_person'].includes(thread.status)) return 'complete';
    let outcome;
    if (event.sourceApp === 'whatsapp') {
      if (!event.messageId) return 'needs_review';
      const original = await options.messages.get({ ...scope, messageId: event.messageId });
      if (!original || original.direction !== 'inbound' || !original.recipientRef || !original.senderRef ||
          original.organizationId !== scope.organizationId || original.conversationId !== scope.conversationId ||
          original.messageId !== event.messageId || original.channel !== 'whatsapp' ||
          createProviderMessageIndexId('whatsapp', original.providerMessageId) !== event.messageId) return 'needs_review';
      if (thread.lastEvidenceRef !== createMessageEvidenceRef('whatsapp', original.providerMessageId)) return 'complete';
      if (!options.push) return 'needs_review';
      outcome = await options.push.afterIngest([{ kind: 'message', phoneNumberId: original.recipientRef,
        providerMessageId: original.providerMessageId, from: original.senderRef, messageType: original.messageType,
        timestamp: String(Math.floor(Date.parse(original.occurredAt) / 1000)), text: original.body }]);
    } else {
      // Existing signed app ingress targets Inbox operators, not arbitrary app
      // members. Official member-facing publishers/tools remain separate gates.
      if (!event.recipientUid || !await options.directory.verify({ organizationId: scope.organizationId, uid: event.recipientUid })) return 'needs_review';
      if (!options.push) return 'needs_review';
      outcome = await options.push.notifyAutomation({ ...scope, eventId: jobId(event), recipientUid: event.recipientUid });
    }
    return outcome.failed > 0 ? 'needs_review' : 'complete';
  };
}
