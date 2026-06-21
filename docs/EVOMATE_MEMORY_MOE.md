# EvoMate Memory Engineering MoE

EvoMate 的进化不只做 prompt injection。Prompt 只是当前回合的执行建议；真正的进化层是把用户反馈、hook、测试结果和 GEP 资产拆成可路由的工程记忆。

## Runtime Loop

```text
Hook/Event -> Memory Router -> Expert Memory -> Behavior Gene -> Advisor -> Outcome -> GEP Asset
```

## Memory Experts

- **Episodic**：最近会话、Codex/Claude/Gemini/web/mobile hook、工具调用上下文。
- **Procedural**：可复用 workflow、GEP Mutation、EvolutionEvent、Capsule。
- **Validation**：命令结果、测试/构建证据、失败样本、可复用约束。
- **Repo**：Git、Terminal、本地文件/项目结构活动。
- **Preference**：用户口味、纠正、禁忌、yes/no 反馈。
- **Policy**：行为基因、bandit/reward、yesness 策略。

## API

`GET /api/memory/route`

返回：

- `activeExpert`：本轮应该相信哪类记忆。
- `experts[]`：每个专家的分数、状态、证据和召回记忆。
- `recalledMemories[]`：给前端/agent 使用的短记忆片段。
- `routePlan[]`：retrieve -> route -> execute -> solidify。
- `gepProof`：当前 GEP genes/capsules/events 数量和最新资产。

`POST /api/memory/route`

可传入：

```json
{
  "input": "用户当前问题",
  "source": "codex",
  "signals": ["prefer_concise_answer"]
}
```

用于根据新输入预路由 memory expert，但不会修改状态。

## Demo 话术

> 我们不是又做了一个聊天框，也不是只把用户偏好塞进 prompt。EvoMate 在 Codex / Claude Code 旁边做 sidecar：先监听事件，再把经验拆成 Memory Experts，由工程层 MoE Router 选择本轮最该调用的记忆，最后把反馈固化成 EvoMap/GEP 资产，让下一次行为真的变了。

## Agent Runtime Integration

Memory Router 现在不只服务前端展示，也进入 `/api/advisor/prepare`：

1. `prepareAdvisor()` 先抽取语义信号。
2. 调用 `buildMemoryRoute()` 选择 active memory expert。
3. `advisorPrompt` 注入两行运行时约束：

```text
│ MEM  preference:98% · recalled memory ...
│ GEP  genes:6 capsules:16 events:20 · latest:EvolutionEvent:...
```

浏览器扩展和 sidecar hook-json 会保留 `MEM/GEP` 行，所以 Codex / Claude / Gemini 的真实输入上下文会被 Memory MoE 影响。

## Verification

```bash
curl -X POST http://127.0.0.1:8787/api/advisor/prepare \
  -H 'content-type: application/json' \
  -d '{"source":"codex","event":"advisor_prepare_test","input":"这次太啰嗦，下次直接给结论并跑检查"}'
```

预期：`advisorPrompt` 包含 `MEM`、`GEP`，`memoryRoute.activeExpert` 会随输入切换。

## One-command Smoke Demo

启动 API 后可以直接跑：

```bash
npm run evomate:smoke
```

它会真实调用：

1. `/health`
2. `/api/hook-events`
3. `/api/advisor/prepare`
4. `/api/feedback`
5. `/api/memory/route`

验收点：

- `advisorPrompt` 必须包含 `MEM` 和 `GEP`。
- `memoryRoute.activeExpert` 必须符合场景预期。
- feedback 必须写入 GEP assets。
- `gepProof` 必须能读到 genes/capsules/events。

可选场景：

```bash
npm run evomate:smoke -- --scenario preference
npm run evomate:smoke -- --scenario validation
npm run evomate:smoke -- --scenario procedural
npm run evomate:smoke -- --scenario repo
```

不写 feedback/GEP，只验证路由和 prompt：

```bash
npm run evomate:smoke -- --no-write
```

默认 smoke 使用 `evomateFastSmoke` 跳过外部 LLM，只验证本地工程闭环，适合现场演示前健康检查。要验证真实 EvoMap LLM 信号抽取：

```bash
npm run evomate:smoke -- --llm
```
