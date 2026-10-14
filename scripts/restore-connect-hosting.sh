#!/usr/bin/env bash
set -euo pipefail

# Earlier runtime/build failures must never republish an untouched Hosting site.
if [ "${CONNECT_HOSTING_RELEASE_STARTED:-false}" != true ]; then
  echo CONNECT_FAILURE_HOSTING_UNCHANGED
  exit 0
fi

: "${PROJECT_ID:?Project required for Hosting recovery}"
[[ "${PREVIOUS_HOSTING_VERSION:-}" =~ ^sites/mn-connect-555464791734/versions/[a-zA-Z0-9_-]+$ ]] || {
  echo CONNECT_FAILURE_HOSTING_VERSION_INVALID >&2
  exit 1
}

# Firebase CLI supports exact same-site source versions via site@version.
# The existing live channel is the only target; no preview channel is created.
npx -y firebase-tools@15.26.0 hosting:clone \
  "mn-connect-555464791734@${PREVIOUS_HOSTING_VERSION##*/}" \
  'mn-connect-555464791734:live' --project "$PROJECT_ID" --non-interactive
echo CONNECT_FAILURE_HOSTING_VERSION_RESTORED
