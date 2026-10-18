import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyProductRoutingStorage } from './verify-product-routing-storage.mjs';
import { APPROVED_RULES_SHA256 } from './verify-product-routing-storage.mjs';
import { parseReviewedPrivacyProof, readReviewedPrivacyProof } from './reviewed-privacy-proof.mjs';

const reviewed = readReviewedPrivacyProof();
assert.equal(APPROVED_RULES_SHA256, reviewed.rulesSha256, 'release and internal automation share the same reviewed pin');
assert(Object.isFrozen(reviewed));
for (const change of [
  { schemaVersion: 2 }, { projectId: 'another-project' }, { hubRepository: 'another/repo' },
  { hubCommit: 'invalid' }, { rulesSha256: 'invalid' }, { rulesSha256: 123 },
  { proofRunId: 0 }, { proofRunId: 1.5 }, { proofRunId: '39091831513' },
  { privateStoreAssertions: 444 }, { privateStoreAssertions: Infinity }, { autoAcceptLiveHash: true },
]) assert.throws(() => parseReviewedPrivacyProof({ ...reviewed, ...change }), /REVIEW_MANIFEST_INVALID/);
for (const value of [null, [], 'invalid', {}, Object.create(reviewed), { ...reviewed, hubCommit: undefined }]) {
  assert.throws(() => parseReviewedPrivacyProof(value), /REVIEW_MANIFEST_INVALID/);
}

const source = 'synthetic-reviewed-private-rules';
const hash = createHash('sha256').update(source).digest('hex');
function fixture(change = {}) {
  const calls = [];
  return { calls, async fetchImpl(url, init) {
    calls.push(url);
    assert.equal(init.headers.Authorization, 'Bearer synthetic-read-only-token');
    assert.equal(init.redirect, 'error'); assert(init.signal);
    assert.equal(init.method, undefined, 'probe never mutates Rules, IAM, TTL or documents');
    if (change.unavailable) return new Response('synthetic-provider-body', { status: 403 });
    const body = url.endsWith('/releases/cloud.firestore') ? { rulesetName: change.ruleset ?? 'projects/millionsnest/rulesets/synthetic-rules' }
      : url.includes('/rulesets/') ? { source: { files: [{ content: change.source ?? source }] } }
      : { ttlConfig: { state: change.ttl ?? 'ACTIVE' } };
    return new Response(JSON.stringify(body));
  } };
}
const good = fixture();
assert.equal(await verifyProductRoutingStorage({ token: 'synthetic-read-only-token', fetchImpl: good.fetchImpl, approvedHash: hash }), true);
assert.equal(good.calls.length, 3);
assert(good.calls[2].endsWith('/collectionGroups/connectProductRoutes/fields/expiresAt'));
for (const [change, expected] of [
  [{ source: 'changed-review-needed' }, /PRIVACY_PROOF_CHANGED/], [{ ttl: 'CREATING' }, /TTL_NOT_ACTIVE/],
  [{ ruleset: 'https://foreign.invalid' }, /RULESET_REFERENCE_INVALID/], [{ ruleset: 'projects/another-project/rulesets/id' }, /RULESET_REFERENCE_INVALID/],
  [{ unavailable: true }, /PROBE_UNAVAILABLE/],
]) await assert.rejects(() => verifyProductRoutingStorage({ token: 'synthetic-read-only-token', fetchImpl: fixture(change).fetchImpl, approvedHash: hash }), expected);
for (const token of ['', 'line\nbreak', 'x'.repeat(16385)]) await assert.rejects(() => verifyProductRoutingStorage({ token, fetchImpl: fixture().fetchImpl, approvedHash: hash }), /INPUT_INVALID/);
await assert.rejects(() => verifyProductRoutingStorage({ token: 'synthetic-read-only-token', projectId: 'another-project', fetchImpl: fixture().fetchImpl, approvedHash: hash }), /INPUT_INVALID/);
console.log('Product routing storage: read-only exact published privacy proof, active TTL, tamper/tenant/transport failure gates passed');
