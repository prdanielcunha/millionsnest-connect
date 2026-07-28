import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BrandLogo, BRAND_LOGO_DIMENSIONS } from '../components/common/BrandLogo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.resolve(__dirname, '..');
const publicDir = path.resolve(__dirname, '../../public');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`✅ Test passed: ${name}`);
    passCount++;
  } else {
    console.error(`❌ Test failed: ${name}`);
    failCount++;
  }
}

// Helper to extract attributes from stringified HTML
function getAttr(html: string, attr: string): string | null {
  const match = html.match(new RegExp(`${attr}="([^"]*)"`));
  return match ? match[1] : null;
}

// Helper to check if stringified HTML contains a substring
function contains(html: string, substr: string): boolean {
  return html.includes(substr);
}

// 1. desktopWordmark
const desktopHtml = renderToString(React.createElement(BrandLogo, { layout: 'horizontal', surface: 'dark', size: 'desktopWordmark' }));
assert(
  getAttr(desktopHtml, 'src') === '/brand/connect/v2/01_master_vector/connect-logo-horizontal-on-dark.svg',
  '1a. desktopWordmark uses correct asset horizontal dark'
);
assert(
  getAttr(desktopHtml, 'width') === '208' && getAttr(desktopHtml, 'height') === '50',
  '1b. desktopWordmark dimensions are 208x50'
);
assert(
  getAttr(desktopHtml, 'alt') === 'MillionsNest Connect',
  '1c. desktopWordmark has correct institutional alt text'
);

// 2. drawerWordmark
const drawerHtml = renderToString(React.createElement(BrandLogo, { layout: 'horizontal', surface: 'dark', size: 'drawerWordmark' }));
assert(
  getAttr(drawerHtml, 'src') === '/brand/connect/v2/01_master_vector/connect-logo-horizontal-on-dark.svg',
  '2a. drawerWordmark uses correct asset horizontal dark'
);
assert(
  getAttr(drawerHtml, 'width') === '184' && getAttr(drawerHtml, 'height') === '44',
  '2b. drawerWordmark dimensions are 184x44'
);

// 3. mobileMark
const mobileHtml = renderToString(React.createElement(BrandLogo, { layout: 'mark', markColor: 'color', size: 'mobileMark' }));
assert(
  getAttr(mobileHtml, 'src') === '/brand/connect/v2/01_master_vector/connect-mark-color.svg',
  '3a. mobileMark uses connect-mark-color.svg'
);
assert(
  getAttr(mobileHtml, 'width') === '40' && getAttr(mobileHtml, 'height') === '40',
  '3b. mobileMark dimensions are 40x40'
);
assert(
  !contains(mobileHtml, 'connect-logo-horizontal'),
  '3c. mobileMark does not use the horizontal SVG'
);

// 4. Uso decorativo
const decorativeHtml = renderToString(React.createElement(BrandLogo, { decorative: true }));
assert(
  getAttr(decorativeHtml, 'alt') === '',
  '4a. Decorative use has alt=""'
);
assert(
  getAttr(decorativeHtml, 'aria-hidden') === 'true',
  '4b. Decorative use has aria-hidden="true"'
);

// 5. Compatibilidade (uso legado)
const legacyHtml = renderToString(React.createElement(BrandLogo, { className: 'h-6 w-auto' }));
assert(
  getAttr(legacyHtml, 'class') === 'h-6 w-auto' && !getAttr(legacyHtml, 'width') && !getAttr(legacyHtml, 'height'),
  '5a. Legacy usage without size continues to render without error and applies classes'
);

// 6. Integridade dos consumidores
const shellCode = fs.readFileSync(path.join(srcDir, 'components/layout/Shell.tsx'), 'utf-8');
const headerCode = fs.readFileSync(path.join(srcDir, 'components/layout/MobileAppHeader.tsx'), 'utf-8');
const drawerCode = fs.readFileSync(path.join(srcDir, 'components/layout/MobileNavigationDrawer.tsx'), 'utf-8');

assert(
  shellCode.includes('size="desktopWordmark"'),
  '6a. Shell.tsx uses desktopWordmark'
);
assert(
  headerCode.includes('size="mobileMark"'),
  '6b. MobileAppHeader.tsx uses mobileMark'
);
assert(
  drawerCode.includes('size="drawerWordmark"'),
  '6c. MobileNavigationDrawer.tsx uses drawerWordmark'
);
assert(
  !shellCode.includes('className="h-5 w-auto"') && !shellCode.includes('className="h-6 w-auto"'),
  '6d. Shell.tsx does not use h-5 w-auto or h-6 w-auto for BrandLogo'
);
assert(
  !headerCode.includes('className="h-5 w-auto"') && !headerCode.includes('className="h-6 w-auto"'),
  '6e. MobileAppHeader.tsx does not use h-5 w-auto or h-6 w-auto for BrandLogo'
);
assert(
  !drawerCode.includes('className="h-5 w-auto"') && !drawerCode.includes('className="h-6 w-auto"'),
  '6f. MobileNavigationDrawer.tsx does not use h-5 w-auto or h-6 w-auto for BrandLogo'
);

// 7. Assets
const assetDark = path.join(publicDir, 'brand/connect/v2/01_master_vector/connect-logo-horizontal-on-dark.svg');
const assetLight = path.join(publicDir, 'brand/connect/v2/01_master_vector/connect-logo-horizontal-on-light.svg');
const assetMark = path.join(publicDir, 'brand/connect/v2/01_master_vector/connect-mark-color.svg');

assert(fs.existsSync(assetDark), '7a. connect-logo-horizontal-on-dark.svg exists');
assert(fs.existsSync(assetLight), '7b. connect-logo-horizontal-on-light.svg exists');
assert(fs.existsSync(assetMark), '7c. connect-mark-color.svg exists');

assert(
  !desktopHtml.includes('workspace') && !desktopHtml.includes('http'),
  '7d. No absolute path for workspace used'
);
assert(
  !desktopHtml.includes('/v1/'),
  '7e. No reference points to V1'
);

console.log(`\nTests completed: ${passCount + failCount} tests. ${passCount} passed, ${failCount} failed.`);
if (failCount > 0) {
  process.exit(1);
}
