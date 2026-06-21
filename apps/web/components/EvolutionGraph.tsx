'use client';

import { GitBranch, Network, RadioTower, Sparkles, Target, Zap } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchEvolutionHistory, fetchEvolutionState } from '@/lib/evomate-api';
import type { EvolutionHistory, EvolutionState, EvolutionTimelineItem, LiveStatus } from '@/lib/types';

type GraphNodeKind = 'root' | 'hook' | 'signal' | 'gene' | 'outcome' | 'gep' | 'behavior';

type GraphNode = {
  id: string;
  kind: GraphNodeKind;
  label: string;
  detail: string;
  x: number;
  y: number;
  hot?: boolean;
};

type GraphEdge = {
  from: string;
  to: string;
  label?: string;
  hot?: boolean;
};

type GraphModel = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  branches: Array<{ label: string; value: string; tone: 'cyan' | 'mint' | 'amber' | 'red' | 'muted' }>;
  feedbackRules: Array<{ label: string; value: string; tone: 'mint' | 'amber' | 'red' | 'cyan' }>;
};

const graphGenes = [
  { id: 'gene_mcp_first_architecture', name: 'Architect Yes' },
  { id: 'gene_ask_before_execution', name: 'Safe Yes' },
  { id: 'gene_concise_direct_answer', name: 'Fast Yes' },
  { id: 'gene_deep_research_first', name: 'Research Yes' },
  { id: 'gene_visualize_first', name: 'Visual Yes' },
  { id: 'gene_yes_engineer_policy', name: 'Policy Yes' }
];

export function EvolutionGraphPage() {
  const { state, history, status, refresh, lastError } = useEvolutionGraphLive();
  const timeline = (history?.timeline?.length ? history.timeline : state?.timeline ?? []).slice(0, 36);
  const activeGeneId = timeline.find((item) => item.geneId)?.geneId;
  const activeGeneName = graphGenes.find((gene) => gene.id === activeGeneId)?.name ?? 'Architect Yes';
  const yesness = clamp(state?.metrics?.yesnessScore ?? timeline.find((item) => typeof item.score === 'number' && item.geneId)?.score ?? 0.64, 0.02, 0.98);
  const graph = useMemo(() => buildGraphModel(timeline, state, activeGeneName, yesness), [timeline, state, activeGeneName, yesness]);
  const maintainedNodeId = state?.nextStep?.focusNodeId;
  const hotNodeId = graph.nodes.some((node) => node.id === maintainedNodeId) ? maintainedNodeId! : graph.nodes.find((node) => node.hot)?.id ?? 'root';
  const [focusedNodeId, setFocusedNodeId] = useState(hotNodeId);
  const focusedNode = graph.nodes.find((node) => node.id === focusedNodeId) ?? graph.nodes[0];
  const focusedInsight = useMemo(
    () => nodeEvolutionInsight(focusedNode, timeline, state, activeGeneName, yesness),
    [focusedNode, timeline, state, activeGeneName, yesness]
  );

  useEffect(() => {
    setFocusedNodeId(hotNodeId);
  }, [hotNodeId]);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#020307] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(32,230,255,0.14),transparent_32%),radial-gradient(circle_at_70%_68%,rgba(141,255,204,0.09),transparent_34%),linear-gradient(180deg,#020307_0%,#05070d_52%,#020307_100%)]" />
      <div className="graph-grid pointer-events-none fixed inset-0 opacity-25" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#8dffcc]/70 to-transparent" />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-[460px] flex-col px-4 pb-8 pt-4">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#8dffcc]/72">EvoMate mobile graph</p>
            <h1 className="mt-1 text-4xl font-semibold leading-none tracking-[-0.085em] text-white">Evolution Tree</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`rounded-full border px-3 py-1.5 text-xs backdrop-blur-xl ${status === 'live' ? 'border-[#8dffcc]/25 bg-[#8dffcc]/10 text-[#8dffcc]' : status === 'connecting' ? 'border-[#20e6ff]/25 bg-[#20e6ff]/10 text-[#20e6ff]' : 'border-[#ff8b8b]/25 bg-[#ff8b8b]/10 text-[#ffb0b0]'}`}>
              {status}
            </span>
            <button
              onClick={refresh}
              className="rounded-full border border-white/[0.08] bg-white/[0.045] px-3 py-1.5 text-xs text-white/55 backdrop-blur-xl transition hover:border-[#20e6ff]/30 hover:text-[#20e6ff]"
            >
              refresh
            </button>
          </div>
        </header>


        <section className="mt-4 overflow-hidden rounded-[32px] border border-white/[0.07] bg-black/26 p-3 shadow-[0_30px_120px_rgba(0,0,0,0.46)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/28">tap node to inspect</p>
              <p className="mt-1 truncate text-sm text-white/62">
                当前位置：<span className="text-[#20e6ff]">{focusedNode?.label ?? 'User Workflow'}</span>
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/28">{state?.nextStep?.used ? `Claude maintained · ${state.nextStep.model ?? 'EvoMap'}` : state?.nextStep?.enabled ? 'Claude fallback · waiting' : 'Live API · no key fallback'}</p>
            </div>
            <span className="rounded-full border border-[#8dffcc]/14 bg-[#8dffcc]/[0.06] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#8dffcc]/72">
              no autoplay
            </span>
          </div>

          <div className="mt-5 h-[min(54vh,470px)] min-h-[410px] overflow-hidden rounded-[28px]">
            <GraphCanvas graph={graph} expansive focusedNodeId={focusedNodeId} onFocus={setFocusedNodeId} />
          </div>
        </section>

        <EvolutionNodeDetail node={focusedNode} insight={focusedInsight} yesness={yesness} branches={graph.branches} />

        {lastError && (
          <p className="mt-3 rounded-2xl border border-[#ff8b8b]/20 bg-[#ff8b8b]/10 p-3 text-xs leading-5 text-[#ffb0b0] backdrop-blur-xl">
            {lastError}
          </p>
        )}
      </section>
    </main>
  );
}


type NodeInsight = {
  stage: string;
  progressedTo: string;
  evidence: string;
  nextStep: string;
  stageIndex: number;
  event?: EvolutionTimelineItem;
};

const evolutionSteps = ['Hook', 'Signal', 'Gene', 'Reward', 'GEP', 'Next'];

function EvolutionNodeDetail({
  node,
  insight,
  yesness,
  branches
}: {
  node?: GraphNode;
  insight: NodeInsight;
  yesness: number;
  branches: GraphModel['branches'];
}) {
  return (
    <section className="mt-5 rounded-[30px] border border-white/[0.08] bg-[#070b12]/88 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[#8dffcc]/62">展开的进化点</p>
          <h2 className="mt-1 truncate text-2xl font-semibold tracking-[-0.07em] text-white">{node?.label ?? 'User Workflow'}</h2>
          <p className="mt-1 text-xs text-white/38">{insight.stage}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tracking-[-0.08em] text-white">{Math.round(yesness * 100)}%</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#8dffcc]/58">yes pulse</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-6 gap-1.5">
        {evolutionSteps.map((step, index) => {
          const active = index <= insight.stageIndex;
          const current = index === insight.stageIndex;
          return (
            <div key={step} className="min-w-0">
              <div className={`h-1.5 rounded-full ${active ? current ? 'bg-[#20e6ff] shadow-[0_0_14px_rgba(32,230,255,0.7)]' : 'bg-[#8dffcc]/70' : 'bg-white/[0.08]'}`} />
              <p className={`mt-1 truncate text-[9px] ${current ? 'text-[#20e6ff]' : active ? 'text-[#8dffcc]/62' : 'text-white/24'}`}>{step}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-[#20e6ff]/14 bg-[#20e6ff]/[0.045] p-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#20e6ff]/62">进化到哪了</p>
        <p className="mt-1 text-sm font-medium leading-6 text-white">{insight.progressedTo}</p>
      </div>

      <div className="mt-3 grid gap-2">
        <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/28">证据</p>
          <p className="mt-1 line-clamp-3 text-xs leading-5 text-white/52">{insight.evidence}</p>
        </div>
        <div className="rounded-2xl border border-[#8dffcc]/12 bg-[#8dffcc]/[0.035] p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#8dffcc]/58">下一步会怎么变</p>
          <p className="mt-1 text-xs leading-5 text-white/58">{insight.nextStep}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {branches.map((branch) => (
          <div key={branch.label} className="min-w-0 rounded-2xl border border-white/[0.06] bg-black/18 p-3">
            <p className="text-[9px] uppercase tracking-[0.15em] text-white/24">{branch.label}</p>
            <p className={`mt-1 truncate text-xs font-medium ${toneText(branch.tone)}`}>{branch.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function nodeEvolutionInsight(
  node: GraphNode | undefined,
  timeline: EvolutionTimelineItem[],
  state: EvolutionState | null,
  activeGeneName: string,
  yesness: number
): NodeInsight {
  const maintained = state?.nextStep;
  if (maintained && node?.id === maintained.focusNodeId) {
    return {
      stage: maintained.stage,
      stageIndex: maintained.stageIndex,
      progressedTo: maintained.progressedTo,
      evidence: maintained.error ? `${maintained.evidence} · ${maintained.error}` : maintained.evidence,
      nextStep: maintained.nextStep,
      event: timeline.find((item) => item.id === maintained.inputEventId)
    };
  }
  const latest = timeline[0];
  const latestHook = timeline.find(isHookEvent);
  const latestOutcome = timeline.find((item) => /policy_reward|gep_assets_written|outcome|feedback/i.test(item.type));
  const latestGep = timeline.find((item) => /gep_assets_written|remote_job_imported/i.test(item.type));
  const latestGene = timeline.find((item) => item.geneId);
  const signal = strongestSignal(timeline);
  const reward = latestOutcome?.score ?? state?.metrics?.averageReward ?? yesness;
  const mutation = mutationFromTimeline(timeline);

  if (!node || node.kind === 'root') {
    return {
      stage: '全局工作流',
      stageIndex: 0,
      progressedTo: `已经收集 ${timeline.length || 0} 条事件，正在把用户工作流合成一条可进化链路。`,
      evidence: latest?.summary ?? '还没有事件，等待手机 / 浏览器 / Codex hook 写入。',
      nextStep: '下一条 hook 进来后，会重新定位到对应进化点，并刷新下面的基因、奖励和 GEP 资产。',
      event: latest
    };
  }

  if (node.kind === 'hook') {
    return {
      stage: '1 / 6 · 捕获输入',
      stageIndex: 0,
      progressedTo: `${node.label} 已被捕获，作为这次进化的入口事件。`,
      evidence: latestHook?.summary ?? '等待手机 share sheet、网页 AI 聊天或本地 agent 写入 hook。',
      nextStep: '把原始事件归一化成 signal：来源、行为类型、用户语气、是否需要修正。',
      event: latestHook
    };
  }

  if (node.kind === 'signal') {
    return {
      stage: '2 / 6 · 提取信号',
      stageIndex: 1,
      progressedTo: `最强信号是 ${signal.label}，已进入行为策略选择。`,
      evidence: signal.detail,
      nextStep: '策略层会根据这个 signal 选择当前最适合用户的行为基因。'
    };
  }

  if (node.kind === 'gene') {
    return {
      stage: '3 / 6 · 选择行为基因',
      stageIndex: 2,
      progressedTo: `当前选择 ${activeGeneName}，让 Agent 按这个用户偏好的方式行动。`,
      evidence: latestGene?.summary ?? node.detail,
      nextStep: '执行结果会被用户反馈、命令成败或上下文变化打分，作为下一轮进化奖励。',
      event: latestGene
    };
  }

  if (node.kind === 'outcome') {
    return {
      stage: '4 / 6 · 反馈打分',
      stageIndex: 3,
      progressedTo: `这轮奖励约 ${Math.round(clamp(reward, 0, 1) * 100)}%，系统知道这次 Yes 是否命中。`,
      evidence: latestOutcome?.summary ?? '等待显式反馈或工具执行结果。',
      nextStep: '低分会触发修正 mutation；高分会强化当前行为基因。',
      event: latestOutcome
    };
  }

  if (node.kind === 'gep') {
    return {
      stage: '5 / 6 · 写入 EvoMap/GEP',
      stageIndex: 4,
      progressedTo: latestGep ? 'Mutation / EvolutionEvent 已写入 GEP，形成可复用的进化资产。' : '还没有写入 GEP，正在等待足够强的反馈或 outcome。',
      evidence: latestGep?.summary ?? 'GEP asset pending。',
      nextStep: '下次相似场景会召回这份资产，而不是重新从零猜用户偏好。',
      event: latestGep
    };
  }

  return {
    stage: '6 / 6 · 下一次行为改变',
    stageIndex: 5,
    progressedTo: `下一次行为会变成：${mutation}。`,
    evidence: latestGep?.summary ?? latestOutcome?.summary ?? node.detail,
    nextStep: 'Agent 下次遇到相同模式，会先应用这条 mutation，再组织回答或执行工具。',
    event: latestGep ?? latestOutcome
  };
}


function useEvolutionGraphLive() {
  const [state, setState] = useState<EvolutionState | null>(null);
  const [history, setHistory] = useState<EvolutionHistory | null>(null);
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextState, nextHistory] = await Promise.all([
        fetchEvolutionState(),
        fetchEvolutionHistory(40, true)
      ]);
      setState(nextState);
      setHistory(nextHistory);
      setStatus('live');
      setLastError(null);
    } catch (error) {
      setStatus('offline');
      setLastError(error instanceof Error ? error.message : String(error));
    }
  }, []);


  useEffect(() => {
    let cancelled = false;
    async function tick() {
      if (!cancelled) await refresh();
    }
    tick();
    const timer = window.setInterval(tick, 1600);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refresh]);

  return { state, history, status, lastError, refresh };
}

export function EvolutionGraph({
  timeline,
  state,
  activeGeneName,
  yesness
}: {
  timeline: EvolutionTimelineItem[];
  state: EvolutionState | null;
  activeGeneName: string;
  yesness: number;
}) {
  const graph = useMemo(() => buildGraphModel(timeline, state, activeGeneName, yesness), [timeline, state, activeGeneName, yesness]);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));

  return (
    <section className="mt-4 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#070b12]/88 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[#8dffcc]/24 bg-[#8dffcc]/10 text-[#8dffcc]">
              <Network className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-[-0.04em] text-white">Evolution Tree</h2>
              <p className="text-[11px] text-white/36">Obsidian-style lineage · hook → mutation → next behavior</p>
            </div>
          </div>
        </div>
        <span className="rounded-full border border-[#20e6ff]/18 bg-[#20e6ff]/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#20e6ff]/72">
          gep graph
        </span>
      </div>

      <div className="relative mt-4 h-[330px] overflow-hidden rounded-[26px] border border-white/[0.06] bg-black/24">
        <div className="graph-grid absolute inset-0 opacity-45" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="evomateGraphEdge" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(32,230,255,0.72)" />
              <stop offset="100%" stopColor="rgba(141,255,204,0.72)" />
            </linearGradient>
          </defs>
          {graph.edges.map((edge) => {
            const from = byId.get(edge.from);
            const to = byId.get(edge.to);
            if (!from || !to) return null;
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className={edge.hot ? 'evomate-graph-edge-hot' : 'evomate-graph-edge'}
                />
                {edge.label && (
                  <text
                    x={(from.x + to.x) / 2}
                    y={(from.y + to.y) / 2 - 1}
                    className="fill-white/28 text-[2.5px] uppercase tracking-[0.16em]"
                    textAnchor="middle"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {graph.nodes.map((node) => (
          <GraphNodeView key={node.id} node={node} />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {graph.branches.map((branch) => (
          <div key={branch.label} className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
            <p className="text-[9px] uppercase tracking-[0.16em] text-white/26">{branch.label}</p>
            <p className={`mt-1 truncate text-xs ${toneText(branch.tone)}`}>{branch.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-2xl border border-[#8dffcc]/12 bg-[#8dffcc]/[0.035] p-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[#8dffcc]/66">feedback contract</p>
        <div className="mt-2 grid gap-2">
          {graph.feedbackRules.map((rule) => (
            <div key={rule.label} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-black/18 px-3 py-2">
              <span className="text-xs text-white/48">{rule.label}</span>
              <span className={`text-xs font-medium ${toneText(rule.tone)}`}>{rule.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GraphNodeView({ node, focused = false, onFocus }: { node: GraphNode; focused?: boolean; onFocus?: (nodeId: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onFocus?.(node.id)}
      className={`evomate-graph-node absolute text-left ${node.hot ? 'evomate-graph-node-hot' : ''} ${focused ? 'evomate-graph-node-focused' : ''} ${nodeKindClass(node.kind)}`}
      style={{ left: `${node.x}%`, top: `${node.y}%`, '--graph-node-x': `${node.x}%`, '--graph-node-y': `${node.y}%` } as CSSProperties}
      aria-label={`focus ${node.label}`}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] [&>svg]:h-3.5 [&>svg]:w-3.5">
          {nodeIcon(node.kind)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold tracking-[-0.03em] text-white">{node.label}</p>
          <p className="mt-0.5 truncate text-[9px] text-white/36">{node.detail}</p>
        </div>
      </div>
    </button>
  );
}

function GraphCanvas({
  graph,
  expansive = false,
  focusedNodeId,
  onFocus
}: {
  graph: GraphModel;
  expansive?: boolean;
  focusedNodeId?: string;
  onFocus?: (nodeId: string) => void;
}) {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const focused = graph.nodes.find((node) => node.id === focusedNodeId) ?? graph.nodes[0];
  const cameraStyle = expansive && focused
    ? {
        transform: `translate3d(${(50 - focused.x) * 0.62}%, ${(50 - focused.y) * 0.52}%, 0) scale(0.98)`,
        transformOrigin: `${focused.x}% ${focused.y}%`
      }
    : undefined;

  return (
    <div className={`relative overflow-hidden border border-white/[0.06] bg-black/24 ${expansive ? 'evomate-graph-compact h-full rounded-[34px]' : 'mt-4 h-[330px] rounded-[26px]'}`}>
      <div className="graph-grid absolute inset-0 opacity-45" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(141,255,204,0.08),transparent_36%)]" />
      <div className="evomate-graph-camera absolute inset-0" style={cameraStyle}>
        {expansive && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#8dffcc]/10 bg-[#8dffcc]/[0.018] shadow-[0_0_160px_rgba(32,230,255,0.16),inset_0_0_120px_rgba(141,255,204,0.035)]" />
        )}
        {focused && (
          <div
            className="evomate-graph-focus-lens pointer-events-none absolute h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#20e6ff]/28"
            style={{ left: `${focused.x}%`, top: `${focused.y}%` }}
          />
        )}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="evomateGraphEdge" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(32,230,255,0.72)" />
              <stop offset="100%" stopColor="rgba(141,255,204,0.72)" />
            </linearGradient>
          </defs>
          {graph.edges.map((edge) => {
            const from = byId.get(edge.from);
            const to = byId.get(edge.to);
            if (!from || !to) return null;
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className={edge.hot ? 'evomate-graph-edge-hot' : 'evomate-graph-edge'}
                />
                {edge.label && !expansive && (
                  <text
                    x={(from.x + to.x) / 2}
                    y={(from.y + to.y) / 2 - 1}
                    textAnchor="middle"
                    style={{
                      fill: 'rgba(255,255,255,0.17)',
                      fontSize: expansive ? 1.15 : 1.6,
                      fontWeight: 700,
                      letterSpacing: expansive ? 0.62 : 0.3
                    }}
                  >
                    {edge.label.toUpperCase()}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {graph.nodes.map((node) => (
          <GraphNodeView key={node.id} node={node} focused={node.id === focused?.id} onFocus={onFocus} />
        ))}
      </div>
    </div>
  );
}

function buildGraphModel(timeline: EvolutionTimelineItem[], state: EvolutionState | null, activeGeneName: string, yesness: number): GraphModel {
  const latestHook = timeline.find(isHookEvent);
  const latestOutcome = timeline.find((item) => /policy_reward|gep_assets_written|outcome|feedback/i.test(item.type));
  const latestGep = timeline.find((item) => /gep_assets_written|remote_job_imported/i.test(item.type));
  const latestGene = timeline.find((item) => item.geneId)?.geneId;
  const source = sourceLabel(latestHook);
  const signal = strongestSignal(timeline);
  const hot = isFresh(latestHook);
  const reward = latestOutcome?.score ?? state?.metrics?.averageReward ?? yesness;
  const mutationLabel = mutationFromTimeline(timeline);

  const nodes: GraphNode[] = [
    { id: 'root', kind: 'root', label: 'User Workflow', detail: `${timeline.length || 0} live events`, x: 50, y: 51, hot },
    { id: 'hook', kind: 'hook', label: source.title, detail: source.detail, x: 18, y: 35, hot },
    { id: 'signal', kind: 'signal', label: signal.label, detail: signal.detail, x: 34, y: 17, hot },
    { id: 'gene', kind: 'gene', label: activeGeneName, detail: latestGene ? latestGene.replace(/^gene_/, '').replace(/_/g, ' ') : 'selected behavior gene', x: 66, y: 17, hot: Boolean(latestGene && hot) },
    { id: 'outcome', kind: 'outcome', label: rewardLabel(reward), detail: outcomeDetail(latestOutcome), x: 83, y: 45, hot: isFresh(latestOutcome) },
    { id: 'gep', kind: 'gep', label: latestGep ? 'GEP Asset Written' : 'GEP Memory', detail: latestGep ? compactSummary(latestGep.summary) : 'waiting for mutation/capsule', x: 65, y: 80, hot: isFresh(latestGep) },
    { id: 'behavior', kind: 'behavior', label: 'Next Behavior', detail: mutationLabel, x: 33, y: 80, hot: isFresh(latestOutcome) || isFresh(latestGep) }
  ];

  const edges: GraphEdge[] = [
    { from: 'hook', to: 'root', label: 'observes', hot },
    { from: 'root', to: 'signal', label: 'extracts', hot },
    { from: 'signal', to: 'gene', label: 'selects', hot },
    { from: 'gene', to: 'outcome', label: 'acts', hot: isFresh(latestOutcome) },
    { from: 'outcome', to: 'gep', label: 'scores', hot: isFresh(latestOutcome) || isFresh(latestGep) },
    { from: 'gep', to: 'behavior', label: 'mutates', hot: isFresh(latestGep) },
    { from: 'behavior', to: 'root', label: 'next', hot: isFresh(latestGep) }
  ];

  return {
    nodes,
    edges,
    branches: [
      { label: 'latest source', value: source.title, tone: source.tone },
      { label: 'strong signal', value: signal.label, tone: signal.tone },
      { label: 'reward', value: `${Math.round(clamp(reward, 0, 1) * 100)}% yes`, tone: reward >= 0.66 ? 'mint' : reward <= 0.4 ? 'red' : 'amber' },
      { label: 'mutation', value: mutationLabel, tone: latestGep ? 'mint' : 'muted' }
    ],
    feedbackRules: feedbackRulesFor(timeline)
  };
}

function feedbackRulesFor(timeline: EvolutionTimelineItem[]): GraphModel['feedbackRules'] {
  const terminalFailed = timeline.some((item) => /terminal_command|command_failed/i.test(`${item.summary} ${(item.signals || []).join(' ')}`));
  const gitChanged = timeline.some((item) => /git_activity|local-agent:git/i.test(`${item.summary} ${(item.signals || []).join(' ')}`));
  const explicit = timeline.some((item) => /policy_reward|手机端反馈|feedback|accepted|rejected|corrected|interrupted/i.test(item.summary + item.type));
  return [
    { label: 'Explicit buttons', value: explicit ? 'highest reward signal' : 'waiting', tone: explicit ? 'mint' : 'cyan' },
    { label: 'Terminal result', value: terminalFailed ? 'failure → mutation' : 'success/failure ready', tone: terminalFailed ? 'red' : 'amber' },
    { label: 'Git workspace', value: gitChanged ? 'context attached' : 'watching repo', tone: gitChanged ? 'mint' : 'cyan' }
  ];
}

function sourceLabel(event?: EvolutionTimelineItem): { title: string; detail: string; tone: 'cyan' | 'mint' | 'amber' | 'red' | 'muted' } {
  const text = `${event?.summary || ''} ${(event?.signals || []).join(' ')}`.toLowerCase();
  if (/terminal|command/.test(text)) return { title: 'Terminal', detail: 'command result hook', tone: 'amber' };
  if (/git/.test(text)) return { title: 'Git Workspace', detail: 'repo context hook', tone: 'mint' };
  if (/local-agent|active_window|desktop/.test(text)) return { title: 'Local Agent', detail: 'mac workflow hook', tone: 'mint' };
  if (/gemini/.test(text)) return { title: 'Gemini', detail: 'browser AI hook', tone: 'cyan' };
  if (/chatgpt/.test(text)) return { title: 'ChatGPT', detail: 'browser AI hook', tone: 'cyan' };
  if (/codex/.test(text)) return { title: 'Codex', detail: 'coding agent hook', tone: 'cyan' };
  if (/mobile/.test(text)) return { title: 'Mobile', detail: 'phone share hook', tone: 'cyan' };
  return { title: 'Hook Event', detail: event ? compactSummary(event.summary) : 'waiting for workflow signal', tone: 'muted' };
}

function strongestSignal(timeline: EvolutionTimelineItem[]) {
  const signals = timeline.flatMap((item) => item.signals || []);
  const priority = [
    'command_failed',
    'terminal_command',
    'git_activity',
    'active_window',
    'browser_extension',
    'coding_task',
    'local_agent',
    'hook_tool_use',
    'hook_assistant_message'
  ];
  const signal = priority.find((candidate) => signals.includes(candidate)) || signals.find(Boolean) || 'awaiting_signal';
  const label = signal.replace(/^hook_/, '').replace(/_/g, ' ');
  return {
    label: titleCase(label),
    detail: signal === 'awaiting_signal' ? 'no signal yet' : 'normalized semantic signal',
    tone: signal.includes('failed') ? 'red' as const : signal.includes('git') || signal.includes('local') ? 'mint' as const : 'cyan' as const
  };
}

function mutationFromTimeline(timeline: EvolutionTimelineItem[]) {
  const failed = timeline.some((item) => /command_failed|failed|rejected/i.test(`${item.summary} ${(item.signals || []).join(' ')}`));
  const git = timeline.some((item) => /git_activity|local-agent:git/i.test(`${item.summary} ${(item.signals || []).join(' ')}`));
  const concise = timeline.some((item) => /too conservative|太保守|interrupted/i.test(item.summary));
  if (failed) return 'increase validate-before-reply';
  if (git) return 'attach workspace context';
  if (concise) return 'move faster next turn';
  return 'update gene weights';
}

function rewardLabel(score?: number) {
  if (typeof score !== 'number') return 'Reward Pending';
  if (score >= 0.66) return 'Positive Reward';
  if (score <= 0.4) return 'Correction Signal';
  return 'Weak Signal';
}

function outcomeDetail(event?: EvolutionTimelineItem) {
  if (!event) return 'implicit/explicit feedback';
  return compactSummary(event.summary);
}

function isHookEvent(event?: EvolutionTimelineItem): event is EvolutionTimelineItem {
  return Boolean(event && ['hook_received', 'omni_hook_received'].includes(event.type));
}

function isFresh(event?: EvolutionTimelineItem, windowMs = 30000) {
  if (!event) return false;
  const time = new Date(event.createdAt).getTime();
  return Number.isFinite(time) && Date.now() - time < windowMs;
}

function compactSummary(value: string) {
  return value.length > 42 ? `${value.slice(0, 39)}…` : value;
}

function nodeKindClass(kind: GraphNodeKind) {
  const map: Record<GraphNodeKind, string> = {
    root: 'border-[#8dffcc]/34 bg-[#8dffcc]/[0.105] text-[#8dffcc] min-w-[132px]',
    hook: 'border-[#20e6ff]/30 bg-[#20e6ff]/[0.09] text-[#20e6ff]',
    signal: 'border-[#20e6ff]/22 bg-[#0b2b38]/70 text-[#20e6ff]',
    gene: 'border-[#8dffcc]/25 bg-[#0e2f24]/74 text-[#8dffcc]',
    outcome: 'border-[#ffd166]/26 bg-[#332711]/74 text-[#ffd166]',
    gep: 'border-[#d7a7ff]/28 bg-[#221433]/74 text-[#d7a7ff]',
    behavior: 'border-white/16 bg-white/[0.07] text-white'
  };
  return map[kind];
}

function nodeIcon(kind: GraphNodeKind): ReactNode {
  if (kind === 'hook') return <RadioTower />;
  if (kind === 'signal') return <Target />;
  if (kind === 'gene') return <GitBranch />;
  if (kind === 'outcome') return <Zap />;
  if (kind === 'gep') return <Sparkles />;
  if (kind === 'behavior') return <Network />;
  return <Sparkles />;
}

function toneText(tone: 'cyan' | 'mint' | 'amber' | 'red' | 'muted') {
  const map = {
    cyan: 'text-[#20e6ff]',
    mint: 'text-[#8dffcc]',
    amber: 'text-[#ffd166]',
    red: 'text-[#ff8b8b]',
    muted: 'text-white/45'
  };
  return map[tone];
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clock(input?: string) {
  if (!input) return '--:--';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
