import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// Published Rules tested by Hub run38576220130 with156 denied-browser-access checks.
export const APPROVED_RULES_SHA256 = '647ddd62c0a16dc9eaa32c11c8155b40ffe6d5190fb53e95c46381508d37e4d6';
export async function verifyProductRoutingStorage({ token, projectId = 'millionsnest', fetchImpl = fetch, approvedHash = APPROVED_RULES_SHA256 }) {
  if (typeof token !== 'string' || !token.trim() || token.length > 16384 || /[\r\n]/.test(token) || projectId !== 'millionsnest') throw new Error('ROUTING_STORAGE_PROBE_INPUT_INVALID');
  const read = async url => {
    const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('ROUTING_STORAGE_PROBE_UNAVAILABLE');
    return response.json();
  };
  const release = await read(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`);
  if (typeof release.rulesetName !== 'string' || !/^projects\/millionsnest\/rulesets\/[a-zA-Z0-9-]+$/.test(release.rulesetName)) throw new Error('ROUTING_RULESET_REFERENCE_INVALID');
  const rules = await read(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`);
  const files = rules.source?.files;
  if (!Array.isArray(files) || files.length !== 1 || typeof files[0].content !== 'string' || createHash('sha256').update(files[0].content).digest('hex') !== approvedHash) throw new Error('ROUTING_PUBLISHED_PRIVACY_PROOF_CHANGED');
  const field = await read(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups/connectProductRoutes/fields/expiresAt`);
  if (field.ttlConfig?.state !== 'ACTIVE') throw new Error('ROUTING_TTL_NOT_ACTIVE');
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await verifyProductRoutingStorage({ token: fs.readFileSync(0, 'utf8').trim(), projectId: process.env.PROJECT_ID });
    console.log('CONNECT_PRODUCT_ROUTING_PUBLISHED_PRIVACY_AND_TTL_OK');
  } catch (error) {
    // Never reveal provider bodies, credentials or unexpected exception messages.
    const safe = error instanceof Error && /^(ROUTING_(STORAGE_PROBE_INPUT_INVALID|STORAGE_PROBE_UNAVAILABLE|RULESET_REFERENCE_INVALID|PUBLISHED_PRIVACY_PROOF_CHANGED|TTL_NOT_ACTIVE))$/.test(error.message);
    console.error(safe ? error.message : 'ROUTING_STORAGE_PROBE_FAILED');
    process.exitCode = 1;
  }
}
