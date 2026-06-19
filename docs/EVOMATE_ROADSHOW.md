# EvoMate Roadshow Narrative

## Pitch Title

```text
EvoMate: The Self-Evolving Yes Engineer
```

中文：

```text
EvoMate：越用越懂你的自进化 Yes 工程师
```

## One-Liner

EvoMate does not predict what the user will ask next. It learns how the assistant should behave for this user.

中文：

```text
EvoMate 不预测用户下一个问题；
它学习这个用户希望 Agent 怎么做事。
```

## Core Positioning

EvoMate turns a generic AI assistant into a personalized Yes Engineer: an agent that reduces interaction friction, understands the user's working style, and evolves its behavior logic through feedback.

不是无脑 yes，而是更会配合：

- 什么时候直接做
- 什么时候先问
- 什么时候给架构
- 什么时候派 worker
- 什么时候不要乱动
- 什么时候少废话
- 什么时候继续推进

## Problem

Current coding/product agents often fail not because the model lacks knowledge, but because the assistant behavior is misaligned with the user.

Typical friction:

```text
用户要推进，它在解释风险。
用户要分析，它直接改代码。
用户要直接答案，它写长篇作文。
用户说“继续”，它不知道继续哪里。
用户已经纠正过，它下次还犯一样的交互错误。
```

The pain is not only intelligence. The pain is collaboration friction.

## Our Insight

A better assistant should not only remember facts. It should evolve its behavior policy.

```text
普通 memory：记住用户说过什么。
EvoMate：改变 Agent 以后怎么做事。
```

## Solution

EvoMate builds a user-specific behavior genome for an AI assistant.

```text
User Feedback
  -> Signal Extraction
  -> Behavior Gene Selection
  -> Agent Action
  -> Reward / Feedback
  -> Gene Weight Update
  -> EvoMap GEP Event
  -> Capsule Solidification
  -> Better Future Behavior
```

## Technical Thesis

```text
Models are interchangeable reasoning engines.
MCP is the nervous system.
EvoMap/GEP is the evolution asset layer.
EvoMate is the personalized behavior-learning brain.
```

## Where Machine Learning Fits

We do not start by training a new LLM. The first ML layer is a lightweight personalized policy model.

Recommended first algorithm:

```text
Contextual Bandit + Reward Learning
```

The model learns:

```text
Given this user + this task context + this conversation state,
which behavior gene should the assistant activate?
```

Example actions / behavior genes:

- `gene_ask_before_execution`
- `gene_concise_direct_answer`
- `gene_deep_research_first`
- `gene_show_architecture_first`
- `gene_generate_code_after_confirm`
- `gene_business_pitch_mode`
- `gene_visualize_first`

Example features:

- task type: coding / strategy / design / research
- risk level
- permission sensitivity
- user tone
- message length
- has URL / repo / file context
- previous interruptions
- correction history
- preferred answer style

Example rewards:

Positive:

- user says OK / continue
- user accepts answer
- user asks next-step execution
- task completes
- fewer corrections

Negative:

- user interrupts
- user says “你干啥了”
- user rejects direction
- user asks to undo
- repeated correction

## EvoMap's Gap and Our Opportunity

EvoMap is valuable because it defines a protocol and asset layer for agent evolution:

- Gene
- Capsule
- EvolutionEvent
- Mutation
- ValidationReport
- MemoryGraphEvent
- `@evomap/gep-sdk`
- `@evomap/gep-mcp-server`

But EvoMap leaves product gaps that EvoMate fills.

### Gap 1: Protocol, not product

EvoMap gives the evolution format and network, but not a complete user-facing assistant product.

EvoMate adds:

- user-facing evolution dashboard
- Memory Core visualization
- Behavior Genome panel
- Yesness Score
- evolution timeline
- MCP trace

### Gap 2: Asset evolution, not personalized user behavior learning

EvoMap can store and recall Genes/Capsules, but it does not by itself decide:

```text
For this exact user, in this exact moment, how should the assistant behave?
```

EvoMate adds a user-specific policy model.

### Gap 3: Validation is not the same as user satisfaction

EvoMap ValidationReport can prove an asset/task worked. But collaboration quality also includes:

- did the user interrupt?
- did the user correct the assistant?
- was the answer too verbose?
- did the assistant move too fast?
- did the assistant ask too many questions?
- did the user continue naturally?

EvoMate converts these interaction signals into reward.

### Gap 4: MCP tools are not the brain

`gep-mcp-server` exposes tools like:

- `gep_recall`
- `gep_evolve`
- `gep_record_outcome`
- `gep_list_genes`

But an orchestrator still needs to decide when to recall, mutate, validate, and solidify.

EvoMate backend is that orchestrator.

## Product Metric

Primary demo metric:

```text
Yesness Score
```

Meaning:

```text
How well the agent aligns with the user's desired working style.
```

Sub-metrics:

- predicted satisfaction
- interruption rate
- correction rate
- acceptance rate
- undo rate
- time to useful action
- confirmation friction
- task completion rate

## Demo Story

### Scene 1: Generic Agent Friction

User says:

```text
帮我看这个项目，但先别乱动代码。
```

Generic agent directly edits files or gives a wrong next step.

System records:

```text
negative reward
signals: coding_task, permission_sensitive, execution_risk
failed gene: direct_execute
```

### Scene 2: EvoMate Learns

EvoMate updates the behavior genome:

```text
increase weight: gene_ask_before_execution
increase weight: gene_show_architecture_first
reduce weight: gene_direct_execute
```

Writes EvoMap assets:

```text
EvolutionEvent recorded
Mutation proposed
ValidationReport updated
Capsule candidate created
```

### Scene 3: Next Similar Task

User says:

```text
继续搞这个仓库。
```

EvoMate recalls previous Capsule and responds:

```text
我先不直接改代码。当前最合理下一步是：
1. 读取现有架构
2. 找 EvoMap 接入点
3. 给你确认方案
确认后再执行修改。
```

Frontend shows:

```text
Selected Gene: ask_before_execution
Predicted Satisfaction: 86%
Yesness Score: +18%
Correction Risk: -31%
GEP Event: recorded
```

## Roadshow Architecture Slide

```text
Frontend Evolution Dashboard
  -> EvoMate API / Orchestrator
    -> Signal Extractor
    -> Contextual Bandit Policy
    -> Reward Engine
    -> Behavior Genome State
    -> EvoMate MCP Server
    -> EvoMap GEP MCP Server
    -> Codex / Claude / GPT Workers
```

## What to Avoid Claiming

Do not position this as:

- another multi-model chat UI
- a generic memory chatbot
- prediction of user's next question
- fine-tuning a large model from day one
- blind obedience

Position it as:

```text
A personalized behavior evolution layer for AI agents.
```

## Best English Pitch Sentence

```text
EvoMap gives agents a shared evolution protocol. EvoMate gives each user a personal evolution loop.
```

## Best Chinese Pitch Sentence

```text
EvoMap 让 Agent 能共享进化资产；EvoMate 让 Agent 针对每个用户进化自己的行为逻辑。
```
