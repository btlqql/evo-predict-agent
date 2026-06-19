# EvoMate Implementation TODO

## Current Product Direction

```text
EvoMate = EvoMap-native Self-Evolving Yes Engineer
```

Core architecture:

```text
User Input / Feedback
  -> Semantic Parser
    -> Behavior Policy Evolution Layer
    -> Instruction Evolution Layer
    -> Workflow / Tool Evolution Layer
  -> Evolution Composer
  -> EvoMap GEP Assets
  -> MCP Hosts: Claude Code / Codex / Cursor
```

## Priority 0 — Keep Demo Running

- [x] Local frontend at `http://localhost:3001`
- [x] Local API at `http://localhost:8787`
- [x] Frontend layout changed away from EvoMap homepage clone
- [x] Frontend shows semantic-first three-layer architecture
- [x] TypeScript checks pass
- [ ] Fix any visual issues found in in-app browser review
- [ ] Decide final roadshow first-screen copy

## Priority 1 — Semantic Parser

Goal: one shared semantic contract before ML / instruction / workflow evolution.

- [x] Create `packages/evomate-core/src/semantic.ts`
- [x] Define `SemanticParseResult` type
- [x] Move rule-based signal extraction behind semantic parser
- [x] Add parser fields:
  - [x] `taskType`
  - [x] `intent`
  - [x] `riskLevel`
  - [x] `permissionMode`
  - [x] `userTone`
  - [x] `workstyleSignals`
  - [x] `domainSignals`
  - [x] `toolNeeds`
  - [x] `feedbackSemantics`
  - [x] `confidence`
- [x] Update `extractSignals()` to derive from semantic parser
- [x] Add API response field `semantic`
- [ ] Show semantic parser output on frontend

## Priority 2 — Three Evolution Layers

### 2.1 Behavior Policy Evolution Layer

Already started with contextual bandit.

- [x] Linear contextual bandit
- [x] Reward learning
- [x] Yesness Score
- [ ] Feed `SemanticParseResult` into policy layer instead of raw regex signals
- [ ] Add policy confidence and explanation
- [ ] Log policy decisions to interaction history

### 2.2 Instruction Evolution Layer

Turns user corrections into durable instructions.

- [ ] Create `packages/evomate-core/src/instructions.ts`
- [ ] Define `InstructionMutation`
- [ ] Generate instruction mutations from feedback semantics
- [ ] Store user-specific standing rules
- [ ] Expose instruction mutations in `/api/feedback`
- [ ] Render instruction mutation panel on frontend

Example:

```text
User: 以后别乱动代码，先分析。
Instruction Mutation: When working in code repos, inspect and summarize before edits.
```

### 2.3 Workflow / Tool Evolution Layer

Evolves MCP/tool execution routes.

- [ ] Create `packages/evomate-core/src/workflows.ts`
- [ ] Define `WorkflowGene`
- [ ] Define workflow templates:
  - [ ] `safe_repo_workflow`
  - [ ] `fast_answer_workflow`
  - [ ] `research_first_workflow`
  - [ ] `roadshow_packaging_workflow`
  - [ ] `frontend_iteration_workflow`
- [ ] Select workflow from semantic parser result
- [ ] Expose selected workflow through API and MCP
- [ ] Render workflow route in frontend

## Priority 3 — Evolution Composer / EvoMap GEP Mapping

Goal: every learning cycle becomes GEP-compatible evidence.

- [ ] Create `packages/evomate-core/src/evolution.ts`
- [ ] Define `EvolutionBundle`
- [ ] Compose:
  - [ ] `policyMutation`
  - [ ] `instructionMutation`
  - [ ] `workflowMutation`
  - [ ] `signalMutation`
  - [ ] `capsuleCandidate`
  - [ ] `validationReport`
- [ ] Map EvoMate outputs to EvoMap assets:
  - [ ] Behavior Gene -> `Gene`
  - [ ] Instruction/Policy update -> `Mutation`
  - [ ] User feedback cycle -> `EvolutionEvent`
  - [ ] Reward evidence -> `ValidationReport`
  - [ ] Stable preference -> `Capsule`
- [ ] Return `evolutionBundle` from `/api/feedback`
- [ ] Render `Evolution Composer` output on frontend

## Priority 4 — MCP Host Integration

Target hosts:

```text
Claude Code / Codex / Cursor
```

- [x] `packages/evomate-mcp` exists
- [x] `evomate_select_behavior_gene`
- [x] `evomate_record_feedback`
- [x] `evomate_predict_satisfaction`
- [x] `evomate_get_evolution_state`
- [x] Add `evomate_parse_semantics`
- [ ] Add `evomate_select_workflow`
- [ ] Add `evomate_compose_evolution_bundle`
- [ ] Add MCP config examples for Claude Code / Codex / Cursor
- [ ] Document host flow:

```text
Host receives user input
  -> call evomate_parse_semantics
  -> call evomate_select_behavior_gene
  -> follow selected instruction/workflow
  -> record feedback/outcome
```

## Priority 5 — Better ML Optimization

### Local Online Learning

- [x] Contextual Bandit
- [x] Reward Learning
- [ ] Store interactions in JSONL
- [ ] Add offline replay evaluation
- [ ] Add basic A/B policy comparison

### Embedding Memory Retrieval

- [ ] Create interaction dataset format
- [ ] Add embedding generation script
- [ ] Add vector retrieval over past feedback
- [ ] Use nearest examples as features for policy layer

### Preference Model

- [ ] Collect preference pairs
- [ ] Define pair schema
- [ ] Train small reward/preference model
- [ ] Use remote V100 for training

### Evolution Gym

- [ ] Define simulated user personas
- [ ] Define scenario set
- [ ] Run workflow/gene candidates through simulated users
- [ ] Generate `ValidationReport`

## Priority 6 — Remote Compute / Deployment

Remote machine:

```text
ssh -i /Users/wangyue/.ssh/id_ed25519 -o IdentitiesOnly=yes -p 9022 wzu@100.70.188.115
```

Verified:

```text
Node v20.20.2
npm 10.8.2
Python 3.10.12
RAM 251 GiB
GPU 2 × Tesla V100 32GB
```

Tasks:

- [ ] Sync repo to remote machine
- [ ] Install dependencies with local/remote npm cache
- [ ] Run API on remote
- [ ] Run frontend on remote
- [ ] Optionally expose demo through tunnel / reverse proxy
- [ ] Prepare remote environment for embedding/preference experiments

## Priority 7 — Roadshow Packaging

- [x] Roadshow narrative doc
- [x] Yes Engineer positioning
- [x] Yesness Score metric
- [ ] 3-minute demo script
- [ ] Slide architecture diagram
- [ ] Before/after agent behavior story
- [ ] Visual proof: feedback changes behavior gene
- [ ] Visual proof: EvolutionBundle maps to EvoMap assets

## Immediate Next Steps

1. ~~Implement `semantic.ts`.~~ Done.
2. ~~Return `semantic` from `/api/interactions/analyze`.~~ Done.
3. Show semantic parser output on frontend.
4. Implement `evolution.ts` composer.
5. Extend MCP tools with workflow/evolution bundle APIs. `evomate_parse_semantics` is done.
