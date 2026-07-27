import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readSrc(filePath: string): string {
  const absolutePath = path.resolve(process.cwd(), 'src', filePath);
  return fs.readFileSync(absolutePath, 'utf8');
}

function checkMatch(content: string, regex: RegExp, message: string) {
  if (!regex.test(content)) {
    throw new Error(`Test Failed: ${message}`);
  }
}

function checkNotMatch(content: string, regex: RegExp, message: string) {
  if (regex.test(content)) {
    throw new Error(`Test Failed: ${message}`);
  }
}

function runTests() {
  let passed = 0;
  let assertions = 0;

  try {
    const mobileStateContent = readSrc('features/inbox/inboxMobileState.ts');
    
    checkMatch(mobileStateContent, /export type InboxMobileView = 'list' \| 'chat' \| 'context';/, "Must export InboxMobileView");
    assertions++;
    checkMatch(mobileStateContent, /filtersOpen:\s*boolean;/, "InboxMobileUiState must have filtersOpen");
    assertions++;
    checkMatch(mobileStateContent, /quickToolsOpen:\s*boolean;/, "InboxMobileUiState must have quickToolsOpen");
    assertions++;
    checkMatch(mobileStateContent, /case 'OPEN_LIST':/, "Must handle OPEN_LIST");
    assertions++;
    checkMatch(mobileStateContent, /case 'OPEN_CHAT':/, "Must handle OPEN_CHAT");
    assertions++;
    checkMatch(mobileStateContent, /case 'OPEN_CONTEXT':/, "Must handle OPEN_CONTEXT");
    assertions++;
    passed++;

    const uxContent = readSrc('i18n/inboxUx.ts');
    checkMatch(uxContent, /INBOX_UX\s*=\s*{/, "Must define INBOX_UX dictionary");
    assertions++;
    checkMatch(uxContent, /'pt-BR':\s*{/, "Must support pt-BR");
    assertions++;
    checkMatch(uxContent, /'en-US':\s*{/, "Must support en-US");
    assertions++;
    checkMatch(uxContent, /'es-ES':\s*{/, "Must support es-ES");
    assertions++;
    checkMatch(uxContent, /title:\s*'Caixa de Entrada'/, "Must translate title");
    assertions++;
    passed++;

    const filterSheetContent = readSrc('features/inbox/InboxFilterSheet.tsx');
    checkMatch(filterSheetContent, /InboxFilterSheet: React\.FC/, "Must define InboxFilterSheet component");
    assertions++;
    checkMatch(filterSheetContent, /role="dialog"/, "Filter sheet must have role=dialog");
    assertions++;
    checkMatch(filterSheetContent, /aria-modal="true"/, "Filter sheet must be aria-modal");
    assertions++;
    checkMatch(filterSheetContent, /aria-labelledby="filter-dialog-title"/, "Filter sheet must have aria-labelledby");
    assertions++;
    passed++;

    const quickToolsSheetContent = readSrc('features/inbox/InboxQuickToolsSheet.tsx');
    checkMatch(quickToolsSheetContent, /InboxQuickToolsSheet: React\.FC/, "Must define InboxQuickToolsSheet component");
    assertions++;
    checkMatch(quickToolsSheetContent, /role="dialog"/, "QuickTools sheet must have role=dialog");
    assertions++;
    checkMatch(quickToolsSheetContent, /aria-modal="true"/, "QuickTools sheet must be aria-modal");
    assertions++;
    checkMatch(quickToolsSheetContent, /aria-labelledby="quicktools-dialog-title"/, "QuickTools sheet must have aria-labelledby");
    assertions++;
    passed++;

    const inboxPageContent = readSrc('features/inbox/InboxPage.tsx');
    checkMatch(inboxPageContent, /import\s+{.*InboxFilterSheet.*}\s+from\s+'\.\/InboxFilterSheet'/, "Must import InboxFilterSheet");
    assertions++;
    checkMatch(inboxPageContent, /import\s+{.*InboxQuickToolsSheet.*}\s+from\s+'\.\/InboxQuickToolsSheet'/, "Must import InboxQuickToolsSheet");
    assertions++;
    checkMatch(inboxPageContent, /dispatchMobile\({ type: 'CHANGE_ORG' }\)/, "Must dispatch CHANGE_ORG when org changes");
    assertions++;
    checkMatch(inboxPageContent, /flex-1 min-h-0 flex overflow-hidden/, "Must have flex-1 min-h-0 for proper flex behavior in shell");
    assertions++;
    checkMatch(inboxPageContent, /<InboxFilterSheet/, "Must render InboxFilterSheet");
    assertions++;
    checkMatch(inboxPageContent, /<InboxQuickToolsSheet/, "Must render InboxQuickToolsSheet");
    assertions++;
    
    // Check notices
    checkMatch(inboxPageContent, /role=\{notice\.kind === 'error' \|\| notice\.kind === 'warning' \? 'alert' : 'status'\}/, "Notices must use alert or status roles");
    assertions++;

    passed++;

    console.log(`\n--- Running Inbox Mobile UX Tests ---`);
    console.log(`Tests completed: ${passed} passed, 0 failed. Total: 5 files checked. Assertions: ${assertions}`);
  } catch (err: any) {
    console.error(`\n--- Running Inbox Mobile UX Tests ---`);
    console.error(err.message);
    process.exit(1);
  }
}

runTests();
