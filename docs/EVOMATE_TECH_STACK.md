# EvoMate Technical Stack

## Positioning

EvoMate is an MCP-native, EvoMap-powered self-evolving assistant. The product should not be framed as a simple LLM chat UI. It is an evolution control plane that lets an assistant learn user-specific behavior logic over time.

## Stack Layers

### 1. Product UI

- `apps/web`
- Next.js + React + Tailwind + Framer Motion
- Visual direction: Personal.ai-inspired Memory Core / Identity Core / Behavior Genome.
- Primary surfaces:
  - Chat / interaction panel
  - Memory Core
  - Behavior Genome
  - Evolution Timeline
  - Fitness and Understanding Score
  - MCP Tool Trace

### 1.5. Signal Understanding

- Seed rule extractor for cold start.
- EvoMap OpenAI-compatible LLM structured extractor.
- Environment: `EVOMAP_LLM_BASE_URL`, `EVOMAP_LLM_API_KEY`, `EVOMAP_LLM_MODEL`.
- LLM only extracts structured signals; final behavior selection stays inside EvoMate ML policy.

### 2. Backend Orchestrator

- `apps/api`
- Node.js + TypeScript
- Hono/Fastify-style HTTP API
- Owns the state machine:

```text
IDLE
-> USER_INPUT_RECEIVED
-> EVOMAP_RECALL
-> GENE_SELECTION
-> STRATEGY_DECISION
-> EXECUTE_OR_ANSWER
-> OBSERVE_FEEDBACK
-> REFLECT
-> RECORD_OUTCOME
-> UPDATE_BEHAVIOR_GENOME
-> SOLIDIFY_CAPSULE
```

The backend decides when to recall, mutate, record outcomes, update gene weights, and request confirmation.

### 3. EvoMap / GEP Layer

Official EvoMap components:

- `@evomap/gep-sdk`
  - schema source
  - content-addressed asset IDs
  - canonicalization
  - protocol constants
- `@evomap/gep-mcp-server`
  - `gep_recall`
  - `gep_evolve`
  - `gep_record_outcome`
  - `gep_list_genes`
  - `gep_status`
  - `gep_publish_bundle`
  - `gep_submit_validation_report`

EvoMate should represent assistant behavior as GEP-compatible assets:

- Behavior Gene: reusable behavior strategy.
- Behavior Capsule: validated user-specific behavior improvement.
- EvolutionEvent: full audit trail for one learning cycle.
- Mutation: proposed behavior change.
- ValidationReport: evidence that the behavior improved.

### 4. EvoMate MCP Layer

- `packages/evomate-mcp`
- Our own MCP server exposing product-native tools:
  - `evomate_get_evolution_state`
  - `evomate_record_feedback`
  - `evomate_select_behavior_gene`
  - `evomate_predict_satisfaction`
  - `evomate_get_tech_stack`

This makes EvoMate usable by Codex, Cursor, Claude Code, and future MCP-compatible agents.

### 5. Execution Workers

- `packages/codex-runner`
- Codex CLI / Codex app-server are workers, not the brain.
- Future workers can include Claude Code, Gemini CLI, browser automation, GitHub automation, etc.

### 6. Storage

Initial local storage:

```text
assets/genes.json
assets/capsules.json
assets/events.jsonl
memory/evolution/
memory/evomate/evolution-state.json
```

Future production storage:

- Postgres for users/sessions/events
- JSONB for GEP assets
- Vector index for semantic recall
- Object storage for exported `.gepx` archives

## Important Product Distinction

Do not compete as another multi-model chat UI. EvoMate's value is:

```text
Model-agnostic personalized behavior evolution through MCP + GEP.
```

