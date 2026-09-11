import fs from 'node:fs';
import assert from 'node:assert/strict';

const release = fs.readFileSync('.github/workflows/connect-core-production-release.yml', 'utf8');
const hosting = fs.readFileSync('.github/workflows/firebase-hosting-deploy.yml', 'utf8');

assert.match(release, /on:\s*\n\s*workflow_dispatch:/, 'Core production release must be manual-only');
assert.doesNotMatch(release, /\n\s*push:/, 'Core production release must not auto-deploy on push');
assert.doesNotMatch(release, /\n\s*pull_request:/, 'Core production release must not deploy from PR events');
assert.match(
  release,
  /if:\s*github\.ref == 'refs\/heads\/production'/,
  'Core production release must refuse non-production refs',
);
assert.match(release, /live_mode:/, 'Live UI activation must be an explicit workflow input');
assert.match(
  release,
  /live_activation_ack:/,
  'Live UI activation must have a separate human acknowledgement input',
);
assert.match(
  release,
  /CONNECT_LIVE_READY/,
  'Live UI activation must require the canonical acknowledgement phrase',
);
assert.match(
  release,
  /if: inputs\.live_mode == true/,
  'Live dependency probes must run only when live mode is explicitly requested',
);
assert.match(
  release,
  /https:\/\/www\.millionsnest\.com\/api\/ecosystem\/connect\/session-context/,
  'Live activation must prove the Hub session-context route exists in production',
);
assert.match(
  release,
  /https:\/\/musicscale\.millionsnest\.com\/api\/v1\/connect\/next-schedule/,
  'Live activation must prove the MusicScale read route exists in production',
);
assert.match(
  release,
  /VITE_CONNECT_LIVE_ENABLED: \$\{\{ inputs\.live_mode \}\}/,
  'The live UI flag must come only from the manual release input',
);
assert.match(release, /SERVICE:\s*connect-api/, 'Canonical Cloud Run service must remain connect-api');
assert.match(release, /REPOSITORY:\s*millionsnest-web/, 'Canonical Artifact Registry repository must remain millionsnest-web');
assert.match(release, /--min-instances 0/, 'Core must preserve scale-to-zero policy');
assert.match(release, /--allow-unauthenticated/, 'Firebase Hosting must be able to invoke the HTTP service');
assert.match(release, /MILLIONSNEST_HUB_ORIGIN=https:\/\/www\.millionsnest\.com/);
assert.match(release, /MUSICSCALE_ORIGIN=https:\/\/musicscale\.millionsnest\.com/);
assert.match(release, /CONNECT_PRODUCTION_RELEASE_OK/, 'Release must end with a production smoke gate');
assert.match(
  release,
  /test "\$MESSAGE_STATUS" = "401"/,
  'Release smoke must prove unauthenticated Core message access is denied',
);
assert.match(
  release,
  /test "\$SESSION_STATUS" = "401"/,
  'Release smoke must prove unauthenticated Core session access is denied',
);

assert.match(hosting, /on:\s*\n\s*workflow_dispatch:/, 'Hosting deploy must be manual-only');
assert.doesNotMatch(hosting, /\n\s*push:/, 'Hosting deploy must not auto-deploy on production push');
assert.match(
  hosting,
  /if:\s*github\.ref == 'refs\/heads\/production'/,
  'Hosting deploy must refuse non-production refs',
);
assert.match(
  hosting,
  /gcloud run services describe connect-api/,
  'Hosting deploy must fail closed until connect-api exists',
);
assert.match(hosting, /FIREBASE_HOSTING_SMOKE_OK=Connect\+Core/);

console.log('Connect production release policy: OK');
