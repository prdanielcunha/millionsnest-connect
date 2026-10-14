import assert from 'node:assert/strict';
import { invokeAutomationRecovery } from '../core/automations/recoveryInvoker';
import { verifyAutomationSignature } from '../core/automations/eventJobs';
const secret = 'synthetic-recovery-secret-with-32-characters', now = 1791979200000;
let requests = 0;
const transport: typeof fetch = async (url, init) => {
  requests++;
  assert.equal(String(url), 'https://connect.millionsnest.com/api/core/automations/worker');
  assert.equal(init.redirect, 'error');
  const headers = init.headers as Record<string, string>;
  assert(verifyAutomationSignature(Buffer.from(String(init.body)), 'worker', headers['x-connect-timestamp'], headers['x-connect-signature'], secret, now));
  assert.equal(String(init.body), '{"limit":10}');
  return new Response('{"processed":3,"private":"must-not-propagate"}', { status: 200 });
};
const options = { origin: 'https://connect.millionsnest.com', secret, now: () => now, fetchImpl: transport };
assert.deepEqual(await invokeAutomationRecovery(options), { processed: 3 });
for (const origin of ['http://connect.millionsnest.com', 'https://evil.run.app', 'https://connect.millionsnest.com.evil.test', 'https://connect.millionsnest.com/path', 'https://user@connect.millionsnest.com', 'https://connect.millionsnest.com?secret=x', 'https://127.0.0.1']) {
  await assert.rejects(invokeAutomationRecovery({ ...options, origin }));
}
await assert.rejects(invokeAutomationRecovery({ ...options, secret: 'short' }));
await assert.rejects(invokeAutomationRecovery({ ...options, limit: 11 }));
assert.equal(requests, 1);
for (const status of [301, 401, 403, 404, 500, 503]) {
  let calls = 0;
  await assert.rejects(invokeAutomationRecovery({ ...options, fetchImpl: async () => { calls++; return new Response('{"secret":"private"}', { status }); } }), error => error instanceof Error && !error.message.includes('private'));
  assert.equal(calls, 1);
}
await assert.rejects(invokeAutomationRecovery({ ...options, fetchImpl: async () => { throw new Error('secret private transport'); } }), /RECOVERY_TRANSPORT_UNCERTAIN/);
for (const body of ['not-json', '{"processed":11}', '{"processed":-1}', '{}', 'null']) {
  await assert.rejects(invokeAutomationRecovery({ ...options, fetchImpl: async () => new Response(body) }));
}
console.log('automation recovery invoker: signature, scope, bounded response, no retry/secret leakage passed');
