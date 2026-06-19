#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${EVOMATE_REMOTE_HOST:-remote.example.com}"
REMOTE_PORT="${EVOMATE_REMOTE_PORT:-22}"
REMOTE_USER="${EVOMATE_REMOTE_USER:-evomate}"
REMOTE_KEY="${EVOMATE_REMOTE_SSH_KEY:-}"
REMOTE_REPO="${EVOMATE_REMOTE_REPO_DIR:-~/evomate-worker/repo}"

SSH_CMD="ssh -p $REMOTE_PORT"
if [[ -n "$REMOTE_KEY" ]]; then
  SSH_CMD="$SSH_CMD -i $REMOTE_KEY -o IdentitiesOnly=yes"
fi

rsync -az --delete \
  --exclude node_modules \
  --exclude apps/web/.next \
  --exclude .git \
  --exclude memory/evomate/remote-artifacts \
  -e "$SSH_CMD" \
  ./ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_REPO/"
