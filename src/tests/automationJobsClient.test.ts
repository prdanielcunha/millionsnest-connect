import assert from 'node:assert/strict';
import { listInternalAutomationJobs } from '../core/client/liveAutomationJobsClient';
const session = { idToken: 'transient-token', expectedOrganizationId: 'org-a' } as any;
const valid = { id: 'a'.repeat(64), sourceApp: 'nestfinance', trigger: 'document.pending', conversationId: 'opaque', occurredAt: '2026-10-14T12:00:00Z', state: 'needs_review', attempts: 3, resultCode: 'human_review_required' };
const rows = await listInternalAutomationJobs(session, async (url, init) => {
  assert(String(url).endsWith('organizationId=org-a')); assert.equal((init?.headers as any).Authorization, 'Bearer transient-token'); assert.equal(init?.cache, 'no-store');
  return new Response(JSON.stringify({ jobs: [{ ...valid, bearer: 'should-never-be-returned' }] }));
});
assert.equal(rows?.[0].state, 'needs_review'); assert(!JSON.stringify(rows).includes('should-never-be-returned'));
for (const status of [403, 404]) assert.equal(await listInternalAutomationJobs(session, async () => new Response('{}', { status })), null);
await assert.rejects(() => listInternalAutomationJobs(session, async () => new Response('{}', { status: 503 })));
await assert.rejects(() => listInternalAutomationJobs(session, async () => new Response(JSON.stringify({ jobs: [{ ...valid, state: 'sent_successfully' }] }))));
console.log('Automation queue client: scoped bearer/no-store, unavailable gates, minimal projection and truthful allowed states passed.');
