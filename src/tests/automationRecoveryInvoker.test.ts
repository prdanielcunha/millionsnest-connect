import assert from 'node:assert/strict';
import { invokeAutomationRecovery } from '../core/automations/recoveryInvoker';
import { verifyAutomationSignature } from '../core/automations/eventJobs';
import { createECDH } from 'node:crypto';
import { invokeAutomationRecoveryFromEnvironment } from '../core/automations/recoveryEnvironment';
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
const ec = createECDH('prime256v1'); ec.generateKeys();
const mounted = {
  CONNECT_WEB_PUSH_PUBLIC_KEY: ec.getPublicKey().toString('base64url'),
  CONNECT_WEB_PUSH_PRIVATE_KEY: ec.getPrivateKey().toString('base64url'),
  CONNECT_WEB_PUSH_SUBJECT: 'https://connect.millionsnest.com',
  CONNECT_AUTOMATION_WORKER_SECRET: secret,
  CONNECT_SUPPORT_ORIGIN_SECRET: 'synthetic-separate-origin-secret-long-enough',
};
const env = { CONNECT_EXECUTION_SECRET_FILE: '/var/run/secrets/connect-execution.json', CONNECT_AUTOMATION_RECOVERY_ORIGIN: options.origin, CONNECT_AUTOMATION_EXECUTION_ENABLED: 'false' };
assert.deepEqual(await invokeAutomationRecoveryFromEnvironment(env, {
  load: path => { assert.equal(path, env.CONNECT_EXECUTION_SECRET_FILE); return JSON.stringify(mounted); },
  fetchImpl: transport, now: () => now,
}), { processed: 3 });
assert.equal(env.CONNECT_AUTOMATION_EXECUTION_ENABLED, 'false');
assert(!Object.hasOwn(env, 'CONNECT_AUTOMATION_WORKER_SECRET'));
await invokeAutomationRecoveryFromEnvironment({ ...env, CONNECT_AUTOMATION_WORKER_SECRET: secret }, {
  load: () => JSON.stringify({ ...mounted, CONNECT_AUTOMATION_WORKER_SECRET: 'different-mounted-secret-long-enough' }), fetchImpl: transport, now: () => now,
});
let unsafeRequests = 0;
for (const load of [() => '{bad-json', () => { throw new Error('PRIVATE mounted credentials'); }, () => JSON.stringify({ ...mounted, CONNECT_AUTOMATION_EXECUTION_ENABLED: 'true' })]) {
  await assert.rejects(invokeAutomationRecoveryFromEnvironment(env, { load, fetchImpl: async () => { unsafeRequests++; throw new Error(); } }), /CONNECT_EXECUTION_SECRET_BUNDLE_INVALID/);
}
assert.equal(unsafeRequests, 0);
console.log('Recovery mount: shared validation, explicit precedence, flags unchanged and zero requests on invalid/private mounts passed');
