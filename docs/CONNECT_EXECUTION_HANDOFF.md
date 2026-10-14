# Connect execution handoff — 2026-10-14

- Baseline main/production: `4249544cb1ef61db6e8b2757c1c7d17512e7b253` (confirmed remote).
- Work branch: `chatgpt/connect-p0-web-push-20261014`; latest valid increment is this document's Git commit (resolve with `git log -1 -- docs/CONNECT_EXECUTION_HANDOFF.md`).
- Related: #223 (in progress), #224/#225/#226 (not implemented by this increment). #222 unchanged.
- Preserved open PRs: #216 (`802aa0299d5fac5aabf1046e6c1280a049dc3f99`, NestJourney/Hub consent dependency); #221 (`33733b3ed1ce77d39d92d0a98434b650f23769d9`, production safety smoke/MusicScale 401 dependency).
- Implemented P0 backend: explicit Hub-authorized device register/list/revoke; Connect-owned Firestore sensitive subscriptions + delivery reservations; VAPID Web Push transport; recipient membership revalidation, assignment filtering, quiet hours, 30-day registration expiry, endpoint allowlist, bounded fanout, 404/410 cleanup, generic private payload; post-persistence webhook dispatch after Assist; worker opens authorized Inbox deep link. Both flags default off.
- Tests: `node --import tsx src/tests/webPush.test.ts` passed (SSRF/authority/isolation/20 concurrent duplicates/quiet hours/revoked operator/privacy/410 cleanup/storage failure). Core build passed. Remaining gates recorded in follow-up increment.
- Environment limitation: tsx CLI IPC socket fails EPERM; equivalent `node --import tsx` runner works. No escalation requested.
- Activation NOT performed. Require secret-managed VAPID public/private keys + subject, Firestore rules denying client access to `connectPushDevices`/`connectPushDeliveries`, runtime IAM, TTL on both collections `expiresAt`, staging deployment, and physical iPhone/Android/desktop tests. No Meta configuration changes.
- Flags: `CONNECT_WEB_PUSH_ENABLED=true`, `CONNECT_WEB_PUSH_TTL_CONFIRMED=true`; secrets/config: `CONNECT_WEB_PUSH_PUBLIC_KEY`, `CONNECT_WEB_PUSH_PRIVATE_KEY`, `CONNECT_WEB_PUSH_SUBJECT` (mailto/https VAPID contact).
- Delivery guarantee: reservation before network call avoids automatic repeat after an ambiguous outcome; reserved/failed records require human diagnosis. Provider acceptance is not proof of device delivery. Inbox remains durable on push errors. Quiet periods drop push alerts; Inbox pending state remains available.
- Next exact action: finish P0 browser controls, logout unsubscribe, deep-link authenticated tenant selection and targeted tests; persist as follow-up commit/PR. Then complete P0 release gates, safe retry/escalation/resume design and staging + physical validation before P1.
