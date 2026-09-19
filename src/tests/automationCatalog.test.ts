import {
  CONNECT_AUTOMATION_CATALOG,
  automationBlockers,
} from '../core/automations/automationCatalog';

let total = 0;
let passed = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  passed++;
}

console.log('--- Running Connect Automation Catalog Tests ---');

{
  equal(CONNECT_AUTOMATION_CATALOG.length >= 6, true, 'catalog contains MusicScale and future cross-app contracts');
  equal(
    CONNECT_AUTOMATION_CATALOG.every((item) => item.auditRequired === true),
    true,
    'every automation contract requires audit',
  );
  equal(
    CONNECT_AUTOMATION_CATALOG.every((item) => Boolean(item.idempotency)),
    true,
    'every automation contract declares idempotency',
  );
}

{
  const whatsapp = CONNECT_AUTOMATION_CATALOG.find((item) => item.targetChannel === 'whatsapp')!;
  const blockers = automationBlockers(whatsapp, [
    { id: 'inapp', status: 'active', receiveReady: true, sendReady: true },
    { id: 'whatsapp', status: 'blocked', receiveReady: false, sendReady: false },
  ]);
  equal(blockers.includes('whatsapp_dispatch_not_ready'), true, 'WhatsApp automation stays blocked before provider dispatch');
  equal(blockers.includes('event_source_not_mounted'), true, 'event source gate remains explicit');
  equal(blockers.includes('execution_worker_not_mounted'), true, 'worker gate remains explicit');
}

{
  const inapp = CONNECT_AUTOMATION_CATALOG.find((item) => item.targetChannel === 'inapp' && item.sourceApp === 'musicscale')!;
  const blockers = automationBlockers(inapp, [
    { id: 'inapp', status: 'active', receiveReady: true, sendReady: true },
  ]);
  equal(blockers.includes('inapp_channel_not_ready'), false, 'healthy in-app channel removes only its own blocker');
  equal(blockers.length >= 2, true, 'automation still cannot execute before source and worker are mounted');
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
