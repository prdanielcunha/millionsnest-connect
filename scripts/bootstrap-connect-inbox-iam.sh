#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-millionsnest}"
RUNTIME_SA="${CONNECT_RUNTIME_SA:-mn-connect-runtime@millionsnest.iam.gserviceaccount.com}"
ROLE_ID="${CONNECT_INBOX_ROLE_ID:-millionsNestConnectInboxRuntime}"
ROLE_NAME="projects/${PROJECT_ID}/roles/${ROLE_ID}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ROLE_FILE="${REPO_ROOT}/infra/iam/connect-inbox-runtime-role.yaml"
MODE="${1:---check-only}"
READINESS_URL="${CONNECT_STORAGE_READINESS_URL:-https://mn-connect-555464791734.web.app/api/health/storage-readiness}"

required_admin_permissions=(
  "iam.roles.create"
  "iam.roles.get"
  "iam.roles.update"
  "resourcemanager.projects.getIamPolicy"
  "resourcemanager.projects.setIamPolicy"
)

required_runtime_permissions=(
  "datastore.entities.get"
  "datastore.entities.list"
  "datastore.entities.create"
  "datastore.entities.update"
)

if [[ "$MODE" != "--check-only" && "$MODE" != "--apply" ]]; then
  echo "Usage: $0 [--check-only|--apply]" >&2
  exit 2
fi

command -v gcloud >/dev/null 2>&1 || {
  echo "gcloud is required." >&2
  exit 1
}

test -f "$ROLE_FILE" || {
  echo "Role definition not found: $ROLE_FILE" >&2
  exit 1
}

ACCESS_TOKEN="$(gcloud auth print-access-token)"
PERMISSION_JSON="$(mktemp)"
trap 'rm -f "$PERMISSION_JSON"' EXIT

ADMIN_PERMISSION_PAYLOAD="$(
  printf '%s\n' "${required_admin_permissions[@]}" |
  python3 -c 'import json,sys; print(json.dumps({"permissions":[x.strip() for x in sys.stdin if x.strip()]}))'
)"

HTTP_STATUS="$(curl --silent --show-error   -o "$PERMISSION_JSON"   -w '%{http_code}'   -X POST   -H "Authorization: Bearer $ACCESS_TOKEN"   -H 'Content-Type: application/json'   --data "$ADMIN_PERMISSION_PAYLOAD"   "https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT_ID}:testIamPermissions")"
unset ACCESS_TOKEN

if [[ "$HTTP_STATUS" != "200" ]]; then
  echo "Could not prove IAM bootstrap capability (HTTP $HTTP_STATUS)." >&2
  exit 1
fi

python3 - "$PERMISSION_JSON" <<'PY'
import json
import sys

path = sys.argv[1]
required = {
    "iam.roles.create",
    "iam.roles.get",
    "iam.roles.update",
    "resourcemanager.projects.getIamPolicy",
    "resourcemanager.projects.setIamPolicy",
}
payload = json.load(open(path, encoding="utf-8"))
granted = set(payload.get("permissions") or [])
missing = sorted(required - granted)
for permission in sorted(required):
    print(f"CONNECT_IAM_BOOTSTRAP_PERMISSION={permission}:{'granted' if permission in granted else 'missing'}")
if missing:
    print("CONNECT_IAM_BOOTSTRAP_CAPABILITY=insufficient")
    print("Missing administrative permissions: " + ", ".join(missing), file=sys.stderr)
    sys.exit(3)
print("CONNECT_IAM_BOOTSTRAP_CAPABILITY=available")
PY

if [[ "$MODE" == "--check-only" ]]; then
  echo "CHECK_ONLY_OK"
  exit 0
fi

if [[ "${CONNECT_INBOX_IAM_ACK:-}" != "CONNECT_INBOX_IAM_READY" ]]; then
  echo "Refusing IAM mutation. Set CONNECT_INBOX_IAM_ACK=CONNECT_INBOX_IAM_READY." >&2
  exit 4
fi

if gcloud iam roles describe "$ROLE_ID"   --project="$PROJECT_ID"   --format='value(name)' >/dev/null 2>&1; then
  gcloud iam roles update "$ROLE_ID"     --project="$PROJECT_ID"     --file="$ROLE_FILE"     --quiet
else
  gcloud iam roles create "$ROLE_ID"     --project="$PROJECT_ID"     --file="$ROLE_FILE"     --quiet
fi

gcloud projects add-iam-policy-binding "$PROJECT_ID"   --member="serviceAccount:$RUNTIME_SA"   --role="$ROLE_NAME"   --condition=None   --quiet >/dev/null

echo "CONNECT_INBOX_RUNTIME_ROLE_BOUND=$ROLE_NAME"

for attempt in $(seq 1 20); do
  PAYLOAD="$(curl --fail --silent --show-error "$READINESS_URL" || true)"
  STATE="$(
    printf '%s' "$PAYLOAD" |
    node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const x=JSON.parse(s);process.stdout.write(String(x.storageReadiness||''))}catch{}})"
  )"
  if [[ "$STATE" == "read_write_confirmed" ]]; then
    echo "CONNECT_RUNTIME_FIRESTORE_SELF_PROBE_STATE=read_write_confirmed"
    echo "CONNECT_INBOX_IAM_BOOTSTRAP_OK"
    exit 0
  fi
  echo "Waiting for IAM propagation (attempt $attempt/20, state=${STATE:-unavailable})"
  sleep 6
done

echo "Role binding was applied, but runtime readiness did not confirm within the propagation window." >&2
exit 5
