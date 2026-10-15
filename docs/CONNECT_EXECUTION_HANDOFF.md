## Recovery hourly OIDC execution proof — source only, 2026-10-15

- The Cloud Run recovery job and one signed smoke are REAL: `connect-inbound-alert-recovery-v1-n2dr9`, production workflow `38799816305` SUCCESS with serving Core SHA `4ba5e6f8fec95937ccdc5d6d581c4d4ab2d78107`.
- Default-branch `main` contains a GitHub Actions hourly schedule but no successful `schedule`-event run was observed in the latest inspection. To establish the exact **GitHub OIDC -> protected Cloud Run Job** run path immediately, this small source change adds one scoped `push` trigger for workflow/script changes to the *same* guarded workflow. It does not grant new permissions or activate a push/Meta/paid service.
- A successful push-triggered run will prove OIDC and job invocation but **not** prove that GitHub's hourly cron actually fired. Cron is best effort; no guaranteed execution time.
- NEXT: PR CI -> merge main -> inspect workflow run and exact protected job execution result; keep Cloud Scheduler API disabled. Then proceed with official domain publishers and real #226 matrix. Push real remains disabled until locked iPhone proof.


---

# 2026-10-15 — ACTUAL HMAC RECOVERY JOB PROOF, NOT CRON PROOF

- Cloud Scheduler API dependency was rejected without enabling billable services by production workflow `38798802527` (`RECOVERY_BLOCKED_CLOUD_SCHEDULER_API_NOT_ENABLED`). No Cloud Scheduler job exists from that workflow.
- Fallback source PR [#288](https://github.com/prdanielcunha/millionsnest-connect/pull/288) merged main `8c652980b25fbe0f3c12b7840300794923389e3f`; source Quality `38799433409` and scheduler static `38799433384` PASSED.
- Fallback production [#289](https://github.com/prdanielcunha/millionsnest-connect/pull/289) merged production `8a4e260d91b43689996b1a3216700084e435bd37`. Production provisioning workflow [`38799816305`](https://github.com/prdanielcunha/millionsnest-connect/actions/runs/38799816305) PASSED. Logs explicitly show `RECOVERY_REAL_SERVING_SHA_OK` (actual serving Core `4ba5e6f8fec95937ccdc5d6d581c4d4ab2d78107`), `RECOVERY_QUEUE_ONLY_FLAGS_OK`, Cloud Run Job `connect-inbound-alert-recovery-v1` created, execution `connect-inbound-alert-recovery-v1-n2dr9` completed, and `RECOVERY_JOB_SIGNED_SMOKE_OK`. No physical push or Meta send was enabled.
- **Unverified**: automatic schedule execution of the new GitHub Actions workflow `connect-hourly-internal-recovery.yml` on default `main`. GitHub cron may delay/skip; never call it a strict-SLA production scheduler before proving a cron run.
- **Official upstream publishers absent**: current Connect signed event route accepts source-specific HMAC but requires canonical organization, an **existing Connect conversation**, and `recipientUid` verified as an Inbox operator. It is NOT a member-facing fanout contract. MusicScale's `services/server/scale/musicScaleCommandService.ts` already creates the canonical member notifications transactionally when publishing. Do NOT mirror those notices into duplicate Connect notifications. An official MusicScale event publisher/recipient or subscription mapping, separate source key, Hub-bound channel identity, opted-in audience and verified opt-out/window policy are needed before a member WhatsApp reminder can be enabled. NestFinance `document.pending` and NestJourney `followup.due` also require official source publishers and authorized operator+conversation scope; their existing guided consult/First Contact flows do not satisfy these triggers.
- **Other blockers**: physical closed/locked iPhone PWA push test absent; feature flag remains OFF. The complete #226 matrix including real 3-app WhatsApp traffic not yet proven. No generative AI provider authorized, deterministic agent settings are not generative AI. #222 unchanged.

NEXT EXACT: verify the first real scheduled GitHub worker run and its HMAC signed job log (or explicitly document failure/WIF blocker), then implement smallest verifiable official MusicScale publisher contract in the MusicScale app/Tool Gateway without touching its existing member notifications or creating Meta sends. Continue Finance/Journey once publisher and permissions are official. Never claim 100% based on CI or this handoff.

---

# 2026-10-15: PRODUCTION SCHEDULER BLOCKER AND COST-AVOIDING RETRY

Production scheduler release #287 merged at 19fc6338b22aaae47b22d3d4a087ca865b99fe6e; workflow 38798802527 FAILED at `RECOVERY_BLOCKED_CLOUD_SCHEDULER_API_NOT_ENABLED` after passing live SHA/queue-only probes. **No Cloud Scheduler service was created.** Inbound outbox Core remains serving prior image SHA 4ba5e6f8fec95937ccdc5d6d581c4d4ab2d78107 and no push, broad automations, or Meta templates were activated.

Current recovery fallback branch `chatgpt/connect-github-hourly-recovery-20261015` provisions the existing pinned signed Cloud Run Job without turning on Scheduler API, with proof of one real signed invocation; a new main-default-branch GitHub Actions cron executes that job best-effort hourly, without recurring IAM/config mutations. GitHub cron is not a guaranteed scheduler. Do not claim unattended recovery until actual provisioning and scheduled run both PASS. Persist every edit via PR; if permissions block Job provisioning, record the exact IAM error, don't create credentials or fake execution.

NEXT: source and production PR/CI, real Cloud Run Job + cron proof; official MusicScale event publisher; NestFinance/NestJourney; #226. #222 untouched. Physical iPhone locked-screen push gate still incomplete.

---

# VERIFIED AFTER RELEASE #285 — 2026-10-15

- Source PR #284 merged: `7bf5e49410c0cb9fc04d9835f3eeab566e6ee7d7`, CI `38796894277` and main CI `38797114147` SUCCESS.
- Production PR #285 merged: `4ba5e6f8fec95937ccdc5d6d581c4d4ab2d78107`, quality `38797289404` SUCCESS. Official production release `38797498963` SUCCESS, including exact Cloud Run readiness/revision and Firebase Hosting proof; Auth `38797498851` and SSO `38797498891` SUCCESS.
- Deployed source now contains atomic inbound alert outbox + HMAC-only bounded recovery, idempotency, tenanted canonical checks, legacy scan cursor and human review projection. **No periodic production scheduler proof yet**; no genuine locked-iPhone push proof, no domain publisher proofs.
- Latest work branch `chatgpt/connect-recovery-scheduler-20261015`: proposes production-only least-privilege Cloud Run Job + hourly Cloud Scheduler with an actual signed job smoke BEFORE schedule activation, existing secret mount/image, zero retries and no Meta/Hub/channel/billing mutation. If IAM or Cloud Scheduler API is unavailable, fail closed and report precise blocker. No production scheduler claimed until workflow success, job result and enabled Scheduler proof.
- NEXT: obtain exact source CI and production scheduler workflow proof; if unavailable document missing IAM/API. Then official MusicScale event publisher/Tool Gateway vertical. Continue protecting #222, Hub/RBAC, multi-tenant, Meta settings. General automations false, physical push false, Meta templates false. Do not declare #226 complete.

---

# IN-PROGRESS SOURCE CHECKPOINT — 2026-10-15

The preceding published-state handoff remains authoritative. A source-only follow-up on branch `chatgpt/connect-inbound-outbox-recovery-20261015` adds an atomic inbound outbox marker to the already-written provider index, bounded signed-worker recovery, CAS cursor for pre-upgrade message reconciliation and tests. Not yet merged/released: **do not count this source branch as deployed**. Web Push remains OFF; broad automations OFF; templates OFF.

NEXT: run exact-head Quality, correct regressions, review/merge only after green; verify the signed recovery endpoint against the real deployed SHA and provision/test a periodic authenticated invoker. Do not enable push or commercial dispatch. Follow with official MusicScale domain events only after recovery is real.

---

# Internal-only queue activation — separate verified gate, 2026-10-15

- Storage38781762933/job116583502681SUCCESS: actual approved Rules397 and all3existingTTLsACTIVE (routing/jobs/budgets). No Rules/IAM/TTL/data changes. Source280/release281MERGED; codecandidateedd080664ccffe9449b2028b2657c791bcae177d awaitingactualCore38781762898 proof. Both fullQuality38781407838/38781416410SUCCESS.
- This activation adds a dedicated CONNECT_INTERNAL_ALERT_QUEUE_ENABLED flag. Broad CONNECT_AUTOMATION_EXECUTION_ENABLED remainsFALSE; pushFALSE/testmodeTRUE and Meta templatesunchangedOFF. Existing legacy flag remainsbackwardcompatible. HTTPtest provesactualsignedMeta->durablejob->needs_review usingONLYnewinternalflag withbroadflagfalse. Signing/key/storage/tenanttestsPASS. Actualmetadata proof is rerun BEFORE every servingmutation, exactdeployedrevision flagschecked, jobsGET401/workerPOST401 smoke added. No customerdata orsend inreleaseprobe. Productionvalidatesautomationtests beforedeploy. Runtime/Hostingrollbackpreserved.
- NEXT EXACT: full exactheadCI for activationPRs; confirmpriorcodeedd080...actuallypublished with BOTHHosting/direct/canonicalSHA beforeproductionactivationmerge. Then officialactivationrelease mustprove exactSHA/flags, storageTTLprivacy, queueauthority401s andPRODUCTION_RELEASE_OK. Internalqueueonly is ready forrealinboundalerts aftersuccess; actualcustomertraffic/physicaldevice/domainmemberpublishers/scheduler remainNOTvalidated. No100%claim. FullCoreHTTP/baseimplementationevidencebelow.

# Saved internal alert queue increment — 2026-10-15

- Source280 51f8a9cad74e906473fd70856c0aaace0c0f67b2, branchchatgpt/connect-internal-alert-queue-20261015; production281 dafc5820c18d842b4f98e31d7a86aad6d22a7225, branchchatgpt/connect-internal-alert-queue-release-20261015. Bothreal-codePRsSAVED (10files). FullCoreHTTP102composition/108template +newactualHTTPqueue tests/lint/web+CorebuildsPASS. New exact-head CIrunning. LastactuallyverifiedservingConnectd1e8f780/Hub e8aaae0f unchanged.
- NEXT EXACT: finish280/281CI; reviewminimalruntimeexecutor diff then mergeexacttestedheads. PublishwithautomationOFF, verifyofficialbackend+bothHostingSHA, inspectnew READ-ONLY InternalAutomationStorageProof actualRules397+ACTIVEjobs/budgetsTTL. OnlyifproofPASS, makeSECONDgatedactivation ofinternalqueue preservingpushOFF/testmodeON/templatesOFF; physicaldeliveryandmemberfacingdomainpublisherstillpending. Do notblindlyactivatefrommocktests.

# Current increment — independent internal alert queue, 2026-10-15

- Last verified live Connectd1e8f7802c201d46c4746ad0f1301fa30e81b5f4, Hube8aaae0f6376597078f4a42878f1a00a58c664db. Existing routing, agent editor and Finance reads preserved. PushOFF/testmodeON, templatesOFF, automationOFF until separate actual storage proof and gated activation.
- Implemented queue mounting/real signed Meta post-ingest independently of push; no-push actionable alerts become needs_review, resolved/superseded alerts suppressed. Executor verifies canonical message/thread scopes and operator membership, refuses shared source/worker keys. No Meta/domain writes or physical delivery claims. Actual HTTP signed webhook -> real ingestor/Firestore job adapter/worker tested with synthetic external storage: duplicate -> one job/attempt; failed queue retains durable message and200ACK; unauthorized and foreign-tenant queue reads denied. All new execution/metadata tests, lint and web/Core buildsPASS. FullCoreHTTP running; exact-head CI required before merge.
- New production-only READ-ONLY metadata proof checks actual approved Rules397 hash and existing ACTIVE TTL for connectAutomationJobs/connectAutomationBudgets, reusing routing proof. No IAM/Rules/TTL/data mutations. Test covers hash drift, each inactiveTTL and upstream denial. Published private259 proof already includes both root groups. Probe must actually succeed before queue activation; do not equate code with enabled runtime.
- Working branch chatgpt/connect-internal-alert-queue-20261015; source/release PRs created with this functional increment. NEXT EXACT: finish CI and publish code with current automationOFF, inspect official exactSHA/Hosting and independent storage proof. If proofSUCCESS, make a second small gated release enabling only internal queue with existing secretbundle worker key; retain pushOFF/templatesOFF, no app publisher keys invented. Verify queueGET401/worker401 and internal mount on exact serving revision. Periodic recovery and official domain member publishers stillpending.

# Connect execution handoff — verified checkpoint 2026-10-15 17:36 UTC

## Actual serving releases

- Connect production **d1e8f7802c201d46c4746ad0f1301fa30e81b5f4**, main **0d32dfa8f95f6ab98aff1b6337c6fcd1f912a336**. Official Core release38775851743/job116563160857 SUCCESS: exact direct/canonical SHA, BOTH Hosting artifacts matched trusted local build, reader rollback guard, editor authority and PRODUCTION_RELEASE_OK. Full source/release Quality38775595033/38775627429 SUCCESS.
- Hub production **e8aaae0f6376597078f4a42878f1a00a58c664db**, main **816753796d0d139059e1ad180fdb019e86ac3127**. Official CloudRun38778216550/job116571284145 SUCCESS: exact imageSHA and100% traffic on **millionsnest-api-r38778216550**, Hosting deployed, canonical Journey401, production catalog smoke9plans, paid MusicScale aggregate integrityUNCHANGED. Production QA38778216311, NestAI38778216441 and infra38778216145 allSUCCESS.
- Previous verified Connect agent editor release98ce9082f659a4381d53113c1f91d732ef5c21d2 (Core38765336503) is superseded. Reader64979f40c0b4554d4fe73dbd3b3952af99f0062d (Core38764473374) remains a settings-safe rollback target.
- Finance last independently verified **e389130538946f65fbd47bdcdbfb5e182274ce3f**, official38704569016/job116320659099. Guided entity selection and bounded pending-document counts were already published; do not reimplement or relabel Connect tokens as Finance tokens.
- Actual published Hub Rules SHA256 **397b3208917fdae9a68fd768d40edd127a4cbb397e3c30fa0420baec8420c182**. Actual-source byte proof38760546756; independent published-source private gate38764226998/job116523122327 passed259 assertions. Candidate3e0f5bf117932d06be810458d557e52b8cdd17739f2b24d38ab1393d1c72b20f exists in Git but wasNOTpublished (compiler503). No Rules edits this increment. Never remove/loosen the Connect fingerprint or repeat speculative compiler audits.

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

## Active flags and honest limitations

- RoutingON; Finance guided readsON; agent reader/private/editorON.
- Web PushOFF, testmodeON. Business automationOFF. No new Meta template activation or commercial sends. Existing Meta number/WABA/PhoneID/webhooks/credentials/billing unchanged; #222 untouched.
- Physical installed/closed/locked iPhone delivery is mandatory before push activation (Connect AGENTS). Synthetic CI or a provider accept cannot prove physical delivery.
- Positive real-account manager/Journey/Meta/domain acceptance isNOTproved. Service tests use synthetic authorized fixtures, not actual customer records.
- Actual app event publishers, member reminders/followups, unattended recovery/scheduler and three-app event automation remainUNFINISHED. Do not close223–226 or declare100%.
- No MusicScale source changes this increment. Its existing scale publication already creates canonical notifications; do not duplicate those writes.
- Last earlier MusicScale proofs f43a464bf8362472a1ec8ceece38ec57dc9493c9 frontend /848d9cf1a4cc38e5f6239703cbf0b83f3d9ff177 API; these wereNOTreverified here. NestJourney earlier6c6c6e321bfe61e03b9f561d4abc888ba5a65282 likewise historical only.

## Exact next action (continue implementation; no new audit)

1. Start from current GitHub main/production and read only the existing #225 paths:
   - Connect src/core/automations/eventJobs.ts, automationEventHttp.ts, automationCatalog.ts, src/server/createConnectServer.ts automation composition and docs/CONNECT_INTERNAL_AUTOMATION_CONTRACT.md.
   - Current worker is internal operator-alert-only, signed source events/HMAC, atomic100-job daily tenant quota, leases/retries/needs_review, bounded manager audit API; not member-facing app automation. Mounting currently depends on inboxPush and P0 hardware gates. Source keys/publishers and periodic recovery deployment are not verified.
   - MusicScale canonical publish entry: server.ts /api/v1/music-scales/:musicScaleId/publish -> MusicScaleCommandService.publishMusicScale. Existing domain notifications must be reused; do not change musical/business rules or send duplicate alerts.
2. Implement one complete official event -> permitted canonical action increment with fresh tenant/app authority, durable idempotency, audit/retry/human fallback and cost/consent gating. If domain API/publisher absent, ship the explicit safe Connect contract and state the missing endpoint precisely; never simulate an integration asready. Keep Meta sendsOFF without actual approved template/consent/tariff evidence.
3. Commit/push/real code PR BEFORE next increment. Run targeted tests while editing; complete existing CI at final gate, then verify actual published SHA. Preserve Hub/RBAC/Tool Gateway/tenancy/data/subscriptions.
4. Existing runtime rollback for Hub: previous captured revisionmillionsnest-api-cg38654350176, only restore if actual release failure requires it; do not use old revisions to reset branches. Connect must not roll back to pre-settings-reader or pre-private-Rules after settings exist; pause routing if such recovery is required.
5. This handoff branch **chatgpt/connect-support-release-handoff-20261014** is the canonical newest checkpoint. This compact file supersedes the long historical logs retained in Git history.

## Workspace recovery

Current scratch clones: /workspace/scratch/82cd49e39f00/connect, /workspace/scratch/82cd49e39f00/hub, /workspace/scratch/82cd49e39f00/musicscale (read-only). Scratch can be pruned; recover from GitHub, not stale dirty files. All authored source/workflow code above is saved remotely. Local node_modules/dist/dist-core are generated and must not be uploaded. Attachments in project_sources were consulted; do not repeat blueprint research.
