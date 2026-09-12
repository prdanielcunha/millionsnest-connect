import { getLiveNavigationRouteIds, isLiveRouteEnabled } from '../core/client/liveSurfacePolicy';
import { toTrustedMusicScaleUrl } from '../core/client/liveDeepLink';

let passed = 0;
let total = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  passed++;
}
function ok(value: unknown, message: string) {
  total++;
  if (!value) throw new Error(message);
  passed++;
}

console.log('--- Running Live Surface Policy Tests ---');

equal(getLiveNavigationRouteIds(false), ['overview'], 'non-governance live users only see the real Core overview');
equal(getLiveNavigationRouteIds(true), ['overview', 'radar', 'contacts'], 'governance live users see real Core, Radar and People surfaces');
ok(isLiveRouteEnabled('overview', true), 'overview is live');
ok(isLiveRouteEnabled('radar', true), 'Radar is live for governance users');
ok(!isLiveRouteEnabled('inbox', true), 'Inbox is not advertised as live before its backend is connected');
ok(!isLiveRouteEnabled('tools', true), 'Tool Gateway UI is not advertised as live before its backend surface is connected');
ok(isLiveRouteEnabled('contacts', true), 'People/Contacts is live for governance users');

equal(
  toTrustedMusicScaleUrl('/scales/scale-123'),
  'https://musicscale.millionsnest.com/scales/scale-123',
  'relative MusicScale deep links resolve only to the canonical MusicScale origin',
);
equal(toTrustedMusicScaleUrl('https://evil.example/scales/1'), null, 'absolute external links are rejected');
equal(toTrustedMusicScaleUrl('//evil.example/scales/1'), null, 'scheme-relative external links are rejected');
equal(toTrustedMusicScaleUrl(undefined), null, 'missing deep links are ignored');

console.log(`✅ Passed ${passed} / ${total} tests.`);
