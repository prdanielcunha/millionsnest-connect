import { readFileSync } from 'node:fs';

const fields = ['schemaVersion', 'projectId', 'hubRepository', 'hubCommit', 'rulesSha256', 'proofRunId', 'privateStoreAssertions'];
const invalid = () => { throw new Error('ROUTING_REVIEW_MANIFEST_INVALID'); };

/** Git-reviewed evidence only. Never learn a trusted hash from live metadata or env. */
export function parseReviewedPrivacyProof(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).length !== fields.length || fields.some(key => !Object.hasOwn(value, key)) ||
      value.schemaVersion !== 1 || value.projectId !== 'millionsnest' ||
      value.hubRepository !== 'prdanielcunha/millionsnest' ||
      typeof value.hubCommit !== 'string' || !/^[a-f0-9]{40}$/.test(value.hubCommit) ||
      typeof value.rulesSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.rulesSha256) ||
      !Number.isSafeInteger(value.proofRunId) || value.proofRunId <= 0 ||
      !Number.isSafeInteger(value.privateStoreAssertions) || value.privateStoreAssertions < 445) invalid();
  return Object.freeze({ ...value });
}

export function readReviewedPrivacyProof() {
  try {
    const source = readFileSync(new URL('../config/connect-shared-privacy-proof.json', import.meta.url), 'utf8');
    if (Buffer.byteLength(source) > 2048) invalid();
    return parseReviewedPrivacyProof(JSON.parse(source));
  } catch { return invalid(); }
}
