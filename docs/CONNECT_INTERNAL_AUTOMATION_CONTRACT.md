# Internal automation worker (#225) — incremental delivery

Default off. This worker executes **internal Connect operator alerts only**, never commercial messages, approved-template dispatch or private domain queries. Existing member-facing automation catalog entries remain blocked until their official publishers/tools/consent contracts are proved.

## Execution

- With the worker enabled, actual durable Meta Inbox ingestion enqueues an opaque message reference, then runs a bounded batch, independently of Web Push activation. Without physical push, actionable alerts become `needs_review` in the protected internal queue; they are never reported as delivered. Resolved, waiting-for-person or superseded messages are suppressed. Recovery reconstructs the event from canonical message storage; jobs do not duplicate phones, text or bearer credentials.
- Official-app event ingress: `POST /api/core/automations/events/:sourceApp`, raw JSON <=16kb. Sources: musicscale, nestfinance, nestjourney. Fields: schemaVersion=1, sourceApp, eventId, organizationId, conversationId, occurredAt (ISO), trigger and recipientUid. No other fields accepted.
- Triggers: MusicScale `scale.published`/`scale.presence_pending`; NestFinance `document.pending`; NestJourney `followup.due`. Each targets an existing authorized Connect conversation and canonical Inbox operator. This is NOT the app's musician/member notification contract.
- Worker: `POST /api/core/automations/worker`, raw JSON `{ "limit": 1..10 }`.
- Both POSTs require `x-connect-timestamp` (13-digit epoch milliseconds, within 5min) and `x-connect-signature` (hex HMAC-SHA256 of `source + "\n" + timestamp + "\n" + exact raw body`). Worker uses source=`worker` and a separate secret. App keys cannot authenticate the worker.
- Signers MUST derive organizations/recipients from their canonical authorized backend, never sign browser-selected arbitrary scopes. Publishers in the three app repos are not implemented by this increment.
- Recipient membership, thread scope/state, assignment, device ownership/expiry, preferences and quiet hours are checked at execution. No Tool Gateway reads are invented. A provider accept is not proof of physical delivery.
- Event idempotency: source + org + event ID. Job and daily quota are committed atomically. Default hard limit: 100 NEW internal jobs per organization/UTC day; repeats consume no new slot. Inbox messages remain durable when limit/storage fails; no paid fallback.
- Leases: 120s, optimistic concurrency; bounded three attempts with backoff. Push reservation prevents a second external call after ambiguity. Ambiguous/failed deliveries and exhausted attempts become `needs_review`, without automatic resend.
- Audit API: `GET /api/core/automations/jobs?organizationId=...`; fresh Hub-authorized Inbox management, tenant filtered, max50. Returns states/attempts/result codes, never secrets, phones, bodies or lease tokens. `complete` means policy evaluated, including suppressed/no-device cases; it does not mean delivered.

## Activation gates

Enable only the internal queue with `CONNECT_INTERNAL_ALERT_QUEUE_ENABLED=true` (the older `CONNECT_AUTOMATION_EXECUTION_ENABLED=true` remains backward compatible); require `CONNECT_AUTOMATION_STORAGE_PRIVATE_CONFIRMED`, `CONNECT_AUTOMATION_TTL_CONFIRMED`; secret-managed `CONNECT_AUTOMATION_WORKER_SECRET` (>=32 chars), optional `CONNECT_AUTOMATION_SOURCE_KEYS_JSON` (app->distinct secret, >=32 chars each). App keys must differ from each other and the worker key. Queue collection/review does not require P0 push or VAPID; actual device delivery still requires every existing P0 gate and physical proof. The production-only Internal Automation Storage Proof checks actual published Rules fingerprint and existing ACTIVE TTL for both job/budget collections, without changing configuration or reading customer data. The internal-queue flag remains OFF until that proof succeeds and a separately gated activation is deployed. The broader automation flag, Web Push and Meta template activation remain OFF in this internal-only release.

Private runtime IAM/client-denial/TTL required for `connectAutomationJobs.expiresAt` (30d) and `connectAutomationBudgets.expiresAt` (3d). No scheduler is provisioned: an authenticated operator/server must invoke the worker. Periodic recovery therefore remains an external deployment/configuration gate. Staging and physical devices remain unverified. Do not enable or claim a three-app automation integration from CI alone.

## Recovery executable

`npm run build:core` bundles `dist-core/recovery.cjs` alongside the API. Run `npm run start:recovery` in the existing container with secret-managed `CONNECT_AUTOMATION_WORKER_SECRET` and `CONNECT_AUTOMATION_RECOVERY_ORIGIN` set to the canonical Connect HTTPS origin or its isolated Cloud Run service URL. It signs a fresh timestamp and exact ten-job body, rejects unrelated origins/redirects, times out after 25 seconds and exits nonzero without exposing secrets or raw responses. It never retries an uncertain HTTP outcome; the durable queue owns retry/lease policy. Success logs only the processed count. A scheduler/Cloud Run Job must still be provisioned and verified before unattended recovery is claimed.

## Source increment #284 (awaiting release verification)

Incoming WhatsApp message and provider index now commit an atomic `alertOutboxStatus=pending` field. The existing HMAC worker catches up from durable messages (including bounded legacy cursor reconciliation) with canonical tenant/channel binding, at most three failed enqueue attempts, budget and idempotency. Unqueued failures become tenant-authorized `needs_review` entries in the queue read, without phone/body/uid. Index review listing is bounded (200 org records); do not claim exhaustive audit for bigger tenants. Physical push, Meta templates, general automations OFF. Unattended scheduler/real production trial not certified until separate proof.


## Queue fairness, deferred jobs and bounded index-only pagination (2026-10-16)

The worker previously requested only `min(25, batchLimit)` Firestore documents per state, without filtering `availableAt`. If the first document IDs contained backoff jobs, ready jobs sorted later by document name could remain invisible across repeated hourly calls. The source-only remediation scans **up to eight 25-document pages per state** (bounded), keeps only due pending jobs and expired processing leases, then prioritizes by `availableAt`. Actual lease and tenant scope are still rechecked by optimistic concurrency before any external action. This uses only pre-existing state single-field indexes; it **does not** add a composite index, Firestore Rules, TTL, IAM, paid scheduler, Meta send or push activation.

Remaining limitation: an enormous queue with more than 200 blocked records per state can still need pagination/cursor/monitoring beyond this capped scan; no zero-backlog or hourly SLA can be claimed. Certify the full backlog in production before enabling app alerts. Queue processing stays bounded to ten jobs per call and all external sends remain behind the existing gates.
