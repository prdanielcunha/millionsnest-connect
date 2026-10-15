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
