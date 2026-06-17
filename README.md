# Evo Predict Agent

一个独立于比赛仓库的 **预测型自进化 Agent** 原型。

它借鉴 `/Users/wangyue/evo/external/atomation` 的自动实验闭环：

```text
memory -> planner -> action -> feedback -> insight -> next run
```

但这里不再做比赛分类/推荐任务，而是做：

```text
用户历史问题 / 项目状态 / 错误日志
  -> 预测下一类问题
  -> 自动选择 Gene / Capsule
  -> 生成 pre-evolution card
  -> 用户真实提问后记录 outcome
  -> 下一次预测更准
```

## 设计原则

- **不动比赛仓库**：本仓库是新开本地 Git repo。
- **本地优先**：默认不联网、不上传 prompt、不发代码、不接 EvoMap Hub。
- **透明 AutoML**：不是黑盒算法，而是多个可解释 predictor 做 rolling backtest，自动选择当前最靠谱的 predictor。
- **GEP 兼容资产**：用 Gene / Capsule / EvolutionEvent 的思路组织经验，后续可以接 EvoMap schema。

## 快速 demo

```bash
cd /Users/wangyue/evo/evo-predict-agent
python -m evo_predict_agent.cli init
python -m evo_predict_agent.cli demo
python -m evo_predict_agent.cli predict --context "changed app/api/auth/callback route and now API returns 401 after login"
python -m evo_predict_agent.cli pre-evolve --context "Next.js build failed with missing env and TS error"
```

## CLI

```bash
python -m evo_predict_agent.cli init
python -m evo_predict_agent.cli ingest --question "登录后为什么 401" --family auth-bug --outcome success --summary "fixed cookie boundary"
python -m evo_predict_agent.cli predict --context "auth callback 401"
python -m evo_predict_agent.cli pre-evolve --context "auth callback 401"
python -m evo_predict_agent.cli record-outcome --prediction-id <id> --actual-family auth-bug --resolved true --summary "hit prediction"
python -m evo_predict_agent.cli status
```

## 与 atomation 的关系

`atomation` 是比赛用自动机器学习实验 Agent。这个仓库只抽象它的通用架构思想：

- `Budget`：预算意识
- `Memory`：JSONL 逐轮记录
- `Planner/Predictor`：LLM/规则/模型选择
- `InsightStore`：跨运行经验
- `Trajectory`：可审计过程

不复制比赛数据，不改比赛代码。

## EvoMap 技术栈接入

这个仓库现在不是只“借概念”，而是接了 EvoMap 官方本地技术栈：

- `@evomap/gep-sdk`：官方 GEP schema version、content hash、asset id。
- `@evomap/gep-mcp-server`：本地 MCP GEP server，可用本项目的 `assets/` 和 `memory/evolution/`。
- `scripts/gep_bridge.mjs`：Python agent 与官方 Node GEP SDK 的桥。

安装 Node 依赖：

```bash
npm install
npm run gep:info
```

Python 侧验证：

```bash
python3 -m evo_predict_agent.cli gep-info
python3 -m evo_predict_agent.cli verify-assets
python3 -m evo_predict_agent.cli export-gep --out memory/gep_bundle.local.json
```

启动本地 GEP MCP Server：

```bash
npm run mcp:local
```

MCP 配置示例：

```text
.mcp/gep-local.json
```

默认仍然 **不联网、不 publish、不上传 Hub**。如果后续要接 EvoMap Hub，再显式配置 `EVOMAP_NODE_ID / EVOMAP_NODE_SECRET / EVOMAP_API_KEY`。
