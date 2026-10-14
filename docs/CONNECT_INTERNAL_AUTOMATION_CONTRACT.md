# Internal automation worker (#225) — incremental delivery

Default off. This worker executes **internal Connect operator alerts only**, never commercial messages, approved-template dispatch or private domain queries. Existing member-facing automation catalog entries remain blocked until their official publishers/tools/consent contracts are proved.

## Execution

- With the worker enabled, actual durable Meta Inbox ingestion enqueues an opaque message reference, then runs a bounded batch. Recovery reconstructs the event from canonical message storage; jobs do not duplicate phones, text or bearer credentials.
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

Require existing P0 push gates plus `CONNECT_AUTOMATION_EXECUTION_ENABLED`, `CONNECT_AUTOMATION_STORAGE_PRIVATE_CONFIRMED`, `CONNECT_AUTOMATION_TTL_CONFIRMED`; secret-managed `CONNECT_AUTOMATION_WORKER_SECRET` (>=32 chars), optional `CONNECT_AUTOMATION_SOURCE_KEYS_JSON` (app->distinct secret, >=32 chars each).

Private runtime IAM/client-denial/TTL required for `connectAutomationJobs.expiresAt` (30d) and `connectAutomationBudgets.expiresAt` (3d). No scheduler is provisioned: an authenticated operator/server must invoke the worker. Periodic recovery therefore remains an external deployment/configuration gate. Staging and physical devices remain unverified. Do not enable or claim a three-app automation integration from CI alone.
