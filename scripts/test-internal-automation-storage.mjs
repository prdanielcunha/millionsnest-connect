import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyInternalAutomationStorage } from './verify-internal-automation-storage.mjs';
const fixture = 'synthetic approved private rules';
const approvedHash = createHash('sha256').update(fixture).digest('hex');
for (const blocked of ['', 'connectAutomationJobs', 'connectAutomationBudgets', 'connectProductRoutes', 'rules-changed', 'provider-failed']) {
  const reads = [];
  const verify = () => verifyInternalAutomationStorage({ token: 'synthetic-token', approvedHash, fetchImpl: async (url, init) => {
    reads.push(url); assert.equal(init.redirect, 'error'); assert.equal(init.method, undefined, 'GET-only metadata proof');
    if (blocked === 'provider-failed') return new Response('{}', { status: 403 });
    if (url.includes('/releases/')) return Response.json({ rulesetName: 'projects/millionsnest/rulesets/fixture' });
    if (url.includes('/rulesets/')) return Response.json({ source: { files: [{ content: blocked === 'rules-changed' ? 'unexpected' : fixture }] } });
    return Response.json({ ttlConfig: { state: blocked && url.includes('/' + blocked + '/') ? 'CREATING' : 'ACTIVE' } });
  } });
  if (blocked) await assert.rejects(verify); else { assert.equal(await verify(), true); assert.equal(reads.length, 5); }
}
console.log('Internal automation metadata proof: exact Rules pin, all existing TTL active, GET-only/no redirects, upstream failure denied');
