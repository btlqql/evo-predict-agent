# EvoMate Project Memory

## Product Direction

EvoMate is an MCP-native self-evolving super assistant built on EvoMap's GEP stack. This is not a throwaway MVP; treat it as the foundation for a productized platform.

Core thesis: models are interchangeable reasoning engines; MCP is the nervous system; EvoMap/GEP is the evolution memory layer.

## Required Architecture Bias

- Use EvoMap technical stack deeply: GEP assets, `@evomap/gep-sdk`, `@evomap/gep-mcp-server`, Gene, Capsule, EvolutionEvent, Mutation, ValidationReport, MemoryGraphEvent.
- Build our own backend state machine/orchestrator. Do not let a model or Codex directly own evolution state.
- Build our own `evomate-mcp-server` as the product control plane.
- Codex CLI / Codex app-server / other coding agents are execution workers, not the product brain.
- Frontend should be Personal.ai-inspired: Memory Core, Identity Core, Behavior Genome, Evolution Timeline, dark minimal high-end AI identity aesthetic.

## Product Principle

普通 memory 只记事实；EvoMate 要改变 Agent 未来的行为逻辑。

Every user correction, approval, interruption, undo, or satisfaction signal should become structured evolution data:

```text
User Feedback -> Signal -> Gene Selection/Mutation -> Outcome -> Capsule -> Recall Next Time
```





## Remote Compute

Remote ML/demo machine is available for heavier experiments and hosted demos:

```text
ssh -i /Users/wangyue/.ssh/id_ed25519 -o IdentitiesOnly=yes -p 9022 wzu@100.70.188.115
```

Verified: Node v20.20.2, npm 10.8.2, Python 3.10.12, 251 GiB RAM, 2 × Tesla V100-PCIE-32GB. Use it for embedding batches, preference model training, workflow simulation/evolution gym, and stable hosted demo. Do not waste GPU on the current lightweight contextual bandit. Full plan: `docs/EVOMATE_ML_OPTIMIZATION_ROADMAP.md`.

## Semantic-First Evolution Architecture

Primary architecture: user input first goes through a `Semantic Parser`, then the shared semantic result flows into three evolution layers:

1. Behavior Policy Evolution Layer — ML/bandit chooses the current Behavior Gene / Yes Mode.
2. Instruction Evolution Layer — user corrections become durable prompt/instruction mutations.
3. Workflow / Tool Evolution Layer — MCP/tool routes and execution workflows evolve.

The Evolution Composer maps these outputs into EvoMap/GEP assets: Gene, Mutation, EvolutionEvent, ValidationReport, and Capsule. Full spec: `docs/EVOMATE_SEMANTIC_ARCHITECTURE.md`.

## Machine Learning Policy

EvoMate uses a lightweight `Linear Contextual Bandit + Reward Learning` layer first, not LLM fine-tuning. The ML chooses the best Behavior Gene / Yes Mode for the current user context, then updates from user feedback.

Core code: `packages/evomate-core/src/ml.ts`. Full design: `docs/EVOMATE_ML_POLICY.md`.

EvoMap LLM Signal Extractor is wired in `apps/api/src/evomap-llm.ts`. It uses OpenAI-compatible chat completions at `https://api.evomap.ai/v1`, with model `evomap-claude-opus-4-7`, to produce structured signal JSON. It does not choose the final behavior; the bandit policy does.

Cloud GPU is not required for the first ML layer; CPU is enough. Remote machines are useful for persistent demo hosting and future heavier experiments.

## Roadshow Narrative

The product pitch is: `EvoMate: The Self-Evolving Yes Engineer`.

The key route-show idea is not predicting the user's next question. It is learning how the assistant should behave for this user: when to execute, when to ask, when to summarize, when to research, when to visualize, and when to stop.

Primary demo metric: `Yesness Score` = user-intent alignment + lower correction/interruption friction.

Pitch sentence: EvoMap gives agents a shared evolution protocol; EvoMate gives each user a personal evolution loop.

Full pitch doc: `docs/EVOMATE_ROADSHOW.md`.

## Current Stack Target

- Frontend: Next.js + React + Tailwind + Framer Motion.
- Backend: Node.js + TypeScript + Hono/Fastify-style API + state machine.
- MCP: EvoMap GEP MCP + EvoMate MCP + optional Codex wrapper MCP.
- GEP: `@evomap/gep-sdk` for schemas/hash/asset IDs, `@evomap/gep-mcp-server` for evolution tools.
- Execution: Codex CLI/App Server first, other models/providers later.
- Storage: local JSONL/JSON first, designed for Postgres/SQLite later.


## Implementation TODO

The active project task list is tracked in root `TODO.md`. Immediate next steps:

1. Implement `packages/evomate-core/src/semantic.ts`.
2. Return semantic parser output from `/api/interactions/analyze`.
3. Show Semantic Parser output on frontend.
4. Implement `packages/evomate-core/src/evolution.ts` composer.
5. Extend MCP tools for semantic/workflow/evolution bundle APIs.

## Repo Commands

- Python tests: `python3 -m unittest discover -s tests -v`
- GEP schema validation: `npm run gep:schema-validate`
- EvoMap MCP local: `npm run mcp:local`
- EvoMate API dev: `npm run evomate:api`
- EvoMate Web dev: `npm run evomate:web`
- EvoMate MCP dev: `npm run evomate:mcp`

## Dependency Policy

- Prefer reusing the user's local dependencies/cache. Do not create repo-local npm caches unless explicitly needed.
- Use existing `node_modules` and the default npm cache at `~/.npm`; if reinstalling is necessary, prefer `npm install --prefer-offline`.
- The repo-local `.npm-cache/` was only a temporary sandbox workaround and must not be committed.

## Git Convention

Commit as `dsadsasdaddas <wangyue20060908@gmail.com>` and include a `Signed-off-by` line.
