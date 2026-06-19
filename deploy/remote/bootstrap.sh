#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${EVOMATE_REMOTE_HOST:-remote.example.com}"
REMOTE_PORT="${EVOMATE_REMOTE_PORT:-22}"
REMOTE_USER="${EVOMATE_REMOTE_USER:-evomate}"
REMOTE_KEY="${EVOMATE_REMOTE_SSH_KEY:-}"
REMOTE_ROOT="${EVOMATE_REMOTE_ROOT:-~/evomate-worker}"

SSH_OPTS=(-p "$REMOTE_PORT")
if [[ -n "$REMOTE_KEY" ]]; then
  SSH_OPTS+=(-i "$REMOTE_KEY" -o IdentitiesOnly=yes)
fi

ssh "${SSH_OPTS[@]}" "$REMOTE_USER@$REMOTE_HOST" \
  "mkdir -p $REMOTE_ROOT/{repo,jobs,datasets,artifacts,logs,models} && python3 --version && node --version || true && nvidia-smi || true"
