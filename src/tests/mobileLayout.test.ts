import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

let passed = 0;
let failed = 0;
let assertionCount = 0;

function checkOk(value: unknown, message?: string): asserts value {
  assertionCount++;
  assert.ok(value, message);
}

function checkMatch(value: string, regex: RegExp, message?: string): void {
  assertionCount++;
  assert.match(value, regex, message);
}

function checkNotMatch(value: string, regex: RegExp, message?: string): void {
  assertionCount++;
  assert.doesNotMatch(value, regex, message);
}

function test(name: string, fn: () => void): void {
  let startAssertions = assertionCount;
  try {
    fn();
    if (assertionCount === startAssertions) {
      throw new Error("No assertions executed in test");
    }
    passed++;
  } catch (e) {
    failed++;
    console.error(`\n❌ Test failed: ${name}`);
    if (e instanceof Error) {
      console.error(e.message);
    }
  }
}

function readSrc(filePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), 'src', filePath), 'utf-8');
}

function readRoot(filePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');
}

console.log('--- Running Mobile Layout Tests ---');

test('1. Shell usa estrutura vertical externa', () => {
  const shell = readSrc('components/layout/Shell.tsx');
  checkMatch(shell, /className="min-h-\[100dvh\] flex flex-col/);
});

test('2. Cabeçalho mobile usa lg:hidden', () => {
  const shell = readSrc('components/layout/Shell.tsx');
  checkMatch(shell, /<MobileAppHeader\s+className="lg:hidden"/);
});

test('3. Sidebar desktop usa hidden lg:flex', () => {
  const shell = readSrc('components/layout/Shell.tsx');
  checkMatch(shell, /className="hidden lg:flex/);
});

test('4. Top bar desktop usa hidden lg:flex', () => {
  const shell = readSrc('components/layout/Shell.tsx');
  checkMatch(shell, /<header className="hidden lg:flex/);
});

test('5. Conteúdo principal possui min-w-0 e overflow-x-hidden', () => {
  const shell = readSrc('components/layout/Shell.tsx');
  checkMatch(shell, /className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden/);
});

test('6. Não existe w-screen em Shell e Overview', () => {
  const shell = readSrc('components/layout/Shell.tsx');
  const overview = readSrc('features/overview/OverviewPage.tsx');
  checkNotMatch(shell, /w-screen/);
  checkNotMatch(overview, /w-screen/);
});

test('7. Não existe margem negativa no Shell', () => {
  const shell = readSrc('components/layout/Shell.tsx');
  checkNotMatch(shell, /-ml-|-mr-|-mx-/);
});

test('8. Drawer possui role dialog e aria-modal', () => {
  const drawer = readSrc('components/layout/MobileNavigationDrawer.tsx');
  checkMatch(drawer, /role="dialog"/);
  checkMatch(drawer, /aria-modal="true"/);
});

test('9. Botão do menu possui aria-expanded', () => {
  const header = readSrc('components/layout/MobileAppHeader.tsx');
  checkMatch(header, /aria-expanded={isMobileMenuOpen}/);
});

test('10. Escape fecha o drawer', () => {
  const drawer = readSrc('components/layout/MobileNavigationDrawer.tsx');
  checkMatch(drawer, /e\.key === 'Escape'/);
});

test('11. DemoBanner possui versão compacta mobile', () => {
  const banner = readSrc('components/common/DemoBanner.tsx');
  checkMatch(banner, /<div className="lg:hidden/);
});

test('12. DemoBanner usa Tool Gateway simulado', () => {
  const banner = readSrc('components/common/DemoBanner.tsx');
  checkMatch(banner, /Tool Gateway simulado/);
  checkNotMatch(banner, /Tool Gateway Ativo/);
});

test('13. Overview: KPIs usam grade responsiva', () => {
  const overview = readSrc('features/overview/OverviewPage.tsx');
  checkMatch(overview, /grid-cols-2 sm:grid-cols-3 lg:grid-cols-5/);
});

test('14. Overview: Badges usam max-w-full e whitespace-normal', () => {
  const overview = readSrc('features/overview/OverviewPage.tsx');
  checkMatch(overview, /whitespace-normal/);
  checkMatch(overview, /max-w-full/);
});

test('15. Falsificações removidas: Saúde dos Canais, SAUDÁVEL, Sessões, etc', () => {
  const overview = readSrc('features/overview/OverviewPage.tsx');
  checkNotMatch(overview, /Saúde dos Canais 3\/3/);
  checkNotMatch(overview, /WhatsApp, IG, In-App OK/);
  checkNotMatch(overview, /@millionsnest_official/);
  checkNotMatch(overview, /SAUDÁVEL/);
  checkNotMatch(overview, /42 SESSÕES/i);
  checkNotMatch(overview, /Integrado no MusicScale/);
});

test('16. Ações são identificadas como simulações', () => {
  const overview = readSrc('features/overview/OverviewPage.tsx');
  checkMatch(overview, /Simulações recentes do Tool Gateway/);
});

test('17. HTML lang é pt-BR e title é MillionsNest Connect', () => {
  const html = readRoot('index.html');
  checkMatch(html, /lang="pt-BR"/);
  checkMatch(html, /<title>MillionsNest Connect<\/title>/);
});

test('18. CSS Global não tem user-scalable=no, e width é 100%', () => {
  const css = readSrc('index.css');
  checkNotMatch(css, /user-scalable=no/);
  checkMatch(css, /width:\s*100%;/);
  checkMatch(css, /overflow-x:\s*hidden;/);
});

console.log(`\nTests completed: ${passed} passed, ${failed} failed. Assertions: ${assertionCount}`);

if (failed > 0 || assertionCount === 0) {
  process.exit(1);
}
