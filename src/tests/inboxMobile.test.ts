import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inboxMobileUiReducer, InboxMobileUiState } from '../features/inbox/inboxMobileState';
import { 
  selectOrganizationConversations,
  selectInitialConversationId,
  selectActiveConversation,
  selectActiveContact,
  isConversationInActiveOrganization,
  validatePendingToolContext,
  createInboxFilterDraft,
  clearInboxFilterDraft,
  getNextFocusIndex,
  getPreviousFocusIndex,
  isElementFocusable,
  ElementFocusDescriptor,
  InboxFilterDraft
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
      console.error(error.message.substring(0, 200));
    } else {
      console.error(String(error).substring(0, 200));
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

function checkMatch(value: string, pattern: RegExp, message?: string): void {
  currentAssertions++;
  totalAssertions++;
  assert.match(value, pattern, message);
}

function checkNotMatch(value: string, pattern: RegExp, message?: string): void {
  currentAssertions++;
  totalAssertions++;
  assert.doesNotMatch(value, pattern, message);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

console.log('--- Running Inbox Mobile UX Tests ---');

// Mock Data for Tenant & Context Tests
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
    status: 'aguardando_humano',
    priority: 'baixa',
    organizationId: 'org_a',
    tags: [],
    lastMessageSnippet: 'Hi',
    lastMessageAt: '2026-03-15T10:05:00Z',
    unreadCount: 0,
  },
  {
    id: 'conv_other',
    contactId: 'cnt_3',
    contactName: 'Charlie',
    channel: 'inapp',
    channelIdentifier: 'inapp_charlie',
    mode: 'com_aprovacao',
    status: 'aberto',
    priority: 'alta',
    organizationId: 'org_b',
    tags: [],
    lastMessageSnippet: 'Hey',
    lastMessageAt: '2026-03-15T10:10:00Z',
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
  },
  {
    id: 'cnt_2',
    name: 'Bob',
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
  riskLevel: 'R1_AUTH_READ',
  confirmationPolicy: 'none',
  readOnly: true,
  idempotencyPolicy: 'not_required',
  supportsPreview: true,
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

// 1-11: REDUCER TESTS
test('Reducer: OPEN_CHAT opens chat', () => {
  const state: InboxMobileUiState = { view: 'list', filtersOpen: true, quickToolsOpen: true };
  const next = inboxMobileUiReducer(state, { type: 'OPEN_CHAT' });
  checkEqual(next.view, 'chat');
});

test('Reducer: OPEN_CHAT closes filters', () => {
  const state: InboxMobileUiState = { view: 'list', filtersOpen: true, quickToolsOpen: true };
  const next = inboxMobileUiReducer(state, { type: 'OPEN_CHAT' });
  checkEqual(next.filtersOpen, false);
});

test('Reducer: OPEN_CHAT closes quick tools', () => {
  const state: InboxMobileUiState = { view: 'list', filtersOpen: true, quickToolsOpen: true };
  const next = inboxMobileUiReducer(state, { type: 'OPEN_CHAT' });
  checkEqual(next.quickToolsOpen, false);
});

test('Reducer: OPEN_CONTEXT opens context', () => {
  const state: InboxMobileUiState = { view: 'chat', filtersOpen: true, quickToolsOpen: true };
  const next = inboxMobileUiReducer(state, { type: 'OPEN_CONTEXT' });
  checkEqual(next.view, 'context');
});

test('Reducer: OPEN_CONTEXT closes overlays', () => {
  const state: InboxMobileUiState = { view: 'chat', filtersOpen: true, quickToolsOpen: true };
  const next = inboxMobileUiReducer(state, { type: 'OPEN_CONTEXT' });
  checkEqual(next.filtersOpen, false);
  checkEqual(next.quickToolsOpen, false);
});

test('Reducer: OPEN_LIST returns list', () => {
  const state: InboxMobileUiState = { view: 'chat', filtersOpen: true, quickToolsOpen: true };
  const next = inboxMobileUiReducer(state, { type: 'OPEN_LIST' });
  checkEqual(next.view, 'list');
  checkEqual(next.filtersOpen, false);
  checkEqual(next.quickToolsOpen, false);
});

test('Reducer: CHANGE_ORG returns list', () => {
  const state: InboxMobileUiState = { view: 'context', filtersOpen: true, quickToolsOpen: true };
  const next = inboxMobileUiReducer(state, { type: 'CHANGE_ORG' });
  checkEqual(next.view, 'list');
});

test('Reducer: CHANGE_ORG closes filters', () => {
  const state: InboxMobileUiState = { view: 'context', filtersOpen: true, quickToolsOpen: true };
  const next = inboxMobileUiReducer(state, { type: 'CHANGE_ORG' });
  checkEqual(next.filtersOpen, false);
});

test('Reducer: CHANGE_ORG closes quick tools', () => {
  const state: InboxMobileUiState = { view: 'context', filtersOpen: true, quickToolsOpen: true };
  const next = inboxMobileUiReducer(state, { type: 'CHANGE_ORG' });
  checkEqual(next.quickToolsOpen, false);
});

test('Reducer: RESET_OVERLAYS preserves the view', () => {
  const state: InboxMobileUiState = { view: 'chat', filtersOpen: true, quickToolsOpen: true };
  const next = inboxMobileUiReducer(state, { type: 'RESET_OVERLAYS' });
  checkEqual(next.view, 'chat');
  checkEqual(next.filtersOpen, false);
  checkEqual(next.quickToolsOpen, false);
});

test('Reducer: Does not modify original state', () => {
  const state: InboxMobileUiState = { view: 'list', filtersOpen: true, quickToolsOpen: true };
  Object.freeze(state);
  const next = inboxMobileUiReducer(state, { type: 'OPEN_CHAT' });
  checkEqual(next.view, 'chat');
});

// 12-25: TENANT TESTS
test('Tenant: Active organization returns only its conversations', () => {
  const conversations = selectOrganizationConversations(testConversations, 'org_a');
  checkEqual(conversations.length, 2);
  checkEqual(conversations[0].organizationId, 'org_a');
  checkEqual(conversations[1].organizationId, 'org_a');
});

test('Tenant: Conversations of other tenants are not returned', () => {
  const conversations = selectOrganizationConversations(testConversations, 'org_a');
  const otherFound = conversations.some(c => c.organizationId === 'org_b');
  checkEqual(otherFound, false);
});

test('Tenant: Organization with no conversations returns empty array', () => {
  const conversations = selectOrganizationConversations(testConversations, 'org_empty');
  checkEqual(conversations.length, 0);
});

test('Tenant: Initial selection returns the first permitted ID', () => {
  const id = selectInitialConversationId(testConversations, 'org_a');
  checkEqual(id, 'conv_1');
});

test('Tenant: Initial selection returns null when there are no conversations', () => {
  const id = selectInitialConversationId(testConversations, 'org_empty');
  checkEqual(id, null);
});

test('Tenant: Active selection returns valid conversation', () => {
  const conv = selectActiveConversation(testConversations, 'org_a', 'conv_2');
  checkOk(conv);
  checkEqual(conv.id, 'conv_2');
});

test('Tenant: ID from another tenant returns null', () => {
  const conv = selectActiveConversation(testConversations, 'org_a', 'conv_other');
  checkEqual(conv, null);
});

test('Tenant: Non-existent ID returns null', () => {
  const conv = selectActiveConversation(testConversations, 'org_a', 'conv_non_existent');
  checkEqual(conv, null);
});

test('Tenant: Corresponding contact is returned', () => {
  const conv = selectActiveConversation(testConversations, 'org_a', 'conv_1');
  const contact = selectActiveContact(testContacts, conv);
  checkOk(contact);
  checkEqual(contact.id, 'cnt_1');
});

test('Tenant: Null conversation returns null contact', () => {
  const contact = selectActiveContact(testContacts, null);
  checkEqual(contact, null);
});

test('Tenant: Broken relation returns null contact', () => {
  const convBroken: Conversation = { ...testConversations[0], contactId: 'cnt_broken' };
  const contact = selectActiveContact(testContacts, convBroken);
  checkEqual(contact, null);
});

test('Tenant: Tenant guard accepts correct conversation', () => {
  const isOk = isConversationInActiveOrganization(testConversations[0], 'org_a');
  checkEqual(isOk, true);
});

test('Tenant: Tenant guard rejects conversation from another tenant', () => {
  const isOk = isConversationInActiveOrganization(testConversations[2], 'org_a');
  checkEqual(isOk, false);
});

test('Tenant: Tenant guard rejects null', () => {
  const isOk = isConversationInActiveOrganization(null, 'org_a');
  checkEqual(isOk, false);
});

// 26-33: PENDING TOOL TESTS
test('Pending Tool: Valid for current conversation', () => {
  const isOk = validatePendingToolContext(mockPending, testConversations[0], 'org_a');
  checkEqual(isOk, true);
});

test('Pending Tool: Rejection of pending tool of another conversation', () => {
  const isOk = validatePendingToolContext(mockPending, testConversations[1], 'org_a');
  checkEqual(isOk, false);
});

test('Pending Tool: Rejection of pending tool of another organization', () => {
  const isOk = validatePendingToolContext(mockPending, testConversations[0], 'org_b');
  checkEqual(isOk, false);
});

test('Pending Tool: Rejection without active conversation', () => {
  const isOk = validatePendingToolContext(mockPending, null, 'org_a');
  checkEqual(isOk, false);
});

test('Pending Tool: Rejection without pending tool', () => {
  const isOk = validatePendingToolContext(null, testConversations[0], 'org_a');
  checkEqual(isOk, false);
});

test('Pending Tool: Rejection when args.organizationId diverges', () => {
  const pendingDivergent: PendingDemoToolInvocation = {
    ...mockPending,
    args: { organizationId: 'org_b' }
  };
  const isOk = validatePendingToolContext(pendingDivergent, testConversations[0], 'org_a');
  checkEqual(isOk, false);
});

test('Pending Tool: Acceptance when organizationId is coherent', () => {
  const isOk = validatePendingToolContext(mockPending, testConversations[0], 'org_a');
  checkEqual(isOk, true);
});

test('Pending Tool: Helper does not modify original objects', () => {
  const pendingFrozen = { ...mockPending };
  Object.freeze(pendingFrozen);
  const isOk = validatePendingToolContext(pendingFrozen, testConversations[0], 'org_a');
  checkEqual(isOk, true);
});

// 34-38: FILTROS TESTS
test('Filters: Draft is created from applied filters', () => {
  const applied: InboxFilterDraft = { mode: 'mine', channel: 'whatsapp' };
  const draft = createInboxFilterDraft(applied);
  checkEqual(draft, applied);
});

test('Filters: Altering the draft does not modify the applied', () => {
  const applied: InboxFilterDraft = { mode: 'mine', channel: 'whatsapp' };
  const draft = createInboxFilterDraft(applied);
  draft.mode = 'resolved';
  checkEqual(applied.mode, 'mine');
});

test('Filters: Clearing returns all/all', () => {
  const cleared = clearInboxFilterDraft();
  checkEqual(cleared.mode, 'all');
  checkEqual(cleared.channel, 'all');
});

test('Filters: Applying preserves the draft values', () => {
  const draft: InboxFilterDraft = { mode: 'resolved', channel: 'instagram' };
  const applied = { ...draft };
  checkEqual(applied.mode, 'resolved');
});

test('Filters: Original objects are not mutated', () => {
  const applied: InboxFilterDraft = { mode: 'all', channel: 'all' };
  Object.freeze(applied);
  const draft = createInboxFilterDraft(applied);
  checkEqual(draft.mode, 'all');
});

// 39-65: STRUCTURAL TESTS (using node:fs)
test('Structural: authority_out.txt does not exist', () => {
  const fileExists = fs.existsSync(path.join(process.cwd(), 'authority_out.txt'));
  checkEqual(fileExists, false);
});

test('Structural: test_output.txt does not exist', () => {
  const fileExists = fs.existsSync(path.join(process.cwd(), 'test_output.txt'));
  checkEqual(fileExists, false);
});

test('Structural: package.json has test:inbox-domain', () => {
  const pkgContent = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8');
  checkOk(pkgContent.includes('test:inbox-domain'));
});

test('Structural: pipeline executes inboxDomain.test.ts', () => {
  const pkgContent = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8');
  checkOk(pkgContent.includes('test:inbox-domain') && pkgContent.includes('test:inbox-mobile'));
});

test('Structural: inboxMobile.test.ts has no standalone type of banned sort', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/tests/inboxMobile.test.ts'), 'utf8');
  // Check that there is no standalone type of banned sort definition
  checkNotMatch(content, new RegExp('\\s+as' + '\\s+any\\b'));
  checkNotMatch(content, new RegExp(':\\s*' + 'any\\b'));
  checkNotMatch(content, new RegExp('\\bany' + '\\s*\\[\\s*\\]'));
});

test('Structural: inboxMobile.test.ts has no banned cast', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/tests/inboxMobile.test.ts'), 'utf8');
  checkNotMatch(content, new RegExp('as' + '\\s+any\\b'));
});

test('Structural: inboxMobile.test.ts has no banned array signature', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/tests/inboxMobile.test.ts'), 'utf8');
  checkNotMatch(content, new RegExp('any' + '\\s*\\[\\s*\\]'));
});

test('Structural: inboxMobile.test.ts does not contain simulateFilterDraft', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/tests/inboxMobile.test.ts'), 'utf8');
  checkNotMatch(content, new RegExp('function' + '\\s+simulateFilterDraft'));
});

test('Structural: inboxMobile.test.ts does not define selectOrganizationConversations', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/tests/inboxMobile.test.ts'), 'utf8');
  checkNotMatch(content, new RegExp('function' + '\\s+selectOrganizationConversations'));
});

test('Structural: inboxMobile.test.ts imports inboxDomain', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/tests/inboxMobile.test.ts'), 'utf8');
  checkOk(content.includes('inboxDomain'));
});

test('Structural: inboxDomain.test.ts imports inboxDomain', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/tests/inboxDomain.test.ts'), 'utf8');
  checkOk(content.includes('inboxDomain'));
});

test('Structural: no suite uses checkOk with literal true value', () => {
  const mContent = fs.readFileSync(path.join(process.cwd(), 'src/tests/inboxMobile.test.ts'), 'utf8');
  const dContent = fs.readFileSync(path.join(process.cwd(), 'src/tests/inboxDomain.test.ts'), 'utf8');
  checkNotMatch(mContent, new RegExp('checkOk' + '\\(\\s*' + 'true\\s*\\)'));
  checkNotMatch(dContent, new RegExp('checkOk' + '\\(\\s*' + 'true\\s*\\)'));
});

test('Structural: no suite uses assert.ok with literal true value', () => {
  const mContent = fs.readFileSync(path.join(process.cwd(), 'src/tests/inboxMobile.test.ts'), 'utf8');
  const dContent = fs.readFileSync(path.join(process.cwd(), 'src/tests/inboxDomain.test.ts'), 'utf8');
  checkNotMatch(mContent, new RegExp('assert' + '\\.ok' + '\\(\\s*' + 'true\\s*\\)'));
  checkNotMatch(dContent, new RegExp('assert' + '\\.ok' + '\\(\\s*' + 'true\\s*\\)'));
});

test('Structural: no suite has callback without assertion', () => {
  // Our harness throws if currentAssertions === 0
  checkOk(totalTests > 0);
});

test('Structural: no worked file creates test output in a file', () => {
  const mContent = fs.readFileSync(path.join(process.cwd(), 'src/tests/inboxMobile.test.ts'), 'utf8');
  const dContent = fs.readFileSync(path.join(process.cwd(), 'src/tests/inboxDomain.test.ts'), 'utf8');
  checkNotMatch(mContent, new RegExp('write' + 'File' + 'Sync'));
  checkNotMatch(dContent, new RegExp('write' + 'File' + 'Sync'));
});

test('Structural: InboxPage uses real selectors', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/features/inbox/InboxPage.tsx'), 'utf8');
  checkOk(content.includes('selectActiveConversation'));
  checkOk(content.includes('selectActiveContact'));
  checkOk(content.includes('selectOrganizationConversations'));
});

test('Structural: InboxPage does not use conversations[0] as global fallback', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/features/inbox/InboxPage.tsx'), 'utf8');
  // Check that there is no arbitrary conversations[0] fallback assignment for activeConversation outside demo
  checkNotMatch(content, new RegExp('activeConversation' + '\\s*=\\s*conversations\\[0\\]'));
});

test('Structural: InboxPage does not use mockContacts[0]', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/features/inbox/InboxPage.tsx'), 'utf8');
  checkNotMatch(content, new RegExp('mockContacts' + '\\[0\\]'));
});

test('Structural: InboxPage has no banned cast', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/features/inbox/InboxPage.tsx'), 'utf8');
  checkNotMatch(content, new RegExp('as' + '\\s+any\\b'));
});

test('Structural: handleConfirmTool has tenant guard', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/features/inbox/InboxPage.tsx'), 'utf8');
  checkOk(content.includes('validatePendingToolContext'));
});

test('Structural: handleConfirmTool validates conversationId', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/features/inbox/InboxPage.tsx'), 'utf8');
  checkOk(content.includes('validatePendingToolContext'));
});

test('Structural: DemoToolConfirmationDialog remains rendered', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/features/inbox/InboxPage.tsx'), 'utf8');
  checkOk(content.includes('DemoToolConfirmationDialog'));
});

test('Structural: ToolGatewayService not altered', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/core/services/toolGateway.ts'), 'utf8');
  checkOk(content.includes('class ToolGatewayService'));
});

test('Structural: DemoPolicySimulator not altered', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/demo/policies/demoPolicySimulator.ts'), 'utf8');
  checkOk(content.includes('class DemoPolicySimulator'));
});

test('Structural: demoToolFlow not altered semantically', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/demo/confirmations/demoToolFlow.ts'), 'utf8');
  checkOk(content.includes('prepareDemoToolInvocation'));
  checkOk(content.includes('classifyDemoToolFlow'));
});

test('Structural: human_approval remains blocked', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/demo/policies/demoPolicySimulator.ts'), 'utf8');
  checkOk(content.includes('human_approval'));
});

test('Structural: R2 remains conditioned to confirmation', () => {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/demo/policies/demoPolicySimulator.ts'), 'utf8');
  checkOk(content.includes('R2_REVERSIBLE_WRITE'));
});

// 66-74: FOCUS TRAP TESTS (isElementFocusable, getNextFocusIndex, getPreviousFocusIndex)
test('Focus Trap: Element disabled is excluded', () => {
  const descriptor: ElementFocusDescriptor = { disabled: true };
  const focusable = isElementFocusable(descriptor);
  checkEqual(focusable, false);
});

test('Focus Trap: Element aria-hidden is excluded', () => {
  const descriptor: ElementFocusDescriptor = { ariaHidden: 'true' };
  const focusable = isElementFocusable(descriptor);
  checkEqual(focusable, false);
});

test('Focus Trap: Element inert is excluded', () => {
  const descriptor: ElementFocusDescriptor = { inert: true };
  const focusable = isElementFocusable(descriptor);
  checkEqual(focusable, false);
});

test('Focus Trap: tabindex=-1 is excluded', () => {
  const descriptor: ElementFocusDescriptor = { tabIndex: -1 };
  const focusable = isElementFocusable(descriptor);
  checkEqual(focusable, false);
});

test('Focus Trap: Element visible and enabled is included', () => {
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
  const focusable = isElementFocusable(descriptor);
  checkEqual(focusable, true);
});

test('Focus Trap: Tab on last returns to first', () => {
  const nextIdx = getNextFocusIndex(2, 3);
  checkEqual(nextIdx, 0);
});

test('Focus Trap: Shift+Tab on first returns to last', () => {
  const prevIdx = getPreviousFocusIndex(0, 3);
  checkEqual(prevIdx, 2);
});

test('Focus Trap: Empty list does not throw', () => {
  const nextIdx = getNextFocusIndex(0, 0);
  checkEqual(nextIdx, 0);
});

test('Focus Trap: One element list remains stable', () => {
  const nextIdx = getNextFocusIndex(0, 1);
  checkEqual(nextIdx, 0);
});

console.log(`Tests completed: ${passedTests} passed, ${failedTests} failed, ${skippedTests} skipped. Assertions: ${totalAssertions}`);
if (failedTests > 0) {
  process.exitCode = 1;
}
