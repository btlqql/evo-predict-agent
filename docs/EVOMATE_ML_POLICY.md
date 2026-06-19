# EvoMate Machine Learning Policy

## Goal

EvoMate does not train a large model first. The first ML layer is a lightweight personalized behavior policy that makes the assistant a better Yes Engineer.

```text
Question is not: what will the user ask next?
Question is: how should the assistant behave for this user now?
```

## Algorithm

Initial model:

```text
Linear Contextual Bandit + Reward Learning
```

Why this fits:

```text
context features -> choose behavior gene -> observe user feedback -> update policy
```

## Input

Each user request becomes a feature vector.

Examples:

- task type: coding / product / research / general
- risk level: low / medium / high
- signals: permission sensitive, impatient user, roadshow planning, EvoMap integration, ML policy, infrastructure
- intent: wants analysis, wants direct action, wants visualization, wants research
- history: understanding score, recent correction/interruption pressure

## Action

Each action is a Behavior Gene / Yes Mode:

- `gene_ask_before_execution` — Safe Yes
- `gene_concise_direct_answer` — Fast Yes
- `gene_mcp_first_architecture` — Architect Yes
- `gene_deep_research_first` — Research Yes
- `gene_visualize_first` — Visual Yes
- `gene_yes_engineer_policy` — Policy Yes

## Scoring

For each gene:

```text
score = feature_vector · gene_weights + gene_prior + exploration_bonus
```

The API returns:

- selected gene
- feature vector
- all gene scores
- predicted Yesness
- explanation

## Reward

User feedback becomes reward.

Positive examples:

- accepted
- continue
- OK / yes
- task completion

Negative examples:

- corrected
- interrupted
- rejected
- undo
- “你干啥了”
- “不是这个意思”
- “别乱动” after agent acted too early

Reward range:

```text
-1.0 to +1.0
```

Yesness:

```text
yesness = (reward + 1) / 2
```

## EvoMap / GEP Mapping

The ML layer is not separate from EvoMap. Each policy decision/update maps to a GEP concept:

| EvoMate ML Object | EvoMap/GEP Object |
| --- | --- |
| Behavior Gene action | Gene |
| User interaction + selected gene | EvolutionEvent |
| Weight update | Mutation |
| Reward evidence | ValidationReport |
| Repeated successful behavior | Capsule |

## Current Implementation

Code:

```text
packages/evomate-core/src/ml.ts
packages/evomate-core/src/index.ts
```

State:

```text
memory/evomate/evolution-state.json
```

API:

```text
POST /api/interactions/analyze
POST /api/feedback
GET  /api/evolution/state
```

MCP tools:

```text
evomate_select_behavior_gene
evomate_record_feedback
evomate_predict_satisfaction
```

## Cloud Compute Decision

Current bandit model does not need cloud GPU. It runs on CPU and updates online per feedback event.

Use cloud/remote server for:

- always-on API/frontend demo
- storing shared team evolution state
- running heavier future experiments
- deploying EvoMap remote mode

Use GPU only later if we add:

- embedding model fine-tuning
- preference model training
- simulated user training gym at scale
- offline RL / AutoML search

## EvoMap LLM Signal Extractor

Hard-coded keyword rules are only the cold-start layer. The API now supports an EvoMap OpenAI-compatible LLM extractor before the bandit policy.

Environment:

```text
EVOMAP_LLM_BASE_URL=https://api.evomap.ai/v1
EVOMAP_LLM_API_KEY=sk-evomap-...
EVOMAP_LLM_MODEL=evomap-claude-opus-4-7
EVOMAP_LLM_TIMEOUT_MS=12000
```

Runtime flow:

```text
raw user input
  -> seed rule extractor
  -> EvoMap LLM structured extractor
  -> merged signals
  -> contextual bandit policy
  -> selected Behavior Gene
```

The LLM does not choose the final behavior. It only returns structured JSON:

```json
{
  "task_type": "coding",
  "risk_level": "medium",
  "intent": "analyze before execution",
  "tone": "direct",
  "confidence": 0.86,
  "signals": ["coding_task", "permission_sensitive", "ml_policy"],
  "rationale": "The user asks to inspect and avoid uncontrolled execution."
}
```

Then EvoMate merges the LLM signals with seed rules and lets the bandit policy make the final decision. This keeps the system explainable and learnable.

API response now includes:

```text
signalExtraction.seed
signalExtraction.llm
signalExtraction.merged
```

Secrets are loaded from `.env.local` or `.env`, both ignored by git.

## Implemented GEP Asset Writer

Feedback updates now write local GEP-compatible assets from the API.

Code:

```text
apps/api/src/gep-assets.ts
apps/api/src/gep-sdk.d.ts
apps/api/src/paths.ts
```

On every `POST /api/feedback`, the backend now:

```text
1. Calculates reward
2. Updates the bandit policy
3. Diffs policy weights before/after
4. Creates a GEP Mutation
5. Creates a GEP EvolutionEvent
6. Stamps both with @evomap/gep-sdk computeAssetId()
7. Appends them to assets/events.jsonl
8. Optionally solidifies a Capsule after repeated positive rewards
```

API response includes:

```json
{
  "gepAssets": {
    "ok": true,
    "assetsDir": ".../assets",
    "eventsPath": ".../assets/events.jsonl",
    "written": [
      { "type": "Mutation", "id": "mut_evomate_...", "asset_id": "sha256:..." },
      { "type": "EvolutionEvent", "id": "evt_evomate_...", "asset_id": "sha256:..." }
    ]
  }
}
```

Validation:

```bash
npm run gep:schema-validate
```

For isolated tests:

```bash
GEP_ASSETS_DIR=/tmp/evomate-assets npm run evomate:api
node scripts/gep_bridge.mjs validate-schema <<JSON
{"assets_dir":"/tmp/evomate-assets"}
JSON
```
