import assert from 'node:assert/strict';
import { 
  selectOrganizationConversations, 
  selectInitialConversationId, 
  selectActiveConversation, 
  selectActiveContact, 
  validatePendingToolContext,
  getNextFocusIndex,
  getPreviousFocusIndex,
  isElementFocusable,
  ElementFocusDescriptor
} from '../features/inbox/inboxDomain';
import { Conversation, Contact, ToolDefinition } from '../types';
import { PendingDemoToolInvocation } from '../demo/confirmations/demoToolFlow';

let totalTests = 0;
let passedTests = 0;
let skippedTests = 0;
let failedTests = 0;
let totalAssertions = 0;
let currentAssertions = 0;

function test(name: string, callback: () => void | Promise<void>) {
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

console.log(`\nTests completed: ${passedTests} passed, ${failedTests} failed, ${skippedTests} skipped. Assertions: ${totalAssertions}`);
if (failedTests > 0) {
  process.exit(1);
}
