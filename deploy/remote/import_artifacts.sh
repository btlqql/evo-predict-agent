#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: deploy/remote/import_artifacts.sh <job_id>" >&2
  exit 2
fi

JOB_ID="$1"
REMOTE_HOST="${EVOMATE_REMOTE_HOST:-remote.example.com}"
REMOTE_PORT="${EVOMATE_REMOTE_PORT:-22}"
REMOTE_USER="${EVOMATE_REMOTE_USER:-evomate}"
REMOTE_KEY="${EVOMATE_REMOTE_SSH_KEY:-}"
REMOTE_ROOT="${EVOMATE_REMOTE_ROOT:-~/evomate-worker}"
LOCAL_DIR="${EVOMATE_REMOTE_ARTIFACTS_DIR:-memory/evomate/remote-artifacts}"

SCP_OPTS=(-P "$REMOTE_PORT")
if [[ -n "$REMOTE_KEY" ]]; then
  SCP_OPTS+=(-i "$REMOTE_KEY" -o IdentitiesOnly=yes)
fi

mkdir -p "$LOCAL_DIR"
scp "${SCP_OPTS[@]}" -r "$REMOTE_USER@$REMOTE_HOST:$REMOTE_ROOT/artifacts/$JOB_ID" "$LOCAL_DIR/"

echo "imported $JOB_ID -> $LOCAL_DIR/$JOB_ID"
