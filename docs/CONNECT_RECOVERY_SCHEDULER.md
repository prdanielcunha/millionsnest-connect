# Connect unattended internal recovery — rollout and rollback

The worker executable `dist-core/recovery.cjs` and the HMAC verifier already exist. This increment provisions one **separate Cloud Run Job** and one hourly Cloud Scheduler invocation, never a second external delivery pipeline.

Gate order: confirm actual `/api/health.releaseSha` equals approved serving commit `4ba5e6f8fec95937ccdc5d6d581c4d4ab2d78107`; read Cloud Run policy to ensure internal queue ON and broad automation/push OFF; prove image; require existing Cloud Scheduler API enabled (never enable APIs/billing); provision one-task/no-retry Cloud Run Job with existing pinned Secret Manager mount and runtime service account; execute one signed, real batch; create narrowly scoped scheduler invoker SA with `roles/run.invoker` on only this job; then configure one hourly Scheduler request to Run Jobs API. No secret or user data is placed in Scheduler.

Failure at any stage prevents creating the recurring trigger. This does not prove individual device delivery or partner-app publishers. GH Workflow produces the actual evidence, not source commits. Authenticated job and scheduled executions use existing queue leases/idempotency and cannot perform a new unapproved Meta send.

To pause safely without deleting any customer data:

```sh
gcloud scheduler jobs pause connect-inbound-alert-recovery-hourly-v1 --project millionsnest --location us-central1
```

Recovery resumes only after inspecting live job runs and the Queue review state. Cloud Scheduler may incur a small recurring charge depending on the account's free quota; no billing settings are changed. If required cloud permissions or API are absent, mark scheduler **BLOCKED**, do not call it operational.
