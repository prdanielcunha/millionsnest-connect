import { Conversation, Contact } from '../../types';
import { PendingDemoToolInvocation } from '../../demo/confirmations/demoToolFlow';

export type InboxFilterMode = 'all' | 'mine' | 'unassigned' | 'waiting_human' | 'automatic' | 'resolved';
export type InboxChannelFilter = 'all' | 'whatsapp' | 'instagram' | 'inapp';

export interface InboxFilterDraft {
  mode: InboxFilterMode;
  channel: InboxChannelFilter;
}

export function selectOrganizationConversations(
  conversations: readonly Conversation[],
  organizationId: string
): Conversation[] {
  return conversations.filter((c) => c.organizationId === organizationId);
}

export function selectInitialConversationId(
  conversations: readonly Conversation[],
  organizationId: string
): string | null {
  const orgConversations = selectOrganizationConversations(conversations, organizationId);
  return orgConversations.length > 0 ? orgConversations[0].id : null;
}

export function selectActiveConversation(
  conversations: readonly Conversation[],
  organizationId: string,
  conversationId: string | null
): Conversation | null {
  if (!conversationId) return null;
  const orgConversations = selectOrganizationConversations(conversations, organizationId);
  return orgConversations.find((c) => c.id === conversationId) || null;
}

export function selectActiveContact(
  contacts: readonly Contact[],
  activeConversation: Conversation | null
): Contact | null {
  if (!activeConversation) return null;
  return contacts.find((cnt) => cnt.id === activeConversation.contactId) || null;
}

export function isConversationInActiveOrganization(
  conversation: Conversation | null,
  organizationId: string
): conversation is Conversation {
  return conversation !== null && conversation.organizationId === organizationId;
}

export function validatePendingToolContext(
  pendingTool: PendingDemoToolInvocation | null,
  activeConversation: Conversation | null,
  activeOrgId: string
): boolean {
  if (!pendingTool) return false;
  if (!activeConversation) return false;
  if (activeConversation.organizationId !== activeOrgId) return false;
  if (pendingTool.conversationId !== activeConversation.id) return false;
  if (pendingTool.organizationId !== activeOrgId) return false;

  const argsOrgId = pendingTool.args && (pendingTool.args.organizationId as string);
  if (argsOrgId && argsOrgId !== activeOrgId) return false;

  return true;
}

export function createInboxFilterDraft(applied: InboxFilterDraft): InboxFilterDraft {
  return { ...applied };
}

export function clearInboxFilterDraft(): InboxFilterDraft {
  return { mode: 'all', channel: 'all' };
}

export function getNextFocusIndex(currentIndex: number, totalElements: number): number {
  if (totalElements <= 0) return 0;
  if (currentIndex < 0) return 0;
  return (currentIndex + 1) % totalElements;
}

export function getPreviousFocusIndex(currentIndex: number, totalElements: number): number {
  if (totalElements <= 0) return 0;
  if (currentIndex < 0) return 0;
  return (currentIndex - 1 + totalElements) % totalElements;
}
