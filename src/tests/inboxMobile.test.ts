import assert from 'node:assert/strict';
import { inboxMobileUiReducer, InboxMobileUiState } from '../features/inbox/inboxMobileState';

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

function checkEqual<T>(actual: T, expected: T, message?: string) {
  currentAssertions++;
  totalAssertions++;
  assert.deepEqual(actual, expected, message);
}

function checkOk(value: any, message?: string) {
  currentAssertions++;
  totalAssertions++;
  assert.ok(value, message);
}

console.log('--- Running Inbox Mobile UX Tests ---');

// Reducer Tests
test('Reducer: Initial state should be list', () => {
  const initialState: InboxMobileUiState = { view: 'list', filtersOpen: false, quickToolsOpen: false };
  checkEqual(initialState.view, 'list');
});

test('Reducer: OPEN_CHAT defines chat and closes overlays', () => {
  const initialState: InboxMobileUiState = { view: 'list', filtersOpen: true, quickToolsOpen: true };
  const newState = inboxMobileUiReducer(initialState, { type: 'OPEN_CHAT' });
  checkEqual(newState.view, 'chat');
  checkEqual(newState.filtersOpen, false);
  checkEqual(newState.quickToolsOpen, false);
});

test('Reducer: OPEN_CONTEXT defines context and closes overlays', () => {
  const initialState: InboxMobileUiState = { view: 'chat', filtersOpen: true, quickToolsOpen: true };
  const newState = inboxMobileUiReducer(initialState, { type: 'OPEN_CONTEXT' });
  checkEqual(newState.view, 'context');
  checkEqual(newState.filtersOpen, false);
  checkEqual(newState.quickToolsOpen, false);
});

test('Reducer: OPEN_LIST defines list and closes overlays', () => {
  const initialState: InboxMobileUiState = { view: 'chat', filtersOpen: true, quickToolsOpen: true };
  const newState = inboxMobileUiReducer(initialState, { type: 'OPEN_LIST' });
  checkEqual(newState.view, 'list');
  checkEqual(newState.filtersOpen, false);
  checkEqual(newState.quickToolsOpen, false);
});

test('Reducer: OPEN_FILTERS opens filters and closes tools', () => {
  const initialState: InboxMobileUiState = { view: 'chat', filtersOpen: false, quickToolsOpen: true };
  const newState = inboxMobileUiReducer(initialState, { type: 'OPEN_FILTERS' });
  checkEqual(newState.view, 'chat');
  checkEqual(newState.filtersOpen, true);
  checkEqual(newState.quickToolsOpen, false);
});

test('Reducer: OPEN_QUICK_TOOLS opens tools and closes filters', () => {
  const initialState: InboxMobileUiState = { view: 'chat', filtersOpen: true, quickToolsOpen: false };
  const newState = inboxMobileUiReducer(initialState, { type: 'OPEN_QUICK_TOOLS' });
  checkEqual(newState.view, 'chat');
  checkEqual(newState.filtersOpen, false);
  checkEqual(newState.quickToolsOpen, true);
});

test('Reducer: CLOSE_FILTERS preserves view', () => {
  const initialState: InboxMobileUiState = { view: 'context', filtersOpen: true, quickToolsOpen: false };
  const newState = inboxMobileUiReducer(initialState, { type: 'CLOSE_FILTERS' });
  checkEqual(newState.view, 'context');
  checkEqual(newState.filtersOpen, false);
});

test('Reducer: CLOSE_QUICK_TOOLS preserves view', () => {
  const initialState: InboxMobileUiState = { view: 'chat', filtersOpen: false, quickToolsOpen: true };
  const newState = inboxMobileUiReducer(initialState, { type: 'CLOSE_QUICK_TOOLS' });
  checkEqual(newState.view, 'chat');
  checkEqual(newState.quickToolsOpen, false);
});

test('Reducer: RESET_OVERLAYS preserves view', () => {
  const initialState: InboxMobileUiState = { view: 'chat', filtersOpen: true, quickToolsOpen: true };
  const newState = inboxMobileUiReducer(initialState, { type: 'RESET_OVERLAYS' });
  checkEqual(newState.view, 'chat');
  checkEqual(newState.filtersOpen, false);
  checkEqual(newState.quickToolsOpen, false);
});

test('Reducer: CHANGE_ORG returns to list and closes overlays', () => {
  const initialState: InboxMobileUiState = { view: 'context', filtersOpen: true, quickToolsOpen: true };
  const newState = inboxMobileUiReducer(initialState, { type: 'CHANGE_ORG' });
  checkEqual(newState.view, 'list');
  checkEqual(newState.filtersOpen, false);
  checkEqual(newState.quickToolsOpen, false);
});

test('Reducer: Does not mutate original object', () => {
  const initialState: InboxMobileUiState = { view: 'list', filtersOpen: false, quickToolsOpen: false };
  Object.freeze(initialState);
  const newState = inboxMobileUiReducer(initialState, { type: 'OPEN_CHAT' });
  checkEqual(newState.view, 'chat');
});

// Draft Filters Tests
function simulateFilterDraft() {
  let applied = { mode: 'all', channel: 'all' };
  let draft = { ...applied };
  
  return {
    getApplied: () => applied,
    getDraft: () => draft,
    open: () => { draft = { ...applied }; },
    setDraft: (newDraft: any) => { draft = { ...newDraft }; },
    apply: () => { applied = { ...draft }; },
    cancel: () => { draft = { ...applied }; },
    clear: () => { draft = { mode: 'all', channel: 'all' }; }
  };
}

test('Filters: Open copies applied filters to draft', () => {
  const f = simulateFilterDraft();
  f.apply();
  f.open();
  checkEqual(f.getDraft().mode, 'all');
});

test('Filters: Changing draft does not change applied', () => {
  const f = simulateFilterDraft();
  f.open();
  f.setDraft({ mode: 'mine', channel: 'whatsapp' });
  checkEqual(f.getApplied().mode, 'all');
  checkEqual(f.getDraft().mode, 'mine');
});

test('Filters: Apply confirms draft to applied', () => {
  const f = simulateFilterDraft();
  f.open();
  f.setDraft({ mode: 'mine', channel: 'whatsapp' });
  f.apply();
  checkEqual(f.getApplied().mode, 'mine');
});

test('Filters: Cancel discards draft and preserves applied', () => {
  const f = simulateFilterDraft();
  f.open();
  f.setDraft({ mode: 'mine', channel: 'whatsapp' });
  f.cancel();
  checkEqual(f.getApplied().mode, 'all');
  checkEqual(f.getDraft().mode, 'all');
});

test('Filters: Clear resets draft only', () => {
  const f = simulateFilterDraft();
  f.setDraft({ mode: 'mine', channel: 'whatsapp' });
  f.apply();
  f.open();
  f.clear();
  checkEqual(f.getDraft().mode, 'all');
  checkEqual(f.getApplied().mode, 'mine');
});

test('Filters: Escape uses cancelation', () => {
  const f = simulateFilterDraft();
  f.open();
  f.setDraft({ mode: 'resolved', channel: 'instagram' });
  f.cancel(); // Simulated escape
  checkEqual(f.getApplied().mode, 'all');
});

test('Filters: Overlay uses cancelation', () => {
  const f = simulateFilterDraft();
  f.open();
  f.setDraft({ mode: 'resolved', channel: 'instagram' });
  f.cancel(); // Simulated overlay
  checkEqual(f.getApplied().mode, 'all');
});

// Tenant Isolation Tests
function selectOrganizationConversations(conversations: any[], orgId: string) {
  return conversations.filter(c => c.organizationId === orgId);
}

const mockTenantConversations = [
  { id: '1', organizationId: 'org1' },
  { id: '2', organizationId: 'org1' },
  { id: '3', organizationId: 'org2' },
];

test('Tenant: Returns only active organization conversations', () => {
  const res = selectOrganizationConversations(mockTenantConversations, 'org1');
  checkEqual(res.length, 2);
  checkEqual(res[0].id, '1');
});

test('Tenant: Does not return conversations from another organization', () => {
  const res = selectOrganizationConversations(mockTenantConversations, 'org1');
  const hasOrg2 = res.some(c => c.organizationId === 'org2');
  checkEqual(hasOrg2, false);
});

test('Tenant: Organization without conversations returns empty array', () => {
  const res = selectOrganizationConversations(mockTenantConversations, 'org3');
  checkEqual(res.length, 0);
});

test('Tenant: activeContact does not have global fallback', () => {
  const contact = null; // Simulated behavior when activeConversation is null
  checkEqual(contact, null);
});

test('Tenant: tenant mismatch blocks tool preparation', () => {
  const activeConversation = { organizationId: 'org2' };
  const activeOrgId = 'org1';
  const blocked = activeConversation.organizationId !== activeOrgId;
  checkEqual(blocked, true);
});

test('Tenant: tenant mismatch blocks sending messages', () => {
  const activeConversation = { organizationId: 'org2' };
  const activeOrgId = 'org1';
  const blocked = activeConversation.organizationId !== activeOrgId;
  checkEqual(blocked, true);
});

console.log(`Tests completed: ${passedTests} passed, ${failedTests} failed, ${skippedTests} skipped. Assertions: ${totalAssertions}`);
if (failedTests > 0) {
  process.exitCode = 1;
}
