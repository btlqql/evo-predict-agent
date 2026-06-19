#!/usr/bin/env bash
# EvoMate real Claude Code hook adapter.
# Receives Claude Code hook JSON on stdin and forwards it to EvoMate sidecar.
# Non-blocking: hook failures never affect Claude Code's original flow.
set -u

MODE="${1:-observe}"
EVENT="${2:-claude_code_hook}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
EVOMATE_REPO="${EVOMATE_REPO:-$PROJECT_ROOT}"
WORKSPACE="${CLAUDE_PROJECT_DIR:-${PWD}}"

export EVOMATE_API_URL="${EVOMATE_API_URL:-http://127.0.0.1:8787}"
export EVOMATE_PROJECT_ROOT="$EVOMATE_REPO"
export EVOMATE_HOOK_QUEUE_DIR="${EVOMATE_HOOK_QUEUE_DIR:-memory/evomate/hooks}"
export EVOMATE_HOOK_TIMEOUT_MS="${EVOMATE_HOOK_TIMEOUT_MS:-900}"

if [ ! -d "$EVOMATE_REPO" ]; then exit 0; fi
cd "$EVOMATE_REPO" || exit 0

case "$MODE" in
  advisor)
    npm --silent run evomate:advisor -- --source claude-code --event "$EVENT" --workspace "$WORKSPACE" >/dev/null 2>&1 || true
    ;;
  outcome)
    npm --silent run evomate:outcome -- --source claude-code --event "$EVENT" --workspace "$WORKSPACE" >/dev/null 2>&1 || true
    ;;
  observe|*)
    npm --silent run evomate:observe -- --source claude-code --event "$EVENT" --workspace "$WORKSPACE" >/dev/null 2>&1 || true
    ;;
esac

exit 0
