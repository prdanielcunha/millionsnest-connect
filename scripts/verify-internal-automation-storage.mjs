import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { verifyProductRoutingStorage } from './verify-product-routing-storage.mjs';

/** Read-only verification of already configured private storage and TTL.
 * Never creates a collection, changes Rules/IAM/TTL or reads customer records.
 */
export async function verifyInternalAutomationStorage({ token, fetchImpl = fetch, approvedHash }) {
  await verifyProductRoutingStorage({ token, fetchImpl, approvedHash });
  for (const collection of ['connectAutomationJobs', 'connectAutomationBudgets']) {
    const response = await fetchImpl(`https://firestore.googleapis.com/v1/projects/millionsnest/databases/(default)/collectionGroups/${collection}/fields/expiresAt`, {
      headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('AUTOMATION_STORAGE_METADATA_UNAVAILABLE');
    const field = await response.json();
    if (field.ttlConfig?.state !== 'ACTIVE') throw new Error('AUTOMATION_TTL_NOT_ACTIVE');
  }
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await verifyInternalAutomationStorage({ token: fs.readFileSync(0, 'utf8').trim() });
    console.log('CONNECT_INTERNAL_AUTOMATION_PUBLISHED_PRIVACY_AND_TTL_OK');
  } catch {
    console.error('CONNECT_INTERNAL_AUTOMATION_STORAGE_NOT_CONFIRMED');
    process.exitCode = 1;
  }
}
