import { 
  selectOrganizationConversations, 
  selectInitialConversationId, 
  selectActiveConversation, 
  selectActiveContact, 
  validatePendingToolContext,
  getNextFocusIndex,
  getPreviousFocusIndex
} from '../features/inbox/inboxDomain';
import { Conversation, Contact, ToolDefinition } from '../types';
import { PendingDemoToolInvocation } from '../demo/confirmations/demoToolFlow';

function runTests() {
  console.log('--- Running Inbox Domain Selector Tests ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${message}`);
    } else {
      failed++;
      console.error(`❌ [FAIL] ${message}`);
    }
  }

  // Mock data for test
  const testConversations: Conversation[] = [
    {
      id: 'conv_1',
      contactId: 'cnt_1',
      contactName: 'Alice',
      channel: 'whatsapp',
      channelIdentifier: 'whatsapp_alice',
      mode: 'automatico',
      status: 'aberto',
      priority: 'media',
      organizationId: 'org_a',
      tags: [],
      lastMessageSnippet: 'Hello',
      lastMessageAt: '2026-03-15T10:00:00Z',
      unreadCount: 0,
    },
    {
      id: 'conv_2',
      contactId: 'cnt_2',
      contactName: 'Bob',
      channel: 'instagram',
      channelIdentifier: 'instagram_bob',
      mode: 'humano',
      status: 'aberto',
      priority: 'baixa',
      organizationId: 'org_b',
      tags: [],
      lastMessageSnippet: 'Hi',
      lastMessageAt: '2026-03-15T10:05:00Z',
      unreadCount: 0,
    }
  ];

  const testContacts: Contact[] = [
    {
      id: 'cnt_1',
      name: 'Alice',
      identities: [],
      linkingStatus: 'vinculado',
      consents: { marketing: true, support: true, dataRetention: true, updatedAt: '' },
      preferredLanguage: 'pt-BR',
      authorizedOrgsHistory: [],
      tags: [],
      createdAt: ''
    }
  ];

  // Test 1: selectOrganizationConversations
  const orgAConv = selectOrganizationConversations(testConversations, 'org_a');
  assert(orgAConv.length === 1 && orgAConv[0].id === 'conv_1', 'selectOrganizationConversations filters by org');

  // Test 2: selectInitialConversationId
  const initialOrgAId = selectInitialConversationId(testConversations, 'org_a');
  assert(initialOrgAId === 'conv_1', 'selectInitialConversationId returns first conv ID');
  const initialOrgCId = selectInitialConversationId(testConversations, 'org_c');
  assert(initialOrgCId === null, 'selectInitialConversationId returns null if no convs');

  // Test 3: selectActiveConversation
  const activeOrgA = selectActiveConversation(testConversations, 'org_a', 'conv_1');
  assert(activeOrgA !== null && activeOrgA.id === 'conv_1', 'selectActiveConversation returns correct active conversation');
  const activeOrgAMismatch = selectActiveConversation(testConversations, 'org_a', 'conv_2');
  assert(activeOrgAMismatch === null, 'selectActiveConversation returns null on org mismatch');

  // Test 4: selectActiveContact
  const activeContact = selectActiveContact(testContacts, testConversations[0]);
  assert(activeContact !== null && activeContact.id === 'cnt_1', 'selectActiveContact returns matching contact');
  const activeContactNull = selectActiveContact(testContacts, null);
  assert(activeContactNull === null, 'selectActiveContact returns null if no active conversation');

  // Test 5: validatePendingToolContext
  const mockPending: PendingDemoToolInvocation = {
    tool: { id: 'tool_1', confirmationPolicy: 'simple', riskLevel: 'R2_REVERSIBLE_WRITE' } as unknown as ToolDefinition,
    args: { organizationId: 'org_a' },
    requestId: 'req_1',
    correlationId: 'corr_1',
    organizationId: 'org_a',
    conversationId: 'conv_1',
    channelType: 'whatsapp',
    appAccess: { appId: 'connect_core', capabilities: [] }
  };
  const isPendingValid = validatePendingToolContext(mockPending, testConversations[0], 'org_a');
  assert(isPendingValid === true, 'validatePendingToolContext approves matched context');

  const isPendingOrgMismatch = validatePendingToolContext(mockPending, testConversations[0], 'org_b');
  assert(isPendingOrgMismatch === false, 'validatePendingToolContext rejects mismatched org');

  // Test 6: getNextFocusIndex & getPreviousFocusIndex
  assert(getNextFocusIndex(0, 3) === 1, 'getNextFocusIndex increments correctly');
  assert(getNextFocusIndex(2, 3) === 0, 'getNextFocusIndex wraps around correctly');
  assert(getPreviousFocusIndex(0, 3) === 2, 'getPreviousFocusIndex wraps around correctly');
  assert(getPreviousFocusIndex(1, 3) === 0, 'getPreviousFocusIndex decrements correctly');

  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
