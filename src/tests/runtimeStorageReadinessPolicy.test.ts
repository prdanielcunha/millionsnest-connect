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
assert.match(
  workflow,
  /--impersonate-service-account="\$RUNTIME_SA"/,
  'readiness check may impersonate only the dedicated runtime identity',
);
assert.match(
  workflow,
  /:testIamPermissions/,
  'effective Firestore permissions must be probed without mutating data',
);
assert.match(
  workflow,
  /datastore\.entities\.get/,
  'read permission must be checked explicitly',
);
assert.match(
  workflow,
  /datastore\.entities\.create/,
  'create permission must be checked explicitly',
);
assert.match(
  workflow,
  /datastore\.entities\.update/,
  'update permission must be checked explicitly',
);
assert.match(
  workflow,
  /unset RUNTIME_TOKEN/,
  'runtime impersonation token must be discarded immediately after the probe',
);
assert.match(
  workflow,
  /CONNECT_RUNTIME_FIRESTORE_EFFECTIVE_STATE=/,
  'workflow must emit effective Firestore permission state',
);
assert.doesNotMatch(
  workflow,
  /echo\s+"?\$RUNTIME_TOKEN/,
  'runtime token must never be printed',
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
