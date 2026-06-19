# EvoMate Architecture Diagrams

## One-line Architecture

```text
EvoMate = Local Real-time Agent Runtime + Remote Evolution Lab + EvoMap GEP Asset Layer
```

## Complete Roadshow Architecture

```mermaid
flowchart LR
  U[用户 / 开发者] --> H[Codex / Claude Code / Cursor]

  H --> MCP[EvoMate MCP Server]
  MCP --> API[EvoMate API]

  API --> SP[Semantic Parser<br/>语义解析]
  SP --> BL[Behavior Policy Layer<br/>行为策略进化]
  SP --> IL[Instruction Evolution Layer<br/>指令进化]
  SP --> WL[Workflow Evolution Layer<br/>工作流进化]

  BL --> EC[Evolution Composer]
  IL --> EC
  WL --> EC

  EC --> GEP[EvoMap GEP Assets<br/>Gene / Mutation / Capsule / ValidationReport]

  API --> UI[EvoMate Control Plane<br/>前端可视化控制台]

  API --> RQ[Remote Job Queue]
  RQ --> SSH[SSH / SCP Transport]
  SSH --> GPU[Remote GPU Worker<br/><remote-host><br/>2 × Tesla V100]

  GPU --> PY[Python Evolution Lab<br/>remote_worker.py]
  PY --> ART[Artifacts<br/>policy_eval.json<br/>validation_report.json<br/>suggested_mutations.json<br/>evolution_bundle.json]

  ART --> API
  API --> GEP
  GEP --> MCP
```

## Runtime + Evolution Sequence

```mermaid
sequenceDiagram
  participant User as 用户
  participant Host as Codex / Claude Code
  participant MCP as EvoMate MCP
  participant API as EvoMate API
  participant Policy as Policy Engine
  participant Remote as Remote GPU Worker
  participant GEP as EvoMap GEP

  User->>Host: 提出任务 / 反馈
  Host->>MCP: evomate_parse_semantics
  MCP->>API: 分析请求
  API->>Policy: 选择 Behavior Gene
  Policy-->>Host: Advisor Prompt / 执行策略

  Host->>User: 执行或回答
  User->>Host: 接受 / 纠正 / 打断
  Host->>MCP: evomate_record_feedback
  MCP->>API: 写入反馈和 reward

  API->>Remote: 提交 evolution_gym_eval
  Remote->>Remote: 跑 replay / gym / preference eval
  Remote-->>API: 返回 artifacts

  API->>GEP: 写入 Mutation / ValidationReport / Capsule
  GEP-->>MCP: 下一轮可复用进化资产
```

## Three Evolution Layers

```mermaid
flowchart TB
  Input[User Input / Feedback] --> Sem[Semantic Parser]

  Sem --> B[Behavior Policy Evolution]
  Sem --> I[Instruction Evolution]
  Sem --> W[Workflow / Tool Evolution]

  B --> C[Evolution Composer]
  I --> C
  W --> C

  C --> M[Mutation]
  C --> V[ValidationReport]
  C --> E[EvolutionEvent]
  C --> Cap[Capsule]

  M --> GEP[EvoMap GEP Ledger]
  V --> GEP
  E --> GEP
  Cap --> GEP
```

## Remote Compute Distribution

```mermaid
flowchart LR
  API[EvoMate API] --> Q[Remote Job Queue]
  Q --> D[Portable Dataset<br/>state + policy + timeline]
  Q --> J[Job Manifest<br/>objective + type + command plan]

  D --> T[SSH / SCP Transport]
  J --> T

  T --> R[Remote Machine<br/><remote-host>:<port>]
  R --> GPU[2 × Tesla V100]
  GPU --> Worker[Python remote_worker.py]

  Worker --> PE[policy_eval.json]
  Worker --> VR[validation_report.json]
  Worker --> SM[suggested_mutations.json]
  Worker --> EB[evolution_bundle.json]

  PE --> Import[Artifact Import]
  VR --> Import
  SM --> Import
  EB --> Import

  Import --> Composer[Evolution Composer]
  Composer --> GEP[EvoMap GEP Assets]
```

## Current Verified Remote Run

```text
Job: job_evolution_gym_eval_20260619090850_996f86
Target: <remote-user>@<remote-host>:<port>
GPU: 2 × Tesla V100 32GB
Status: imported
Baseline: 0.61
Evolved: 0.78
Improvement: +0.17 / +27.87%
Bundle: bundle_job_evolution_gym_eval_20260619090850_996f86
```

## Roadshow Talk Track

> 实时决策在本地 MCP，保证低延迟和可控；长期进化分发到远程 GPU，生成可验证的 Mutation、ValidationReport 和 EvolutionBundle，再回写 EvoMap，让 Agent 每轮反馈后真的变强。
