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

test('1. fix_all scripts do not exist', () => {
  const rootDir = fs.readdirSync(process.cwd());
  const hasFixAll = rootDir.some(f => f.startsWith('fix_all') && f.endsWith('.cjs'));
  checkOk(!hasFixAll, 'fix_all scripts should not exist');
});

test('2. package.json does not reference fix_all', () => {
  const pkg = readRoot('package.json');
  checkNotMatch(pkg, /fix_all/);
});

test('3. Shell usa estrutura vertical externa', () => {
  const shell = readSrc('components/layout/Shell.tsx');
  checkMatch(shell, /className="min-h-\[100dvh\] flex flex-col/);
});

test('4. Cabeçalho mobile usa lg:hidden', () => {
  const shell = readSrc('components/layout/Shell.tsx');
  checkMatch(shell, /<MobileAppHeader\s+className="lg:hidden"/);
});

test('5. Sidebar desktop usa hidden lg:flex', () => {
  const shell = readSrc('components/layout/Shell.tsx');
  checkMatch(shell, /className="hidden lg:flex/);
});

test('6. Top bar desktop usa hidden lg:flex', () => {
  const shell = readSrc('components/layout/Shell.tsx');
  checkMatch(shell, /<header className="hidden lg:flex/);
});

test('7. Conteúdo principal possui min-w-0 e overflow-x-hidden', () => {
  const shell = readSrc('components/layout/Shell.tsx');
  checkMatch(shell, /className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden/);
});

test('8. Não existe w-screen em Shell e Overview', () => {
  const shell = readSrc('components/layout/Shell.tsx');
  const overview = readSrc('features/overview/OverviewPage.tsx');
  checkNotMatch(shell, /w-screen/);
  checkNotMatch(overview, /w-screen/);
});

test('9. Não existe margem negativa no Shell', () => {
  const shell = readSrc('components/layout/Shell.tsx');
  checkNotMatch(shell, /-ml-|-mr-|-mx-/);
});

test('10. Drawer possui role dialog e aria-modal', () => {
  const drawer = readSrc('components/layout/MobileNavigationDrawer.tsx');
  checkMatch(drawer, /role="dialog"/);
  checkMatch(drawer, /aria-modal="true"/);
});

test('11. Botão do menu possui aria-expanded e 44px min-height/width', () => {
  const header = readSrc('components/layout/MobileAppHeader.tsx');
  checkMatch(header, /aria-expanded={isMobileMenuOpen}/);
  checkMatch(header, /w-11 h-11/); // 44px
  checkNotMatch(header, /<span className="w-6 h-6"><\/span>/);
});

test('12. Escape fecha o drawer e foco contido', () => {
  const drawer = readSrc('components/layout/MobileNavigationDrawer.tsx');
  checkMatch(drawer, /e\.key === 'Escape'/);
  checkMatch(drawer, /previousFocusRef\.current = document\.activeElement/);
  checkMatch(drawer, /e\.key === 'Tab'/);
});

test('13. DemoBanner possui versão compacta mobile com 44px', () => {
  const banner = readSrc('components/common/DemoBanner.tsx');
  checkMatch(banner, /<div className="lg:hidden/);
  checkMatch(banner, /min-h-\[44px\]/);
});

test('14. Seletor de org mobile e desktop separados e sem absolute fixed top', () => {
  const shell = readSrc('components/layout/Shell.tsx');
  const header = readSrc('components/layout/MobileAppHeader.tsx');
  checkNotMatch(shell, /top-\[104px\]/);
  checkMatch(shell, /isDesktopOrgMenuOpen/);
  checkMatch(header, /isMobileOrgMenuOpen/);
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
  checkNotMatch(overview, /Tool Gateway Ativo/);
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

test('19. Safe areas válidas no Drawer', () => {
  const drawer = readSrc('components/layout/MobileNavigationDrawer.tsx');
  checkMatch(drawer, /pt-\[env\(safe-area-inset-top\)\]/);
  checkMatch(drawer, /pb-\[max\(1rem,env\(safe-area-inset-bottom\)\)\]/);
  checkNotMatch(drawer, /pb-safe/);
});

test('20. Nomes demonstrativos utilizados (sem João Silva)', () => {
  const overview = readSrc('features/overview/OverviewPage.tsx');
  checkNotMatch(overview, /João Silva/);
  checkMatch(overview, /t\.demoContact1/);
});

test('21. Textos traduzidos usando currentLang', () => {
  const header = readSrc('components/layout/MobileAppHeader.tsx');
  const drawer = readSrc('components/layout/MobileNavigationDrawer.tsx');
  const banner = readSrc('components/common/DemoBanner.tsx');
  const overview = readSrc('features/overview/OverviewPage.tsx');
  const shell = readSrc('components/layout/Shell.tsx');
  
  checkMatch(header, /getUxText\(currentLang\)/);
  checkMatch(drawer, /getUxText\(currentLang\)/);
  checkMatch(banner, /getUxText\(currentLang\)/);
  checkMatch(overview, /getUxText\(currentLang\)/);
  checkMatch(shell, /getUxText\(currentLang\)/);
});

test('22. Notificações sem dot engenhado', () => {
  const header = readSrc('components/layout/MobileAppHeader.tsx');
  checkNotMatch(header, /bg-cyan-400/);
  checkMatch(header, /aria-disabled="true"/);
});

test('23. MobileAppHeader implementa Escape e clique fora para seletor de org', () => {
  const header = readSrc('components/layout/MobileAppHeader.tsx');
  checkMatch(header, /e\.key === 'Escape'/);
  checkMatch(header, /document\.addEventListener\('pointerdown'/);
  checkMatch(header, /headerRef\.current\.contains/);
});

test('24. Busca fecha o seletor de organização e drawer', () => {
  const header = readSrc('components/layout/MobileAppHeader.tsx');
  checkMatch(header, /setIsMobileOrgMenuOpen\(false\)/);
  checkMatch(header, /setIsCommandPaletteOpen\(true\)/);
});

test('25. Nome ativo possui aria-label e title com nome completo', () => {
  const header = readSrc('components/layout/MobileAppHeader.tsx');
  checkMatch(header, /aria-label=\{`\$\{t\.header\.activeOrganization\}: \$\{context\.activeOrganization\.name\}`\}/);
  checkMatch(header, /title=\{context\.activeOrganization\.name\}/);
});

test('26. Notificação possui disabled verdadeiro', () => {
  const header = readSrc('components/layout/MobileAppHeader.tsx');
  checkMatch(header, /disabled\s*$/m);
  checkNotMatch(header, /aria-disabled="true"\s*onClick/);
});

test('27. Overview não contém textos hardcoded (Criar Inscrição, Há 1h, Seg/Ter/Qua)', () => {
  const overview = readSrc('features/overview/OverviewPage.tsx');
  checkNotMatch(overview, /Criar Inscrição/);
  checkNotMatch(overview, /Há 1h/);
  checkNotMatch(overview, /Há 2h/);
  checkNotMatch(overview, /'Seg', 'Ter', 'Qua'/);
});

test('28. Overview não contém margens negativas (-mr, -ml, -mx)', () => {
  const overview = readSrc('features/overview/OverviewPage.tsx');
  checkNotMatch(overview, /-mr-/);
  checkNotMatch(overview, /-ml-/);
  checkNotMatch(overview, /-mx-/);
});

test('29. Itens de atenção são buttons sem margem negativa, com foco visível', () => {
  const overview = readSrc('features/overview/OverviewPage.tsx');
  checkMatch(overview, /<button\s+type="button"\s+key=\{item\.id\}/);
  checkMatch(overview, /focus:ring-2/);
});

test('30. Gráfico possui aria-label e role="img"', () => {
  const overview = readSrc('features/overview/OverviewPage.tsx');
  checkMatch(overview, /role="img"/);
  checkMatch(overview, /aria-label=\{t\.chartValueLabel/);
});

console.log(`\nTests completed: ${passed} passed, ${failed} failed. Assertions: ${assertionCount}`);

if (failed > 0 || assertionCount === 0) {
  process.exit(1);
}

