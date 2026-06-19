# EvoMate Hook Integration

EvoMate should **not** replace Codex / Claude Code / Cursor. It runs as a sidecar:

```text
Codex / Claude Code / Cursor
  -> normal agent flow continues
  -> EvoMate hook observes prompt/outcome in parallel
  -> EvoMate API parses semantics + selects Behavior Gene
  -> optional advisor text is injected only if host supports it
  -> outcome becomes reward learning + EvoMap GEP assets
```

## What was added

### API endpoints

| Endpoint | Role | Side effect |
| --- | --- | --- |
| `POST /api/agent-events/observe` | Observe a host event and select a behavior gene | Adds timeline event |
| `POST /api/advisor/prepare` | Build read-only advisor prompt for the next agent turn | No state mutation |
| `POST /api/agent-events/outcome` | Convert completion / correction / interruption into reward | Updates policy + writes GEP assets |

### Sidecar CLI

```bash
npm --silent run evomate:observe -- --source codex --event user_message --content "先分析这个 hook 怎么做"
npm --silent run evomate:advisor -- --source codex --event advisor_prepare --input "改一下前端" --text
npm --silent run evomate:outcome -- --source codex --event task_completed --outcome success --content "用户接受了改动"
```

All sidecar commands are designed to be hook-safe:

- short API timeout, default `900ms`
- local JSONL queue under `memory/evomate/hooks/`
- secret redaction before queue/API post
- never exits with failure for observe/outcome hook usage
- host command should still use `|| true`

## Environment

```bash
EVOMATE_API_URL=http://localhost:8787
EVOMATE_HOOK_TIMEOUT_MS=900
EVOMATE_HOOK_QUEUE_DIR=memory/evomate/hooks
EVOMATE_PROJECT_ROOT=/path/to/evo-predict-agent
```

## Payload contract

Observation:

```json
{
  "source": "codex",
  "event": "user_message",
  "workspace": "/repo/path",
  "sessionId": "local-session",
  "content": "用户原始请求",
  "metadata": { "host": "codex" }
}
```

Outcome:

```json
{
  "source": "codex",
  "event": "task_completed",
  "outcome": "success",
  "content": "用户说 ok / 或任务完成摘要",
  "geneId": "gene_ask_before_execution",
  "signals": ["coding_task", "permission_sensitive"]
}
```

## Three operating modes

1. **Observer mode** — safest demo mode. EvoMate only sees events and updates the control plane.
2. **Advisor mode** — EvoMate returns a small instruction block; Codex/Claude Code may include it as context.
3. **Control mode** — future mode. EvoMate selects workflow/tool routes before execution.

Current implementation is Observer + Advisor. Control mode stays opt-in because we do not want to break the original agent UX.

## EvoMap fit

The hook sidecar makes EvoMate deeply compatible with EvoMap because every lifecycle signal becomes an evolvable asset:

```text
Prompt / event
  -> SemanticParseResult
  -> BehaviorGene decision
  -> Reward from outcome
  -> Mutation + EvolutionEvent + Capsule candidate
  -> GEP assets in assets/events.jsonl and assets/capsules.json
```

This is the core competition story: the user keeps using their existing coding agent, while EvoMate quietly learns how that agent should behave for this specific user.
