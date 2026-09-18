import fs from 'node:fs';
import assert from 'node:assert/strict';

const workflow = fs.readFileSync('.github/workflows/firebase-gcp-auth-check.yml', 'utf8');

assert.match(
  workflow,
  /mn-connect-runtime@millionsnest\.iam\.gserviceaccount\.com/,
  'readiness check must inspect the dedicated Connect runtime identity',
);
assert.match(
  workflow,
  /gcloud firestore databases describe/,
  'readiness check must verify the canonical Firestore database read-only',
);
assert.match(
  workflow,
  /gcloud projects get-iam-policy/,
  'readiness check must inspect effective project IAM bindings read-only',
);
assert.match(
  workflow,
  /roles\/datastore\.user/,
  'least-privilege Firestore candidate must be identified explicitly',
);
assert.match(
  workflow,
  /CONNECT_RUNTIME_FIRESTORE_ROLE_STATE=/,
  'workflow must emit a machine-readable readiness state',
);
assert.match(
  workflow,
  /CONNECT_RUNTIME_STORAGE_READINESS_READ_ONLY_OK/,
  'readiness discovery must end with an explicit read-only marker',
);

for (const forbidden of [
  'add-iam-policy-binding',
  'set-iam-policy',
  'remove-iam-policy-binding',
  'gcloud firestore documents create',
  'gcloud firestore documents delete',
  'firebase deploy',
]) {
  assert.equal(
    workflow.includes(forbidden),
    false,
    `readiness workflow must not mutate infrastructure: ${forbidden}`,
  );
}

console.log('Connect runtime storage readiness policy: OK');
