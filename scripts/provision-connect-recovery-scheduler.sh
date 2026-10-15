#!/usr/bin/env bash
# Production-only, fail-closed provisioning. No Meta/channel/billing mutations.
set -euo pipefail
PROJECT=millionsnest
REGION=us-central1
SERVICE=connect-api
JOB=connect-inbound-alert-recovery-v1
SCHEDULE=connect-inbound-alert-recovery-hourly-v1
CALLER=mn-connect-recovery-invoker@millionsnest.iam.gserviceaccount.com
RUNTIME=mn-connect-runtime@millionsnest.iam.gserviceaccount.com
EXPECTED_SHA="${CONNECT_RECOVERY_EXPECTED_SERVING_SHA:?Expected real deployed SHA required}"
[[ "$EXPECTED_SHA" =~ ^[a-f0-9]{40}$ ]] || { echo 'RECOVERY_EXPECTED_SHA_INVALID' >&2; exit 1; }
if [[ "${CONNECT_RECOVERY_RUN_ONLY:-false}" == 'true' ]]; then
  [[ "${GITHUB_REF:-}" == 'refs/heads/main' ]] || { echo 'RECOVERY_RUN_ONLY_DEFAULT_BRANCH_REQUIRED' >&2; exit 1; }
else
  [[ "${GITHUB_REF:-}" == 'refs/heads/production' ]] || { echo 'RECOVERY_PRODUCTION_ONLY' >&2; exit 1; }
fi

# Only provision against a *really serving* tested release and with physical
# push and broad commercial execution demonstrably OFF.
curl --fail --silent --show-error --max-time 20 --proto '=https' \
  -H 'Cache-Control: no-store' 'https://connect.millionsnest.com/api/health?recovery-scheduler=1' > /tmp/connect-recovery-health.json
EXPECTED_SHA="$EXPECTED_SHA" node - <<'NODE'
const fs=require('fs');
const h=JSON.parse(fs.readFileSync('/tmp/connect-recovery-health.json','utf8'));
if(h.success!==true||h.service!=='millionsnest-connect-core'||h.releaseSha!==process.env.EXPECTED_SHA) process.exit(1);
console.log('RECOVERY_REAL_SERVING_SHA_OK');
NODE
gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format=json > /tmp/connect-recovery-service.json
node - <<'NODE'
const fs=require('fs');
const service=JSON.parse(fs.readFileSync('/tmp/connect-recovery-service.json','utf8'));
const env=Object.fromEntries((service.spec?.template?.spec?.containers?.[0]?.env||[]).map(v=>[v.name,v.value]));
if(env.CONNECT_INTERNAL_ALERT_QUEUE_ENABLED!=='true'||env.CONNECT_AUTOMATION_EXECUTION_ENABLED!=='false'||env.CONNECT_WEB_PUSH_ENABLED!=='false') process.exit(1);
console.log('RECOVERY_QUEUE_ONLY_FLAGS_OK');
NODE

# GitHub Actions supplies the hourly schedule; Cloud Scheduler API is not
# enabled or used. GH scheduled runs may be delayed, so this is best-effort
# periodic recovery, not a strict-time SLA.

# Cron runs read-only probes then execute the already pinned job; no
# recurrent image updates, IAM changes, API activation or secret handling.
if [[ "${CONNECT_RECOVERY_RUN_ONLY:-false}" == 'true' ]]; then
  gcloud run jobs describe "$JOB" --project "$PROJECT" --region "$REGION" --format=json > /tmp/connect-recovery-job.json
  EXPECTED_SHA="$EXPECTED_SHA" node - <<'NODE'
const fs=require('fs');
const j=JSON.parse(fs.readFileSync('/tmp/connect-recovery-job.json','utf8'));
const t=j.spec?.template?.spec?.template?.spec || j.template?.template || {};
const c=t.containers?.[0] || {};
if(!String(c.image||'').endsWith('connect-api:'+process.env.EXPECTED_SHA))process.exit(1);
console.log('RECOVERY_PINNED_JOB_IMAGE_OK');
NODE
  gcloud run jobs execute "$JOB" --project "$PROJECT" --region "$REGION" --wait --quiet
  echo RECOVERY_GITHUB_HOURLY_SIGNED_JOB_OK
  exit 0
fi
IMAGE="us-central1-docker.pkg.dev/millionsnest/millionsnest-web/connect-api:$EXPECTED_SHA"
gcloud artifacts docker images describe "$IMAGE" --project "$PROJECT" --format='value(image_summary.digest)' >/dev/null
RUN_ARGS=(
  --project "$PROJECT" --region "$REGION" --image "$IMAGE"
  --service-account "$RUNTIME"
  --command=node --args=dist-core/recovery.cjs
  --tasks=1 --parallelism=1 --max-retries=0 --task-timeout=60s
  --cpu=1 --memory=512Mi
  --set-env-vars='CONNECT_EXECUTION_SECRET_FILE=/var/run/secrets/connect-execution.json,CONNECT_AUTOMATION_RECOVERY_ORIGIN=https://connect.millionsnest.com'
  --set-secrets='/var/run/secrets/connect-execution.json=connect-execution-v1:1'
)
if gcloud run jobs describe "$JOB" --project "$PROJECT" --region "$REGION" >/dev/null 2>&1; then
  gcloud run jobs update "$JOB" "${RUN_ARGS[@]}" --quiet
else
  gcloud run jobs create "$JOB" "${RUN_ARGS[@]}" --labels='managed-by=millionsnest-connect,component=internal-alert-recovery' --quiet
fi

# Smoke executes one bounded signed batch with the existing mounted secret;
# unsafe/uncertain results fail BEFORE any recurring trigger is created.
gcloud run jobs execute "$JOB" --project "$PROJECT" --region "$REGION" --wait --quiet
echo RECOVERY_JOB_SIGNED_SMOKE_OK

echo RECOVERY_GITHUB_ACTIONS_SCHEDULE_REQUIRED
