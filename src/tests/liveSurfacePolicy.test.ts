import { getLiveNavigationRouteIds, isLiveRouteEnabled } from '../core/client/liveSurfacePolicy';

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
equal(getLiveNavigationRouteIds(true), ['overview', 'radar'], 'governance live users see only real Core and Radar surfaces');
ok(isLiveRouteEnabled('overview', true), 'overview is live');
ok(isLiveRouteEnabled('radar', true), 'Radar is live for governance users');
ok(!isLiveRouteEnabled('inbox', true), 'Inbox is not advertised as live before its backend is connected');
ok(!isLiveRouteEnabled('tools', true), 'Tool Gateway UI is not advertised as live before its backend surface is connected');
ok(!isLiveRouteEnabled('contacts', true), 'Contacts is not advertised as live before its backend is connected');

console.log(`✅ Passed ${passed} / ${total} tests.`);
