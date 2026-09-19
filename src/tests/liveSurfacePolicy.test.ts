import {
  getExperienceNavigationRouteIds,
  getLiveNavigationRouteIds,
  isLiveRouteEnabled,
  resolveExperienceProfile,
  resolveRealExperienceProfile,
} from '../core/client/liveSurfacePolicy';
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

equal(getLiveNavigationRouteIds(false), ['overview', 'assist'], 'non-governance live users get adaptive home plus real Assist');
equal(
  getLiveNavigationRouteIds(true),
  ['overview', 'assist', 'radar', 'sources', 'contacts', 'intelligence'],
  'governance live surfaces include adaptive home, Assist and Relationship Intelligence modules',
);
ok(isLiveRouteEnabled('overview', true), 'adaptive overview is live');
ok(isLiveRouteEnabled('assist', true), 'Assist is live');
ok(isLiveRouteEnabled('radar', true), 'Radar is live for governance users');
ok(isLiveRouteEnabled('sources', true), 'Personal Sources is live for governance users');
ok(!isLiveRouteEnabled('inbox', true), 'Inbox is visible as controlled but not advertised as activated');
ok(!isLiveRouteEnabled('tools', true), 'Tool Gateway technical UI is not a live user surface');
ok(isLiveRouteEnabled('contacts', true), 'People/Contacts is live for governance users');
ok(isLiveRouteEnabled('intelligence', true), 'Relationship Intelligence is live for governance users');

equal(resolveRealExperienceProfile('ceo'), 'ceo', 'CEO resolves to executive experience');
equal(resolveRealExperienceProfile('support'), 'support', 'support role resolves to support experience');
equal(resolveRealExperienceProfile(null, 'Líder de Louvor'), 'worship_leader', 'canonical organization role resolves to worship leader experience');
equal(resolveExperienceProfile('commercial', 'ceo'), 'commercial', 'preview lens changes experience only');
equal(resolveExperienceProfile('real', 'ceo'), 'ceo', 'real lens keeps the canonical experience');
ok(getExperienceNavigationRouteIds('commercial', true).includes('radar'), 'commercial experience exposes Radar');
ok(!getExperienceNavigationRouteIds('musician', true).includes('radar'), 'musician experience does not expose commercial Radar');
ok(getExperienceNavigationRouteIds('organization_admin', false).includes('channels'), 'admin experience can see staged operations');
ok(getExperienceNavigationRouteIds('ceo', true).includes('developer'), 'CEO experience exposes the safe Developer Center');
ok(!getExperienceNavigationRouteIds('organization_admin', true).includes('developer'), 'Developer Center stays out of organization-admin navigation');
ok(!getExperienceNavigationRouteIds('commercial', false).includes('radar'), 'relationship routes remain gated when Radar capability is unavailable');

equal(
  toTrustedMusicScaleUrl('/scales/scale-123'),
  'https://musicscale.millionsnest.com/scales/scale-123',
  'relative MusicScale deep links resolve only to the canonical MusicScale origin',
);
equal(toTrustedMusicScaleUrl('https://evil.example/scales/1'), null, 'absolute external links are rejected');
equal(toTrustedMusicScaleUrl('//evil.example/scales/1'), null, 'scheme-relative external links are rejected');
equal(toTrustedMusicScaleUrl(undefined), null, 'missing deep links are ignored');

console.log(`✅ Passed ${passed} / ${total} tests.`);
