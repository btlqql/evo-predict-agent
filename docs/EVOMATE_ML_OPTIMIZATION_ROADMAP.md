# EvoMate ML Optimization Roadmap

## Remote Compute Target

The project can use the user's remote machine for heavier ML experiments and hosted demos.

```text
Host: <remote-host>
Port: <port>
User: wzu
SSH: /path/to/ssh_key
```

Verified environment on 2026-06-19:

```text
Hostname: wzu-SYS-4029GP-TRT
Node: v20.20.2
npm: 10.8.2
Python: 3.10.12
RAM: 251 GiB total, 224 GiB available at check time
GPU: 2 × Tesla V100-PCIE-32GB
Disk: 1.8T total, 323G free at check time
```

## Current Local ML

Current EvoMate ML is intentionally lightweight:

```text
Semantic Parser seed rules
  -> Linear Contextual Bandit
  -> Reward Learning
  -> Yesness Score
```

This runs locally on CPU and is enough for immediate demo interaction.

## Optimization Direction

EvoMate's ML should evolve in layers. Do not jump directly to training a large model.

```text
Semantic Parser
  -> Policy Layer
  -> Instruction Layer
  -> Workflow Layer
  -> Evolution Composer
  -> EvoMap GEP Assets
```

## Phase 1 — Better Semantic Parser

Problem:

Current signal extraction is rule-heavy.

Upgrade:

```text
Rule cold start
+ LLM structured parser
+ embedding similarity to past examples
+ feedback correction
```

Parser output:

```json
{
  "taskType": "coding",
  "intent": "analysis_before_execution",
  "riskLevel": "medium",
  "permissionMode": "ask_before_editing",
  "workstyleSignals": ["dislikes_unconfirmed_edits"],
  "domainSignals": ["evomap", "mcp", "ml_policy"],
  "toolNeeds": ["repo_inspection", "frontend_iteration"],
  "confidence": 0.86
}
```

Compute need:

```text
Local CPU is enough if using API LLM.
Remote GPU useful if running local embedding/classification models.
```

## Phase 2 — Embedding Memory Retrieval

Add semantic retrieval over past interactions:

```text
input -> embedding -> nearest past corrections / accepted patterns -> features
```

Use cases:

- user says “继续” and system recalls what “continue” meant in this project
- user says “别乱动” and system recalls prior negative reward on unconfirmed edits
- user asks roadshow/product direction and system recalls preferred concise pitch style

Possible stack:

```text
sentence-transformers / bge-small / e5-small
FAISS / sqlite-vss / pgvector later
```

Compute need:

```text
Local CPU okay for small embeddings.
Remote GPU good for batch embedding historical logs and larger models.
```

## Phase 3 — Preference Model

Collect pairs:

```text
context + response/action A vs response/action B -> user preference
```

Train a small reward/preference model to predict:

```text
Which behavior style will the user prefer?
```

Data examples:

- direct answer vs long explanation
- execute now vs ask confirmation
- architecture first vs code first
- research first vs assume from memory

Compute need:

```text
Remote V100 useful.
Start with LoRA or small classifier, not full LLM fine-tuning.
```

## Phase 4 — Workflow Policy Optimization

Move beyond choosing a behavior gene.

Learn workflow routes:

```text
semantic parse
  -> recall capsule?
  -> inspect repo?
  -> ask confirmation?
  -> execute worker?
  -> generate GEP event?
```

This can be optimized with:

```text
contextual bandit over workflow templates
offline evaluation on recorded sessions
simulated user training gym
```

Compute need:

```text
Remote machine useful for running many simulations in parallel.
GPU optional unless simulated users are local LLMs.
```

## Phase 5 — User Simulation / Evolution Gym

Create synthetic user personas:

```text
impatient founder
cautious engineer
hackathon teammate
product judge
research-heavy user
code-owner user
```

Run candidate genes/workflows through scenarios and generate:

```text
ValidationReport
Capsule candidates
policy benchmark curves
```

Compute need:

```text
Remote V100 becomes useful if running local open-source LLM user simulators.
```

## What to Run on Remote First

Priority remote tasks:

1. Host stable demo API/frontend.
2. Batch embed interaction history.
3. Run offline evaluation of policy changes.
4. Train small preference/reward model.
5. Run simulated user gym.

Do not use remote GPU for the current bandit; it is unnecessary.

## Product Story

```text
Local EvoMate learns online from every click.
Remote EvoMate trains better parsers, retrievers, and preference models from accumulated evolution history.
```

## EvoMap Integration

Every ML optimization should still map to GEP assets:

| ML artifact | EvoMap/GEP asset |
| --- | --- |
| semantic parser correction | Mutation |
| behavior policy update | Mutation |
| workflow route improvement | Gene |
| preference evidence | ValidationReport |
| repeated successful behavior | Capsule |
| full learning cycle | EvolutionEvent |
