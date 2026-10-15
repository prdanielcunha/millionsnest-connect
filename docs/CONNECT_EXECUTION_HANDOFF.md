# Connect execution handoff — verified 2026-10-15 18:07 UTC

## Current published state (supersedes earlier checkpoints)

- **Connect ACTUALLY SERVING70debe5a8f2c9ba8441f799ae86d8e2f1349ed8d**, branchproduction. Main4c365ceeef7a9e21de1db722328946376c99c3a9.
- Official Core release38782472883/job116585934787SUCCESS: actual published Rules/TTL proof, exact direct/canonical Core SHA, BOTH Hosting assets matched trusted local build, CONNECT_INTERNAL_AUTOMATION_QUEUE_AUTHORITY_OK (actual jobsGET401/workerPOST401), runtime Firestore permission probe read_write_confirmed, PRODUCTION_RELEASE_OK. Auth38782472695 and SSO38782473616SUCCESS. Exact deployed flags checked before routing100%.
- **INTERNAL ALERT QUEUE ON** through dedicated CONNECT_INTERNAL_ALERT_QUEUE_ENABLED=true. Broad CONNECT_AUTOMATION_EXECUTION_ENABLED=false; physical Web PushOFF/testmodeON; Meta templatesOFF. Product routing, agent reader/private/editor and guided Finance readsON.
- **Hub ACTUALLY SERVINGe8aaae0f6376597078f4a42878f1a00a58c664db**, main816753796d0d139059e1ad180fdb019e86ac3127. Official38778216550/job116571284145SUCCESS: exact image/100% traffic onmillionsnest-api-r38778216550, Hosting/canonicalJourney401, production catalog smoke and paidMusicScale aggregate integrityUNCHANGED.
- Actual Rules SHA256397b3208917fdae9a68fd768d40edd127a4cbb397e3c30fa0420baec8420c182. Published-source privacy38764226998/job116523122327 passed259assertions INCLUDINGroot connectAutomationJobs/connectAutomationBudgets. Separate read-only metadata38781762933/job116583502681SUCCESS and final release rerun both verified actual approved hash + existingACTIVE routing/jobs/budgetsTTL. No Rules/IAM/TTL configuration or customer data mutations in the storage probe. Candidate3e0Rules inHubGit remainsNOTpublished; do not repeat speculative compiler audits or weaken fingerprint.

## Latest completed functional increment (#225)

1. **Independent durable internal review**, source280/release281MERGED:
   - Source51f8a9cad74e906473fd70856c0aaace0c0f67b2, branchchatgpt/connect-internal-alert-queue-20261015.
   - Releasedafc5820c18d842b4f98e31d7a86aad6d22a7225, branchchatgpt/connect-internal-alert-queue-release-20261015.
   - Complete Quality38781407838/38781416410SUCCESS. Foundation was actually publishededd080664ccffe9449b2028b2657c791bcae177d via38781762898/job116583503643 before activation; now superseded by70de...
   - Real signed Meta post-ingest can enqueue/evaluate jobs without push. Canonical scoped message/thread verified; resolved/waiting-for-person/superseded messages suppressed. Actionable alerts without push become needs_review; no claim of device delivery. App source keys must differ from each other/worker key. No domain data read or Meta dispatch.
2. **Narrow queue activation**, source282/release283MERGED:
   - Sourcedc1423aa3fa7dd5822a07f0d18eab0cf90aded69, branchchatgpt/connect-internal-queue-activation-20261015.
   - Release908a399fffe415cf42dab553d095ffbeee37794e, branchchatgpt/connect-internal-queue-activation-release-20261015.
   - Exact Quality38782179285/38782190356 + upstream38782179201/38782190546ALLSUCCESS.
   - Dedicated internal flag avoids enabling broad automation; the existing policy requiring general automationOFF is preserved. Legacy flag compatibility retained. Final release rechecks actual storage before serving mutation and jobs/worker authorization after publication. Runtime/Hosting rollback preserved.
3. **Tests actually executed**:
   - Full automation worker suite; local complete CoreHTTP inclcomposition102/102 and template108 checks; TypeScript/lint, web/Core builds; release/Hosting policy, YAML/bash syntax and diff checksPASS. Exact-head full CI and actual production releasePASS.
   - Actual HTTP composition uses a signed SYNTHETIC Meta request -> real ingestor -> Firestore job adapter -> worker -> authorized queue read, with external Firestore/identity simulated. Duplicatewebhooks => one job/one attempt; no push createsneeds_review; foreign tenant read403; invalidsignature401; queue outage preserves alreadydurable Inbox message and200ACK. No actual customer/Meta/device test is claimed.
   - Metadata regression tests reject changedRules, inactiveTTL ineachgroup and providerfailures; GET-only and redirectsdenied.

## Paths/contracts and next exact implementation

- Work from current main/production. Current scratch worktreeconnect-internal-alert-queue is based on an older localHEAD; ALLauthoredfiles are SAVED above. Recover fromGitHub ifpruned; do not upload old dirty/generated files blindly.
- Entry: src/server/createConnectServer.ts (independent queue mount and signed Meta afterIngest); src/core/automations/internalAlertExecutor.ts (canonical source/push-optional execution); eventJobs.ts (existing durable leases/quota/idempotency), automationEventHttp.ts (HMAC worker/app ingress and Hub-scoped queue read).
- Tests: src/tests/internalAlertQueue.test.ts includes actualHTTP regression; scripts/test-internal-automation-storage.mjs; existingautomation suites. Proof: scripts/verify-internal-automation-storage.mjs and production-only connect-internal-automation-storage.yml. Contract: docs/CONNECT_INTERNAL_AUTOMATION_CONTRACT.md.
- Queue audit: GET/api/core/automations/jobs?organizationId=... requires fresh Hub Inbox management; bounded50 and excludes message bodies, phones, raw recipientUID/lease/credentials. Existing Automations UI shows internal queue. complete means policy evaluated, never physicaldelivery.
- Canonical inbound messages remain durable if enqueue/quota/storage fails. **Known gap:** failed post-ingest enqueue is ACKed after Inbox durability and logs CONNECT_AUTOMATION_POST_INGEST_FAILED; there is not yet a durable outbox/catch-up that reconstructs missed jobs. Do not claim guaranteed alert execution through storage outages. Existing worker retries only ALREADY ENQUEUED jobs (3attempts, leases/backoff, ambiguouspush ->review),100newjobs/org/UTCday.
- **NEXT EXACT:** complete authorized recovery/catch-up for alreadydurable inbound messages and periodic worker invocation, without duplicating alerts or accepting arbitrary scopes. Existing recovery.cjs/HMAC worker invoker reuses validated mountedsecret; no deployed scheduler has been verified. Address queue recovery before broadening to domain event fan-out. Do not reread allBluePrints or re-auditRules.
- Then implement ONE official domain eventpublisher -> permitted canonical action increment (#225). Existing signed app ingress targets authorized Inboxoperators/existingconversations, NOT musicians/members. MusicScale canonical publish entry: server.ts /api/v1/music-scales/:musicScaleId/publish -> MusicScaleCommandService.publishMusicScale. Its existing notifications must be reused, never duplicate domain rules/writes. No MusicScale source changed here. If upstream API absent, implement the safe explicit contract and document exact missing API, never simulate ready.
- Commit/push/real codePR BEFOREnextincrement; targeted checks whileediting, full CI at final gate, then confirm ACTUAL publishedSHA.

## Still NOT complete / preserve

- Actual domain member publishers/reminders/followups, unattended recovery/catch-up/scheduler, positive real-account manager/Meta/domain acceptance and installed/closed/locked physical iPhone push proof remainUNFINISHED. No100%claim or closing223–226.
- Physical delivery MUST be proved before push activation perAGENTS. Queue activation is internal-only and does not waive P0. Appkeys absent remain unconfigured; no credentials/identities/grants invented.
- No automaticcommercialsend or Meta number/WABA/PhoneID/webhook/credential/billing configuration change. #222 untouched. Preserve Hub/RBAC/tenancy/Gateway/data/subscriptions.
- Last independently verified Financee389130538946f65fbd47bdcdbfb5e182274ce3f (38704569016). Do not reimplement guided entity/pendingcount flow or relabel Connect-boundtokens.
- Settings-safe Connect readerrollback64979f40c0b4554d4fe73dbd3b3952af99f0062d; do not roll back to pre-reader/pre-privateRules once settings exist (pause routing if such recovery necessary). Latest release rollback also captures exact previousruntime/Hosting automatically; jobs/data are notdeleted by rollback.
- This branchchatgpt/connect-support-release-handoff-20261014 is the newest compact checkpoint. Old long logs remain inGit history, not currentstate.

## Prior completed integration evidence (historical)

## Completed code and saved branches

1. Tenant agent configuration (prior274/276/277/278 merged): enable/disable, verified operator owner, deterministic communication style, explicitly public PT/EN/ES knowledge. Fresh Hub management authority, tenant/product HMAC provenance, CAS revisions, replay/collision protection and bounded audit. Router honors disabled settings and fails safely to humans. This is curated support, not completed generative AI/business automation.
2. Connect consent protection:
   - Source273 MERGED, **ed96f638ce9af162563d85950eda5fe7434f2146**, branch **chatgpt/journey-hub-consent-proof-20261015**.
   - Production279 MERGED, **3cfecf46a6101104c1703f261b6aeb352ae296da**, branch **chatgpt/connect-journey-consent-release-20261015**.
   - Require Hub consentContract=whatsapp_explicit_v1 initially and again AFTER durable reservation immediately before Meta. Missing/revoked proof, changed tenant/task/phone, malformed/unavailable upstream block send. Both bearer fetches reject redirects. Failed reservations cannot be resent automatically.
   -108 targeted assertionsPASS; fullCoreHTTP (composition102/102), lint, web/Core buildsPASS. Existing273 failure was a stale hubCalls count after adding legacy-proof test; corrected and expanded regressions.
3. Canonical Hub consent:
   - Source359 MERGED, **cd9336bcf3177ddb8b4827f75f0c94e0ac744f37**, branch **chatgpt/hub-journey-consent-forwardport-20261015**.
   - Release378 MERGED, **8f923dbdb6f5579f5f6a642a4d0aa9adcf76ea20**, branch **chatgpt/hub-journey-consent-release-20261015**.
   - Actual church owner or active canonical membership/care authority required, never global/app-role fallback for role-less members. Assigned caregiver, congregation, source records, explicit WhatsApp preference, consent/not revoked/not closed checked before issuing proof. No production data writes.
   - All4 exact source gatesPASS; release fullQA38776607359 inclJava21 security emulator/contact/handoff/infra allPASS.
   - Old358 CLOSED as superseded after all intended checks were preserved in359. Connect268 remains open; its functional code already exists on current main. Do not blindly merge its stale branch.
4. Actual Hub traffic publication fix:
   - Source379 MERGED, **69bac569a4045381bdde570989db615ddafd69c4**, branch **chatgpt/hub-exact-consent-traffic-20261015**.
   - Release380 MERGED, **a83679e9313aab58602501c110445a552a358f78**, branch **chatgpt/hub-exact-consent-traffic-release-20261015**.
   - Previous official38777162757/job116567684712 created a revision but retained100% pinned traffic onmillionsnest-api-cg38654350176. Exact guard correctlyFAILED and automaticrollbackSUCCEEDED; ae108fdf wasNOTclaimedserving.
   - Deploy run-specific revision with no traffic, wait exactReady, explicitly route100%; require exact run-specific revision/image, capture prior servingrevision, restore prior traffic on release failure. Existing env/secrets/Hosting/IAM/billing behavior preserved.6actual guard fixture cases, Hosting policy, YAML/bash and diff checksPASS.
   - Source2gates38777679849/38777679861PASS; release fullQA38777691125/job116569491259+infra38777691243PASS. Actual deployment nowSUCCESS above.


