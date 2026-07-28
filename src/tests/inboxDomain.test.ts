import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { 
  selectOrganizationConversations, 
  selectInitialConversationId, 
  selectActiveConversation, 
  selectActiveContact, 
  validatePendingToolContext,
  getNextFocusIndex,
  getPreviousFocusIndex,
  isElementFocusable,
  ElementFocusDescriptor,
  isPlainUnknownRecord
} from '../features/inbox/inboxDomain';
import { Conversation, Contact, ToolDefinition } from '../types';
import { PendingDemoToolInvocation } from '../demo/confirmations/demoToolFlow';

let totalTests = 0;
let passedTests = 0;
let skippedTests = 0;
let failedTests = 0;
let totalAssertions = 0;
let currentAssertions = 0;

function test(name: string, callback: () => void) {
  totalTests++;
  currentAssertions = 0;
  try {
    callback();
    if (currentAssertions === 0) {
      throw new Error('Test executed zero assertions');
    }
    passedTests++;
  } catch (error: unknown) {
    failedTests++;
    console.error(`❌ Test failed: ${name}`);
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  }
}

function checkEqual<T>(actual: T, expected: T, message?: string): void {
  currentAssertions++;
  totalAssertions++;
  assert.deepEqual(actual, expected, message);
}

function checkOk(value: unknown, message?: string): asserts value {
  currentAssertions++;
  totalAssertions++;
  assert.ok(value, message);
}

console.log('--- Running Inbox Domain Selector Tests ---');

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

const mockTool: ToolDefinition = {
  id: 'tool_1',
  appId: 'connect_core',
  name: 'listSchedules',
  version: '1.0.0',
  title: 'List Schedules',
  description: 'List the active music schedules',
  inputSchema: {},
  outputSchema: {},
  requiredPermissions: [],
  organizationScoped: true,
  riskLevel: 'R2_REVERSIBLE_WRITE',
  confirmationPolicy: 'simple',
  readOnly: false,
  idempotencyPolicy: 'not_required',
  supportsPreview: false,
  supportsUndo: false,
  timeoutMs: 5000,
  auditEventType: 'musicscale.schedules.list',
};

const mockPending: PendingDemoToolInvocation = {
  tool: mockTool,
  args: { organizationId: 'org_a' },
  requestId: 'req_1',
  correlationId: 'corr_1',
  organizationId: 'org_a',
  conversationId: 'conv_1',
  channelType: 'whatsapp',
  appAccess: { appId: 'connect_core', capabilities: [] }
};

// Test 1: selectOrganizationConversations
test('Domain: selectOrganizationConversations filters by org', () => {
  const orgAConv = selectOrganizationConversations(testConversations, 'org_a');
  checkEqual(orgAConv.length, 1);
  checkEqual(orgAConv[0].id, 'conv_1');
});

// Test 2: selectInitialConversationId
test('Domain: selectInitialConversationId returns first conv ID', () => {
  const initialOrgAId = selectInitialConversationId(testConversations, 'org_a');
  checkEqual(initialOrgAId, 'conv_1');
});

test('Domain: selectInitialConversationId returns null if no convs', () => {
  const initialOrgCId = selectInitialConversationId(testConversations, 'org_c');
  checkEqual(initialOrgCId, null);
});

// Test 3: selectActiveConversation
test('Domain: selectActiveConversation returns correct active conversation', () => {
  const activeOrgA = selectActiveConversation(testConversations, 'org_a', 'conv_1');
  checkOk(activeOrgA);
  checkEqual(activeOrgA.id, 'conv_1');
});

test('Domain: selectActiveConversation returns null on org mismatch', () => {
  const activeOrgAMismatch = selectActiveConversation(testConversations, 'org_a', 'conv_2');
  checkEqual(activeOrgAMismatch, null);
});

// Test 4: selectActiveContact
test('Domain: selectActiveContact returns matching contact', () => {
  const activeContact = selectActiveContact(testContacts, testConversations[0]);
  checkOk(activeContact);
  checkEqual(activeContact.id, 'cnt_1');
});

test('Domain: selectActiveContact returns null if no active conversation', () => {
  const activeContactNull = selectActiveContact(testContacts, null);
  checkEqual(activeContactNull, null);
});

// Test 5: validatePendingToolContext
test('Domain: validatePendingToolContext approves matched context', () => {
  const isPendingValid = validatePendingToolContext(mockPending, testConversations[0], 'org_a');
  checkEqual(isPendingValid, true);
});

test('Domain: validatePendingToolContext rejects mismatched org', () => {
  const isPendingOrgMismatch = validatePendingToolContext(mockPending, testConversations[0], 'org_b');
  checkEqual(isPendingOrgMismatch, false);
});

test('Domain: validatePendingToolContext rejects divergent args orgId', () => {
  const mockPendingDivergent: PendingDemoToolInvocation = {
    ...mockPending,
    args: { organizationId: 'org_b' }
  };
  const isPendingDivergent = validatePendingToolContext(mockPendingDivergent, testConversations[0], 'org_a');
  checkEqual(isPendingDivergent, false);
});

test('Domain: validatePendingToolContext rejects invalid type args orgId', () => {
  const mockPendingInvalidType: PendingDemoToolInvocation = {
    ...mockPending,
    args: { organizationId: 12345 }
  };
  const isPendingInvalidType = validatePendingToolContext(mockPendingInvalidType, testConversations[0], 'org_a');
  checkEqual(isPendingInvalidType, false);
});

test('Domain: validatePendingToolContext accepts undefined args orgId', () => {
  const mockPendingUndefined: PendingDemoToolInvocation = {
    ...mockPending,
    args: {}
  };
  const isPendingUndefined = validatePendingToolContext(mockPendingUndefined, testConversations[0], 'org_a');
  checkEqual(isPendingUndefined, true);
});

// Test 6: getNextFocusIndex & getPreviousFocusIndex
test('Domain: getNextFocusIndex increments correctly', () => {
  checkEqual(getNextFocusIndex(0, 3), 1);
});

test('Domain: getNextFocusIndex wraps around correctly', () => {
  checkEqual(getNextFocusIndex(2, 3), 0);
});

test('Domain: getPreviousFocusIndex wraps around correctly', () => {
  checkEqual(getPreviousFocusIndex(0, 3), 2);
});

test('Domain: getPreviousFocusIndex decrements correctly', () => {
  checkEqual(getPreviousFocusIndex(1, 3), 0);
});

// Test 7: isElementFocusable
test('Domain: isElementFocusable accepts fully visible and enabled element', () => {
  const descriptor: ElementFocusDescriptor = {
    disabled: false,
    hasDisabledAttribute: false,
    ariaHidden: null,
    inert: false,
    hidden: false,
    tabIndex: 0,
    display: 'block',
    visibility: 'visible',
    hasClientRects: true
  };
  checkEqual(isElementFocusable(descriptor), true);
});

test('Domain: isElementFocusable rejects disabled element', () => {
  const descriptor: ElementFocusDescriptor = {
    disabled: true,
    hasDisabledAttribute: false,
    ariaHidden: null,
    inert: false,
    hidden: false,
    tabIndex: 0,
    display: 'block',
    visibility: 'visible',
    hasClientRects: true
  };
  checkEqual(isElementFocusable(descriptor), false);
});

test('Domain: isElementFocusable rejects elements with hasDisabledAttribute true', () => {
  const descriptor: ElementFocusDescriptor = {
    disabled: false,
    hasDisabledAttribute: true,
    ariaHidden: null,
    inert: false,
    hidden: false,
    tabIndex: 0,
    display: 'block',
    visibility: 'visible',
    hasClientRects: true
  };
  checkEqual(isElementFocusable(descriptor), false);
});

test('Domain: isElementFocusable rejects ariaHidden', () => {
  const descriptor: ElementFocusDescriptor = {
    disabled: false,
    hasDisabledAttribute: false,
    ariaHidden: 'true',
    inert: false,
    hidden: false,
    tabIndex: 0,
    display: 'block',
    visibility: 'visible',
    hasClientRects: true
  };
  checkEqual(isElementFocusable(descriptor), false);
});

test('Domain: isElementFocusable rejects inert', () => {
  const descriptor: ElementFocusDescriptor = {
    disabled: false,
    hasDisabledAttribute: false,
    ariaHidden: null,
    inert: true,
    hidden: false,
    tabIndex: 0,
    display: 'block',
    visibility: 'visible',
    hasClientRects: true
  };
  checkEqual(isElementFocusable(descriptor), false);
});

test('Domain: isElementFocusable rejects hidden', () => {
  const descriptor: ElementFocusDescriptor = {
    disabled: false,
    hasDisabledAttribute: false,
    ariaHidden: null,
    inert: false,
    hidden: true,
    tabIndex: 0,
    display: 'block',
    visibility: 'visible',
    hasClientRects: true
  };
  checkEqual(isElementFocusable(descriptor), false);
});

test('Domain: isElementFocusable rejects tabindex=-1', () => {
  const descriptor: ElementFocusDescriptor = {
    disabled: false,
    hasDisabledAttribute: false,
    ariaHidden: null,
    inert: false,
    hidden: false,
    tabIndex: -1,
    display: 'block',
    visibility: 'visible',
    hasClientRects: true
  };
  checkEqual(isElementFocusable(descriptor), false);
});

test('Domain: isElementFocusable rejects display none', () => {
  const descriptor: ElementFocusDescriptor = {
    disabled: false,
    hasDisabledAttribute: false,
    ariaHidden: null,
    inert: false,
    hidden: false,
    tabIndex: 0,
    display: 'none',
    visibility: 'visible',
    hasClientRects: true
  };
  checkEqual(isElementFocusable(descriptor), false);
});

test('Domain: isElementFocusable rejects visibility hidden', () => {
  const descriptor: ElementFocusDescriptor = {
    disabled: false,
    hasDisabledAttribute: false,
    ariaHidden: null,
    inert: false,
    hidden: false,
    tabIndex: 0,
    display: 'block',
    visibility: 'hidden',
    hasClientRects: true
  };
  checkEqual(isElementFocusable(descriptor), false);
});

test('Domain: isElementFocusable rejects hasClientRects false', () => {
  const descriptor: ElementFocusDescriptor = {
    disabled: false,
    hasDisabledAttribute: false,
    ariaHidden: null,
    inert: false,
    hidden: false,
    tabIndex: 0,
    display: 'block',
    visibility: 'visible',
    hasClientRects: false
  };
  checkEqual(isElementFocusable(descriptor), false);
});

// Runtime validation tests
test('Domain: validatePendingToolContext with valid args without organizationId', () => {
  const activeConv: Conversation = {
    id: 'c1', organizationId: 'org1', contactId: 'cnt1', contactName: 'A', channel: 'whatsapp', channelIdentifier: 'w1', mode: 'automatico', status: 'aberto', priority: 'media', tags: [], lastMessageSnippet: '', lastMessageAt: '', unreadCount: 0
  };
  const pendingTool: any = {
    conversationId: 'c1', organizationId: 'org1', tool: { name: 't1', description: 'desc', riskLevel: 'high' },
    args: { foo: 'bar' }, requestId: 'r1', correlationId: 'c1', appAccess: { appId: 'a1', capabilities: [] }
  };
  checkEqual(validatePendingToolContext(pendingTool, activeConv, 'org1'), true);
});

test('Domain: validatePendingToolContext with valid args with correct organizationId', () => {
  const activeConv: Conversation = {
    id: 'c1', organizationId: 'org1', contactId: 'cnt1', contactName: 'A', channel: 'whatsapp', channelIdentifier: 'w1', mode: 'automatico', status: 'aberto', priority: 'media', tags: [], lastMessageSnippet: '', lastMessageAt: '', unreadCount: 0
  };
  const pendingTool: any = {
    conversationId: 'c1', organizationId: 'org1', tool: { name: 't1', description: 'desc', riskLevel: 'high' },
    args: { organizationId: 'org1' }, requestId: 'r1', correlationId: 'c1', appAccess: { appId: 'a1', capabilities: [] }
  };
  checkEqual(validatePendingToolContext(pendingTool, activeConv, 'org1'), true);
});

test('Domain: validatePendingToolContext rejects divergent organizationId in args', () => {
  const activeConv: Conversation = {
    id: 'c1', organizationId: 'org1', contactId: 'cnt1', contactName: 'A', channel: 'whatsapp', channelIdentifier: 'w1', mode: 'automatico', status: 'aberto', priority: 'media', tags: [], lastMessageSnippet: '', lastMessageAt: '', unreadCount: 0
  };
  const pendingTool: any = {
    conversationId: 'c1', organizationId: 'org1', tool: { name: 't1', description: 'desc', riskLevel: 'high' },
    args: { organizationId: 'org_divergent' }, requestId: 'r1', correlationId: 'c1', appAccess: { appId: 'a1', capabilities: [] }
  };
  checkEqual(validatePendingToolContext(pendingTool, activeConv, 'org1'), false);
});

test('Domain: validatePendingToolContext rejects numeric organizationId in args', () => {
  const activeConv: Conversation = {
    id: 'c1', organizationId: 'org1', contactId: 'cnt1', contactName: 'A', channel: 'whatsapp', channelIdentifier: 'w1', mode: 'automatico', status: 'aberto', priority: 'media', tags: [], lastMessageSnippet: '', lastMessageAt: '', unreadCount: 0
  };
  const pendingTool: any = {
    conversationId: 'c1', organizationId: 'org1', tool: { name: 't1', description: 'desc', riskLevel: 'high' },
    args: { organizationId: 123 }, requestId: 'r1', correlationId: 'c1', appAccess: { appId: 'a1', capabilities: [] }
  };
  checkEqual(validatePendingToolContext(pendingTool, activeConv, 'org1'), false);
});

test('Domain: validatePendingToolContext rejects null args', () => {
  const activeConv: Conversation = {
    id: 'c1', organizationId: 'org1', contactId: 'cnt1', contactName: 'A', channel: 'whatsapp', channelIdentifier: 'w1', mode: 'automatico', status: 'aberto', priority: 'media', tags: [], lastMessageSnippet: '', lastMessageAt: '', unreadCount: 0
  };
  const pendingTool: any = {
    conversationId: 'c1', organizationId: 'org1', tool: { name: 't1', description: 'desc', riskLevel: 'high' },
    args: null, requestId: 'r1', correlationId: 'c1', appAccess: { appId: 'a1', capabilities: [] }
  };
  checkEqual(validatePendingToolContext(pendingTool, activeConv, 'org1'), false);
});

test('Domain: validatePendingToolContext rejects array args', () => {
  const activeConv: Conversation = {
    id: 'c1', organizationId: 'org1', contactId: 'cnt1', contactName: 'A', channel: 'whatsapp', channelIdentifier: 'w1', mode: 'automatico', status: 'aberto', priority: 'media', tags: [], lastMessageSnippet: '', lastMessageAt: '', unreadCount: 0
  };
  const pendingTool: any = {
    conversationId: 'c1', organizationId: 'org1', tool: { name: 't1', description: 'desc', riskLevel: 'high' },
    args: [1, 2, 3], requestId: 'r1', correlationId: 'c1', appAccess: { appId: 'a1', capabilities: [] }
  };
  checkEqual(validatePendingToolContext(pendingTool, activeConv, 'org1'), false);
});

test('Domain: validatePendingToolContext rejects string args', () => {
  const activeConv: Conversation = {
    id: 'c1', organizationId: 'org1', contactId: 'cnt1', contactName: 'A', channel: 'whatsapp', channelIdentifier: 'w1', mode: 'automatico', status: 'aberto', priority: 'media', tags: [], lastMessageSnippet: '', lastMessageAt: '', unreadCount: 0
  };
  const pendingTool: any = {
    conversationId: 'c1', organizationId: 'org1', tool: { name: 't1', description: 'desc', riskLevel: 'high' },
    args: 'some-string', requestId: 'r1', correlationId: 'c1', appAccess: { appId: 'a1', capabilities: [] }
  };
  checkEqual(validatePendingToolContext(pendingTool, activeConv, 'org1'), false);
});

test('Domain: validatePendingToolContext rejects number args', () => {
  const activeConv: Conversation = {
    id: 'c1', organizationId: 'org1', contactId: 'cnt1', contactName: 'A', channel: 'whatsapp', channelIdentifier: 'w1', mode: 'automatico', status: 'aberto', priority: 'media', tags: [], lastMessageSnippet: '', lastMessageAt: '', unreadCount: 0
  };
  const pendingTool: any = {
    conversationId: 'c1', organizationId: 'org1', tool: { name: 't1', description: 'desc', riskLevel: 'high' },
    args: 42, requestId: 'r1', correlationId: 'c1', appAccess: { appId: 'a1', capabilities: [] }
  };
  checkEqual(validatePendingToolContext(pendingTool, activeConv, 'org1'), false);
});

test('Domain: isPlainUnknownRecord accepts record object', () => {
  checkEqual(isPlainUnknownRecord({ foo: 'bar' }), true);
});

test('Domain: isPlainUnknownRecord rejects array', () => {
  checkEqual(isPlainUnknownRecord([1, 2]), false);
});

test('Domain: isPlainUnknownRecord rejects null', () => {
  checkEqual(isPlainUnknownRecord(null), false);
});

test('Domain: isPlainUnknownRecord rejects primitive string', () => {
  checkEqual(isPlainUnknownRecord('hello'), false);
});

// Structural assertions
test('Structural: InboxPage contains contextTriggerRef', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/features/inbox/InboxPage.tsx'), 'utf8');
  checkOk(content.includes('contextTriggerRef'), 'InboxPage must declare and use contextTriggerRef');
});

test('Structural: InboxPage contains contextHeadingRef', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/features/inbox/InboxPage.tsx'), 'utf8');
  checkOk(content.includes('contextHeadingRef'), 'InboxPage must declare and use contextHeadingRef');
});

test('Structural: InboxPage contains Escape handler returning to chat', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/features/inbox/InboxPage.tsx'), 'utf8');
  checkOk(content.includes("'Escape'") && content.includes("'OPEN_CHAT'"), 'Escape key handler must trigger OPEN_CHAT');
});

test('Structural: InboxPage contains focus restoration logic to contextTriggerRef', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/features/inbox/InboxPage.tsx'), 'utf8');
  checkOk(content.includes('contextTriggerRef.current.focus()'), 'Must restore focus to trigger element');
});

test('Structural: comment keeping it simple is removed', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/features/inbox/InboxPage.tsx'), 'utf8');
  checkEqual(content.includes('keeping it simple'), false);
});

test('Structural: activeContact.linkingStatus is not rendered directly in InboxPage', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/features/inbox/InboxPage.tsx'), 'utf8');
  checkEqual(content.includes('{activeContact.linkingStatus}'), false);
});

test('Structural: localized binding status t.bindingLinked is used', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/features/inbox/InboxPage.tsx'), 'utf8');
  checkOk(content.includes('bindingLinked'), 't.bindingLinked must be referenced');
});

test('Structural: localized binding status t.bindingPending is used', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/features/inbox/InboxPage.tsx'), 'utf8');
  checkOk(content.includes('bindingPending'), 't.bindingPending must be referenced');
});

test('Structural: localized binding status t.bindingUnlinked is used', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/features/inbox/InboxPage.tsx'), 'utf8');
  checkOk(content.includes('bindingUnlinked'), 't.bindingUnlinked must be referenced');
});

test('Structural: InboxFilterSheet does not contain as InboxFilterMode', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/features/inbox/InboxFilterSheet.tsx'), 'utf8');
  checkEqual(content.includes('as InboxFilterMode'), false);
});

test('Structural: InboxFilterSheet does not contain as InboxChannelFilter', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/features/inbox/InboxFilterSheet.tsx'), 'utf8');
  checkEqual(content.includes('as InboxChannelFilter'), false);
});

test('Structural: inboxMobile.test.ts declares test with strict synchronous callback', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/tests/inboxMobile.test.ts'), 'utf8');
  checkOk(content.includes('callback: () => void)'), 'test callback in inboxMobile must be strictly synchronous');
});

test('Structural: inboxDomain.test.ts declares test with strict synchronous callback', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/tests/inboxDomain.test.ts'), 'utf8');
  checkOk(content.includes('callback: () => void)'), 'test callback in inboxDomain must be strictly synchronous');
});

console.log(`\nTests completed: ${passedTests} passed, ${failedTests} failed, ${skippedTests} skipped. Assertions: ${totalAssertions}`);
if (failedTests > 0) {
  process.exit(1);
}
