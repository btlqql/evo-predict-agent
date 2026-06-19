#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: deploy/remote/submit_job.sh memory/evomate/remote-jobs/<job_id>/job.json" >&2
  exit 2
fi

JOB_JSON="$1"
JOB_ID="$(basename "$(dirname "$JOB_JSON")")"
DATASET_JSON="$(dirname "$JOB_JSON")/dataset.json"
REMOTE_HOST="${EVOMATE_REMOTE_HOST:-remote.example.com}"
REMOTE_PORT="${EVOMATE_REMOTE_PORT:-22}"
REMOTE_USER="${EVOMATE_REMOTE_USER:-evomate}"
REMOTE_KEY="${EVOMATE_REMOTE_SSH_KEY:-}"
REMOTE_ROOT="${EVOMATE_REMOTE_ROOT:-~/evomate-worker}"
REMOTE_REPO="${EVOMATE_REMOTE_REPO_DIR:-~/evomate-worker/repo}"

SSH_OPTS=(-p "$REMOTE_PORT")
SCP_OPTS=(-P "$REMOTE_PORT")
if [[ -n "$REMOTE_KEY" ]]; then
  SSH_OPTS+=(-i "$REMOTE_KEY" -o IdentitiesOnly=yes)
  SCP_OPTS+=(-i "$REMOTE_KEY" -o IdentitiesOnly=yes)
fi

scp "${SCP_OPTS[@]}" "$JOB_JSON" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_ROOT/jobs/$JOB_ID.json"
scp "${SCP_OPTS[@]}" "$DATASET_JSON" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_ROOT/datasets/$JOB_ID.json"
ssh "${SSH_OPTS[@]}" "$REMOTE_USER@$REMOTE_HOST" \
  "cd $REMOTE_REPO && nohup python3 -m evo_predict_agent.remote_worker --job $REMOTE_ROOT/jobs/$JOB_ID.json --dataset $REMOTE_ROOT/datasets/$JOB_ID.json --artifacts $REMOTE_ROOT/artifacts/$JOB_ID > $REMOTE_ROOT/logs/$JOB_ID.log 2>&1 &"

echo "submitted $JOB_ID"
