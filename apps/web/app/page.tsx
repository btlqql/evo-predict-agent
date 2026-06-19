'use client';

import { motion } from 'framer-motion';
import {
  Activity,
  BadgeCheck,
  Bot,
  Check,
  ChevronRight,
  CircuitBoard,
  ClipboardList,
  Copy,
  Cpu,
  Dna,
  Gauge,
  GitBranch,
  Layers3,
  Network,
  PlugZap,
  RadioTower,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  ThumbsDown,
  ThumbsUp,
  Zap
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

type SourceMode = 'api' | 'demo';

type AnalyzeResult = {
  geneId: string;
  yesness: number;
  previousYesness: number;
  signals: string[];
  taskType: string;
  riskLevel: string;
  semantic: SemanticResult;
  source: SourceMode;
  llmUsed: boolean;
  llmIntent: string;
  llmConfidence: number | null;
};

type SemanticResult = {
  taskType: string;
  intent: string;
  riskLevel: string;
  permissionMode: string;
  userTone: string;
  workstyleSignals: string[];
  domainSignals: string[];
  toolNeeds: string[];
  feedbackSemantics: {
    sentiment: string;
    correctionType?: string;
    rewardHint: number;
  } | null;
  signals: string[];
  confidence: number;
};

type RewardResult = {
  value: number;
  yesness: number;
  source: SourceMode;
};

type RemoteJob = {
  jobId: string;
  type: string;
  status: string;
  objective: string;
  createdAt: string;
  updatedAt: string;
  artifactSummary?: {
    generatedFiles?: string[];
    validationScore?: number;
    suggestedMutationCount?: number;
    evolutionBundleId?: string;
  };
  target?: { host?: string; port?: number; user?: string; executeRemote?: boolean };
  remotePlan?: { bootstrap?: string[]; sync?: string[]; submit?: string[]; import?: string[] };
};

type GepAsset = {
  type: string;
  id: string;
  asset_id?: string;
};

type GeneTuple = [label: string, id: string, score: number, body: string, mode: string, inject: string];

const API_URL = process.env.NEXT_PUBLIC_EVOMATE_API_URL || 'http://localhost:8787';
const starterEvent = 'Codex session: 用户让我看这个仓库，强调“先别乱动代码”，目标是接入 EvoMap/GEP 和机器学习。';

const genes: GeneTuple[] = [
  ['Safe Yes', 'gene_ask_before_execution', 0.86, '先分析、确认权限，再允许 Codex/Claude Code 执行高风险动作。', 'Guarded execution', 'Inject: analyze first, no file edits until explicit confirmation.'],
  ['Fast Yes', 'gene_concise_direct_answer', 0.78, '用户要快速推进时，压缩解释，直接给下一步和可执行操作。', 'Low-friction progress', 'Inject: answer in concise execution-first bullets.'],
  ['Architect Yes', 'gene_mcp_first_architecture', 0.88, '把 MCP、EvoMap 和 worker 分层讲清楚，再让执行工具按架构落地。', 'System design', 'Inject: show architecture before implementation.'],
  ['Research Yes', 'gene_deep_research_first', 0.72, '遇到外部产品或不确定事实，先查证，再给结论。', 'Evidence first', 'Inject: verify sources before deciding.'],
  ['Visual Yes', 'gene_visualize_first', 0.76, '路演和复杂架构优先可视化，让进化过程一眼可懂。', 'Visual explanation', 'Inject: produce diagram/dashboard first.'],
  ['Policy Yes', 'gene_yes_engineer_policy', 0.8, '根据反馈在线学习这个用户的协作偏好，并写成 GEP 资产。', 'Adaptive behavior', 'Inject: choose behavior through policy engine.']
];

const defaultResult: AnalyzeResult = {
  geneId: 'gene_ask_before_execution',
  yesness: 0.864,
  previousYesness: 0.841,
  signals: ['coding_task', 'permission_sensitive', 'evomap_integration', 'ml_policy'],
  taskType: 'coding',
  riskLevel: 'medium',
  semantic: {
    taskType: 'coding',
    intent: 'analysis_before_execution',
    riskLevel: 'medium',
    permissionMode: 'ask_before_editing',
    userTone: 'cautious',
    workstyleSignals: ['prefers_analysis_before_execution'],
    domainSignals: ['evomap', 'ml_policy'],
    toolNeeds: ['repo_inspection', 'mcp_host_integration'],
    feedbackSemantics: null,
    signals: ['coding_task', 'permission_sensitive', 'evomap_integration', 'ml_policy'],
    confidence: 0.76
  },
  source: 'demo',
  llmUsed: false,
  llmIntent: 'analysis_before_execution',
  llmConfidence: 0.76
};

const defaultAssets: GepAsset[] = [
  { type: 'Mutation', id: 'mut_pending_policy_weight_delta' },
  { type: 'EvolutionEvent', id: 'evt_pending_agent_feedback' },
  { type: 'Capsule', id: 'waiting_for_3_successful_rewards' }
];

export default function Page() {
  const [eventText, setEventText] = useState(starterEvent);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<AnalyzeResult>(defaultResult);
  const [reward, setReward] = useState<RewardResult | null>(null);
  const [assets, setAssets] = useState<GepAsset[]>(defaultAssets);
  const [remoteJob, setRemoteJob] = useState<RemoteJob | null>(null);
  const [remoteJobs, setRemoteJobs] = useState<RemoteJob[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [timeline, setTimeline] = useState([
    'Codex session observed: user requested read-only repo analysis.',
    'Policy selected Safe Yes before agent execution.',
    'Next feedback will write Mutation + EvolutionEvent into GEP.'
  ]);

  const activeGene = useMemo(() => genes.find((gene) => gene[1] === result.geneId) ?? genes[0], [result.geneId]);
  const delta = result.yesness - result.previousYesness;

  async function observeEvent() {
    setLoading(true);
    setReward(null);
    const previousYesness = result.yesness;
    try {
      const res = await fetch(`${API_URL}/api/interactions/analyze`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: eventText })
      });
      if (!res.ok) throw new Error('api unavailable');
      const data = await res.json();
      const semantic = normalizeSemantic(data.semantic ?? data.signal?.semantic, {
        signals: data.signal?.signals || [],
        taskType: data.signal?.taskType || 'general',
        riskLevel: data.signal?.riskLevel || 'low'
      });
      const next: AnalyzeResult = {
        geneId: data.gene?.id || data.policyDecision?.selectedGene?.id || 'gene_ask_before_execution',
        yesness: data.policyDecision?.predictedYesness || data.predictedSatisfaction || 0.82,
        previousYesness,
        signals: data.signal?.signals || semantic.signals,
        taskType: data.signal?.taskType || semantic.taskType,
        riskLevel: data.signal?.riskLevel || semantic.riskLevel,
        semantic,
        source: 'api',
        llmUsed: Boolean(data.signalExtraction?.llm?.used),
        llmIntent: data.signalExtraction?.llm?.intent || semantic.intent,
        llmConfidence: typeof data.signalExtraction?.llm?.confidence === 'number' ? data.signalExtraction.llm.confidence : semantic.confidence
      };
      setResult(next);
      addTimeline(`Observed ${next.taskType} event → selected ${next.geneId}.`);
    } catch {
      const next = mockAnalyze(eventText, previousYesness);
      setResult(next);
      addTimeline(`Demo observer selected ${next.geneId}.`);
    } finally {
      setLoading(false);
    }
  }

  async function submitRemoteJob() {
    setRemoteLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/remote-jobs/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'evolution_gym_eval',
          objective: 'Full remote evolution prototype: evaluate behavior policy, produce ValidationReport and EvolutionBundle.',
          source: 'control_plane',
          executeRemote: false
        })
      });
      if (!res.ok) throw new Error('remote job api unavailable');
      const data = await res.json();
      setRemoteJob(data.job);
      setRemoteJobs((current) => [data.job, ...current.filter((job) => job.jobId !== data.job.jobId)].slice(0, 4));
      addTimeline(`Remote job ${data.job.jobId} queued in ${data.mode} mode.`);
    } catch {
      const mock = mockRemoteJob();
      setRemoteJob(mock);
      setRemoteJobs((current) => [mock, ...current].slice(0, 4));
      addTimeline('Demo remote compute job queued locally.');
    } finally {
      setRemoteLoading(false);
    }
  }

  async function importRemoteArtifacts() {
    if (!remoteJob) return;
    setRemoteLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/remote-jobs/${encodeURIComponent(remoteJob.jobId)}/import`, { method: 'POST' });
      if (!res.ok) throw new Error('remote import unavailable');
      const data = await res.json();
      setRemoteJob(data.job);
      setRemoteJobs((current) => [data.job, ...current.filter((job) => job.jobId !== data.job.jobId)].slice(0, 4));
      const artifactAssets = remoteArtifactsToAssets(data.artifacts);
      if (artifactAssets.length) setAssets(artifactAssets);
      addTimeline(`Imported ${data.job.artifactSummary?.evolutionBundleId || data.job.jobId} from remote compute.`);
    } catch {
      const imported = {
        ...remoteJob,
        status: 'imported',
        artifactSummary: {
          generatedFiles: ['policy_eval.json', 'validation_report.json', 'suggested_mutations.json', 'evolution_bundle.json'],
          validationScore: 0.78,
          suggestedMutationCount: 2,
          evolutionBundleId: `bundle_${remoteJob.jobId}`
        }
      };
      setRemoteJob(imported);
      setAssets([
        { type: 'ValidationReport', id: `val_${remoteJob.jobId}`, asset_id: 'remote:prototype' },
        { type: 'Mutation', id: `mut_${remoteJob.jobId}_policy`, asset_id: 'remote:prototype' },
        { type: 'EvolutionBundle', id: `bundle_${remoteJob.jobId}`, asset_id: 'remote:prototype' }
      ]);
      addTimeline(`Demo imported EvolutionBundle for ${remoteJob.jobId}.`);
    } finally {
      setRemoteLoading(false);
    }
  }

  async function refreshRemoteJobs() {
    setRemoteLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/remote-jobs`);
      if (!res.ok) throw new Error('remote list unavailable');
      const data = await res.json();
      setRemoteJobs(data.jobs || []);
      if (!remoteJob && data.jobs?.[0]) setRemoteJob(data.jobs[0]);
      addTimeline(`Remote queue refreshed: ${data.jobs?.length || 0} job(s).`);
    } catch {
      addTimeline('Remote queue refresh fell back to local demo state.');
    } finally {
      setRemoteLoading(false);
    }
  }

  async function recordFeedback(kind: 'accepted' | 'corrected' | 'interrupted') {
    const feedbackText = kind === 'accepted'
      ? '用户继续推进，说明这次行为策略命中。'
      : kind === 'corrected'
        ? '用户纠正：不是这个意思，需要调整协作方式。'
        : '用户打断：Agent 行为摩擦过高，需要降权。';

    try {
      const res = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind,
          text: feedbackText,
          geneId: result.geneId,
          signals: result.signals
        })
      });
      if (!res.ok) throw new Error('api unavailable');
      const data = await res.json();
      const nextReward: RewardResult = { value: data.reward.reward, yesness: data.reward.yesness, source: 'api' };
      setReward(nextReward);
      setResult((current) => ({
        ...current,
        previousYesness: current.yesness,
        yesness: data.state?.metrics?.yesnessScore ?? data.reward.yesness,
        source: 'api'
      }));
      setAssets(data.gepAssets?.written?.length ? data.gepAssets.written : defaultAssets);
      addTimeline(`Feedback ${kind} → GEP wrote ${data.gepAssets?.written?.map((asset: GepAsset) => asset.type).join(' + ') || 'assets'}.`);
    } catch {
      const value = kind === 'accepted' ? 0.92 : kind === 'corrected' ? -0.45 : -0.76;
      const nextReward: RewardResult = { value, yesness: (value + 1) / 2, source: 'demo' };
      setReward(nextReward);
      setResult((current) => ({ ...current, previousYesness: current.yesness, yesness: clamp(current.yesness * 0.76 + nextReward.yesness * 0.24, 0.06, 0.98), source: 'demo' }));
      setAssets([
        { type: 'Mutation', id: `mut_demo_${kind}_policy_delta`, asset_id: 'sha256:demo' },
        { type: 'EvolutionEvent', id: `evt_demo_${kind}_agent_feedback`, asset_id: 'sha256:demo' }
      ]);
      addTimeline(`Demo feedback ${kind} updated behavior genome.`);
    }
  }

  function addTimeline(text: string) {
    setTimeline((current) => [text, ...current].slice(0, 6));
  }

  async function copyEvent() {
    await navigator.clipboard.writeText(eventText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      <SubtleBackground />
      <TopRail source={result.source} />

      <section className="relative z-10 mx-auto max-w-[1480px] px-5 pb-8 pt-5 lg:px-8">
        <div className="grid min-h-[calc(100vh-92px)] min-w-0 gap-4 sm:gap-5 xl:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)_360px]">
          <aside className="flex min-w-0 flex-col gap-5">
            <ControlPlaneCard yesness={result.yesness} delta={delta} />
            <AgentSessionCard
              eventText={eventText}
              setEventText={setEventText}
              copied={copied}
              copyEvent={copyEvent}
              loading={loading}
              observeEvent={observeEvent}
              recordFeedback={recordFeedback}
            />
          </aside>

          <main className="flex min-w-0 flex-col gap-5">
            <HeroPanel result={result} activeGene={activeGene} reward={reward} delta={delta} />
            <RuntimePipeline result={result} activeGene={activeGene} assets={assets} />
          </main>

          <aside className="flex min-w-0 flex-col gap-5 xl:col-span-2 2xl:col-span-1">
            <BehaviorControlPanel activeGeneId={result.geneId} />
            <GepAssetStream assets={assets} reward={reward} />
            <RemoteComputePanel
              job={remoteJob}
              jobs={remoteJobs}
              loading={remoteLoading}
              onSubmit={submitRemoteJob}
              onImport={importRemoteArtifacts}
              onRefresh={refreshRemoteJobs}
            />
            <TimelinePanel timeline={timeline} />
          </aside>
        </div>
      </section>
    </main>
  );
}

function TopRail({ source }: { source: SourceMode }) {
  return (
    <header className="relative z-20 border-b border-white/[0.07] bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-5 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
            <Dna className="h-5 w-5 text-[#19e6ff]" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[-0.03em]">EvoMate Control Plane</p>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/35">for Codex / Claude Code / MCP agents</p>
          </div>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {['Agent Event', 'Signal Extractor', 'Policy Engine', 'Advisor Injection', 'GEP Ledger'].map((item, index) => (
            <div key={item} className="flex items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-white/55">{item}</span>
              {index < 4 && <ChevronRight className="h-3.5 w-3.5 text-white/18" />}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className={`h-2 w-2 rounded-full ${source === 'api' ? 'bg-[#83f3b1]' : 'bg-[#f7ce6a]'}`} />
          <span className="text-sm text-white/55">{source === 'api' ? 'Live Orchestrator' : 'Demo Observer'}</span>
        </div>
      </div>
    </header>
  );
}

function ControlPlaneCard({ yesness, delta }: { yesness: number; delta: number }) {
  return (
    <section className="min-w-0 rounded-[28px] border border-white/[0.08] bg-[#070707]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between">
        <span className="rounded-full border border-[#19e6ff]/25 bg-[#19e6ff]/10 px-3 py-1 text-xs text-[#19e6ff]">Agent evolution layer</span>
        <Network className="h-5 w-5 text-white/35" />
      </div>
      <h1 className="mt-8 text-[34px] font-semibold leading-[0.98] tracking-[-0.075em] text-white sm:text-[40px]">
        Don&apos;t replace<br />your agent.<br /><span className="text-[#19e6ff]">Teach it.</span>
      </h1>
      <p className="mt-5 text-sm leading-6 text-white/45">
        EvoMate 不做另一个聊天框；在 Codex / Claude Code 的会话，把用户反馈转成行为进化和 GEP 资产。
      </p>
      <div className="mt-7 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/35">Current Yesness</p>
            <p className="mt-1 text-4xl font-semibold tracking-[-0.05em] text-[#19e6ff]">{(yesness * 100).toFixed(1)}%</p>
          </div>
          <div className="text-right">
            <Gauge className="ml-auto h-8 w-8 text-[#19e6ff]/70" />
            <p className={`mt-2 text-sm ${delta >= 0 ? 'text-[#83f3b1]' : 'text-[#ff7d7d]'}`}>{delta >= 0 ? '+' : ''}{(delta * 100).toFixed(1)}%</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function AgentSessionCard({
  eventText,
  setEventText,
  copied,
  copyEvent,
  loading,
  observeEvent,
  recordFeedback
}: {
  eventText: string;
  setEventText: (value: string) => void;
  copied: boolean;
  copyEvent: () => void;
  loading: boolean;
  observeEvent: () => void;
  recordFeedback: (kind: 'accepted' | 'corrected' | 'interrupted') => void;
}) {
  return (
    <section className="min-w-0 rounded-[28px] border border-white/[0.08] bg-[#070707]/90 p-5">
      <PanelHeader icon={<TerminalSquare />} title="Live Agent Session" subtitle="observer mode" />
      <div className="mt-5 grid gap-3">
        <SessionRow label="Source" value="Codex CLI" status="observed" />
        <SessionRow label="Workspace" value="evo-predict-agent" status="local" />
        <SessionRow label="Mode" value="Advisor injection" status="next-run" />
      </div>
      <label className="mt-5 block text-xs uppercase tracking-[0.22em] text-white/32">Simulate / paste agent event</label>
      <textarea
        value={eventText}
        onChange={(event) => setEventText(event.target.value)}
        className="mt-2 min-h-[132px] w-full resize-none rounded-2xl border border-white/[0.1] bg-[#161616] p-4 text-sm leading-6 text-white/72 outline-none transition focus:border-[#19e6ff]/45"
      />
      <div className="mt-3 grid grid-cols-[1fr_46px] gap-2">
        <button
          type="button"
          onClick={observeEvent}
          className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-white/90"
        >
          {loading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <RadioTower className="h-4 w-4" />}
          Observe Event
        </button>
        <button
          type="button"
          onClick={copyEvent}
          className="flex items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.035] text-[#19e6ff]"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <FeedbackButton icon={<ThumbsUp />} label="Accepted" tone="mint" onClick={() => recordFeedback('accepted')} />
        <FeedbackButton icon={<ThumbsDown />} label="Corrected" tone="gray" onClick={() => recordFeedback('corrected')} />
        <FeedbackButton icon={<ShieldCheck />} label="Interrupted" tone="red" onClick={() => recordFeedback('interrupted')} />
      </div>
    </section>
  );
}

function HeroPanel({ result, activeGene, reward, delta }: { result: AnalyzeResult; activeGene: GeneTuple; reward: RewardResult | null; delta: number }) {
  return (
    <section className="relative min-h-[450px] min-w-0 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#050505]/95 p-5 sm:rounded-[34px] sm:p-6 lg:p-7">
      <div className="absolute inset-0 opacity-70">
        <div className="absolute -right-48 -top-48 h-[620px] w-[620px] rounded-full border border-white/[0.055]" />
        <div className="absolute -right-28 -top-28 h-[420px] w-[420px] rounded-full border border-white/[0.06]" />
        <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[#19e6ff]/45 to-transparent" />
      </div>
      <div className="relative z-10 grid h-full min-w-0 gap-6 2xl:grid-cols-[minmax(0,1.08fr)_330px]">
        <div className="flex min-w-0 flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.035] px-3 py-1.5 text-xs text-white/45">
              <span className="h-1.5 w-1.5 rounded-full bg-[#19e6ff] shadow-[0_0_14px_rgba(25,230,255,0.9)]" />
              Self-evolving behavior layer for existing agents
            </div>
            <h2 className="mt-7 max-w-4xl text-[34px] font-semibold leading-[0.95] tracking-[-0.075em] sm:text-[42px] lg:text-[54px] 2xl:text-[58px]">
              Codex keeps working.<br /><span className="text-[#19e6ff]">EvoMate makes it adapt.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/48 lg:text-lg">
              We observe agent events, extract user intent through EvoMap LLM, select a behavior gene with ML, then write the learning trail into GEP assets.
            </p>
          </div>

          <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <MetricBox label="Semantic Parse" value={result.llmUsed ? 'EvoMap LLM' : 'Seed rules'} />
            <MetricBox label="Intent" value={result.semantic.intent} />
            <MetricBox label="Confidence" value={result.llmConfidence == null ? `${(result.semantic.confidence * 100).toFixed(0)}%` : `${(result.llmConfidence * 100).toFixed(0)}%`} />
            <MetricBox label="Delta" value={`${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`} tone={delta >= 0 ? 'mint' : 'red'} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {result.signals.slice(0, 8).map((signal) => (
              <span key={signal} className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-xs text-white/55">{signal}</span>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-[26px] border border-white/[0.08] bg-[#111]/80 p-5 shadow-[0_0_80px_rgba(25,230,255,0.06)]">
          <p className="text-xs uppercase tracking-[0.22em] text-white/35">Advisor output</p>
          <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[#83f3b1]">{activeGene[0]}</p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div initial={{ width: 0 }} animate={{ width: `${result.yesness * 100}%` }} className="h-full rounded-full bg-gradient-to-r from-[#19e6ff] to-[#83f3b1]" />
          </div>
          <p className="mt-2 text-sm text-white/42">{activeGene[1]}</p>
          <p className="mt-5 text-sm leading-6 text-white/52">{activeGene[3]}</p>
          <div className="mt-5 rounded-2xl border border-[#19e6ff]/16 bg-[#19e6ff]/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#19e6ff]/70">Inject into next run</p>
            <p className="mt-2 text-sm leading-6 text-white/58">{activeGene[5]}</p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <MetricBox label="Task" value={result.taskType} />
            <MetricBox label="Risk" value={result.riskLevel} />
            <MetricBox label="Mode" value={result.source} />
            <MetricBox label="Reward" value={reward ? formatReward(reward.value) : '--'} tone={reward && reward.value < 0 ? 'red' : 'mint'} />
          </div>
        </div>
      </div>
    </section>
  );
}

function RuntimePipeline({ result, activeGene, assets }: { result: AnalyzeResult; activeGene: GeneTuple; assets: GepAsset[] }) {
  const steps = [
    { icon: <Bot />, label: 'Existing Agent', value: 'Codex / Claude Code', detail: 'User keeps working in the coding agent they already use.' },
    { icon: <Cpu />, label: 'Policy Engine', value: activeGene[0], detail: `${(result.yesness * 100).toFixed(1)}% predicted Yesness for this behavior.` },
    { icon: <PlugZap />, label: 'Advisor Injection', value: 'Next run strategy', detail: activeGene[5] },
    { icon: <ClipboardList />, label: 'GEP Ledger', value: `${assets.filter((asset) => asset.type !== 'Capsule').length} assets`, detail: 'Mutation and EvolutionEvent make the behavior update auditable.' }
  ];

  return (
    <section className="min-w-0 rounded-[28px] border border-white/[0.08] bg-[#070707]/90 p-5">
      <PanelHeader icon={<Network />} title="Runtime Integration" subtitle="not a chat UI" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.label} className="relative rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
            {index < steps.length - 1 && <div className="absolute right-[-18px] top-1/2 z-10 hidden h-px w-8 bg-gradient-to-r from-[#19e6ff]/60 to-transparent md:block" />}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#19e6ff]/20 bg-[#19e6ff]/10 text-[#19e6ff] [&>svg]:h-5 [&>svg]:w-5">{step.icon}</div>
            <p className="mt-4 text-xs uppercase tracking-[0.22em] text-white/30">0{index + 1} {step.label}</p>
            <p className="mt-2 truncate font-medium text-white">{step.value}</p>
            <p className="mt-2 text-sm leading-5 text-white/42">{step.detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="min-w-0 rounded-2xl border border-[#19e6ff]/15 bg-[#19e6ff]/[0.035] p-4">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.22em] text-[#19e6ff]/70">Semantic Contract</p>
              <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-white">{result.semantic.intent}</p>
            </div>
            <span className="rounded-full border border-[#83f3b1]/20 bg-[#83f3b1]/10 px-3 py-1 text-xs text-[#83f3b1]">
              {(result.semantic.confidence * 100).toFixed(0)}% parsed
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <MetricBox label="Permission" value={result.semantic.permissionMode} />
            <MetricBox label="Tone" value={result.semantic.userTone} />
            <MetricBox label="Risk" value={result.semantic.riskLevel} />
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-white/30">Routed into 3 layers</p>
          <div className="mt-3 space-y-2">
            <SemanticRoute label="Behavior" value={result.semantic.workstyleSignals.join(', ') || 'neutral collaboration policy'} />
            <SemanticRoute label="Instruction" value={result.semantic.feedbackSemantics?.correctionType || result.semantic.feedbackSemantics?.sentiment || 'no durable correction yet'} />
            <SemanticRoute label="Workflow" value={result.semantic.toolNeeds.join(', ') || 'default answer workflow'} />
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {[...result.semantic.domainSignals, ...result.semantic.toolNeeds].slice(0, 8).map((item) => (
          <span key={item} className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-xs text-white/48">{item}</span>
        ))}
      </div>
    </section>
  );
}

function SemanticRoute({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[82px_minmax(0,1fr)] gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 sm:grid-cols-[88px_minmax(0,1fr)]">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/32">{label}</p>
      <p className="truncate text-xs text-white/62">{value}</p>
    </div>
  );
}

function BehaviorControlPanel({ activeGeneId }: { activeGeneId: string }) {
  return (
    <section className="min-w-0 rounded-[28px] border border-white/[0.08] bg-[#070707]/90 p-5">
      <PanelHeader icon={<GitBranch />} title="Behavior Control" subtitle="advisor policy" />
      <div className="mt-5 space-y-3">
        {genes.map(([label, id, score, body, mode]) => {
          const active = id === activeGeneId;
          return (
            <div key={id} className={`rounded-2xl border p-4 ${active ? 'border-[#83f3b1]/25 bg-[#83f3b1]/[0.065]' : 'border-white/[0.08] bg-white/[0.025]'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{label}</p>
                  <p className="mt-1 text-xs text-white/35">{mode}</p>
                </div>
                <p className={active ? 'text-[#83f3b1]' : 'text-white/48'}>{(score * 100).toFixed(0)}%</p>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <motion.div initial={{ width: 0 }} animate={{ width: `${score * 100}%` }} className="h-full rounded-full bg-gradient-to-r from-[#19e6ff] to-[#83f3b1]" />
              </div>
              <p className="mt-3 text-sm leading-5 text-white/42">{body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GepAssetStream({ assets, reward }: { assets: GepAsset[]; reward: RewardResult | null }) {
  return (
    <section className="min-w-0 rounded-[28px] border border-white/[0.08] bg-[#070707]/90 p-5">
      <PanelHeader icon={<Layers3 />} title="GEP Asset Stream" subtitle="evomap ledger" />
      <div className="mt-5 space-y-3">
        {assets.map((asset) => (
          <div key={`${asset.type}_${asset.id}`} className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-white">{asset.type}</p>
              <BadgeCheck className={`h-4 w-4 ${asset.asset_id ? 'text-[#83f3b1]' : 'text-white/24'}`} />
            </div>
            <p className="mt-2 truncate text-xs text-white/42">{asset.id}</p>
            <p className="mt-2 truncate text-xs text-[#19e6ff]/70">{asset.asset_id ?? 'waiting for threshold / feedback'}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-white/[0.08] bg-black/30 p-4">
        <p className="text-xs uppercase tracking-[0.22em] text-white/30">Latest reward</p>
        <p className={`mt-3 text-2xl font-semibold ${reward && reward.value < 0 ? 'text-[#ff7d7d]' : 'text-[#83f3b1]'}`}>{reward ? formatReward(reward.value) : 'pending'}</p>
      </div>
    </section>
  );
}


function RemoteComputePanel({
  job,
  jobs,
  loading,
  onSubmit,
  onImport,
  onRefresh
}: {
  job: RemoteJob | null;
  jobs: RemoteJob[];
  loading: boolean;
  onSubmit: () => void;
  onImport: () => void;
  onRefresh: () => void;
}) {
  const active = job ?? jobs[0];
  const statusTone = active?.status === 'imported' || active?.status === 'completed'
    ? 'text-[#83f3b1]'
    : active?.status === 'failed'
      ? 'text-[#ff7d7d]'
      : 'text-[#19e6ff]';

  return (
    <section className="min-w-0 rounded-[28px] border border-white/[0.08] bg-[#070707]/90 p-5">
      <PanelHeader icon={<CircuitBoard />} title="Remote Compute" subtitle="gpu distribution" />
      <div className="mt-5 rounded-2xl border border-[#19e6ff]/15 bg-[#19e6ff]/[0.035] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#19e6ff]/70">Evolution Lab</p>
            <p className="mt-2 text-sm leading-5 text-white/62">Local MCP stays fast. Heavy evolution jobs move to remote GPU worker.</p>
          </div>
          <Cpu className="h-6 w-6 text-[#19e6ff]" />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <MetricBox label="Host" value={active?.target?.host || 'configured host'} />
          <MetricBox label="Mode" value={active?.target?.executeRemote ? 'ssh' : 'dry-run'} />
          <MetricBox label="Status" value={active?.status || 'ready'} tone={active?.status === 'failed' ? 'red' : 'cyan'} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onSubmit}
          className="flex items-center justify-center gap-2 rounded-2xl bg-white px-3 py-3 text-xs font-medium text-black transition hover:bg-white/90"
        >
          {loading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <RadioTower className="h-4 w-4" />}
          Submit Job
        </button>
        <button
          type="button"
          onClick={onImport}
          disabled={!active}
          className="flex items-center justify-center gap-2 rounded-2xl border border-[#83f3b1]/25 bg-[#83f3b1]/10 px-3 py-3 text-xs font-medium text-[#83f3b1] transition disabled:cursor-not-allowed disabled:opacity-35"
        >
          <BadgeCheck className="h-4 w-4" />
          Import
        </button>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 text-xs text-white/50 transition hover:text-white"
      >
        <RefreshCcw className="h-3.5 w-3.5" />
        Refresh Queue
      </button>

      <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.22em] text-white/30">Active job</p>
            <p className="mt-2 truncate text-sm font-medium text-white">{active?.jobId || 'no job submitted yet'}</p>
          </div>
          <p className={`text-sm font-semibold ${statusTone}`}>{active?.status || 'idle'}</p>
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-5 text-white/42">{active?.objective || 'Submit an evolution_gym_eval job to produce policy_eval, ValidationReport, mutations, and EvolutionBundle.'}</p>
        <div className="mt-4 space-y-2">
          <RemoteStep label="Dataset" active={Boolean(active)} />
          <RemoteStep label="SSH Queue" active={Boolean(active)} />
          <RemoteStep label="Python Worker" active={active?.status === 'running' || active?.status === 'completed' || active?.status === 'imported'} />
          <RemoteStep label="GEP Import" active={active?.status === 'imported'} />
        </div>
      </div>

      {active?.artifactSummary && (
        <div className="mt-4 rounded-2xl border border-[#83f3b1]/16 bg-[#83f3b1]/[0.045] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-[#83f3b1]/70">Imported bundle</p>
          <p className="mt-2 truncate text-sm text-white">{active.artifactSummary.evolutionBundleId}</p>
          <p className="mt-2 text-xs text-white/44">
            score {((active.artifactSummary.validationScore || 0) * 100).toFixed(0)}% · {active.artifactSummary.suggestedMutationCount || 0} mutation(s)
          </p>
        </div>
      )}
    </section>
  );
}

function RemoteStep({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
      <span className="text-xs text-white/52">{label}</span>
      <span className={`h-2 w-2 rounded-full ${active ? 'bg-[#83f3b1] shadow-[0_0_12px_rgba(131,243,177,0.65)]' : 'bg-white/18'}`} />
    </div>
  );
}

function TimelinePanel({ timeline }: { timeline: string[] }) {
  return (
    <section className="min-w-0 rounded-[28px] border border-white/[0.08] bg-[#070707]/90 p-5">
      <PanelHeader icon={<Activity />} title="Evolution Timeline" subtitle="observer log" />
      <div className="mt-5 space-y-3">
        {timeline.map((event, index) => (
          <div key={`${event}_${index}`} className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
            <p className="text-xs text-[#19e6ff]">evt_0{index + 1}</p>
            <p className="mt-2 text-sm leading-6 text-white/56">{event}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SessionRow({ label, value, status }: { label: string; value: string; status: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">{label}</p>
        <p className="mt-1 text-sm text-white/72">{value}</p>
      </div>
      <span className="rounded-full border border-[#19e6ff]/20 bg-[#19e6ff]/10 px-2.5 py-1 text-[11px] text-[#19e6ff]">{status}</span>
    </div>
  );
}

function PanelHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/32">{subtitle}</p>
        <h3 className="mt-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-white">
          <span className="text-[#19e6ff] [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
          {title}
        </h3>
      </div>
      <span className="h-2 w-2 rounded-full bg-[#19e6ff] shadow-[0_0_16px_rgba(25,230,255,0.95)]" />
    </div>
  );
}

function FeedbackButton({ icon, label, tone, onClick }: { icon: ReactNode; label: string; tone: 'mint' | 'gray' | 'red'; onClick: () => void }) {
  const classes = tone === 'mint'
    ? 'border-[#83f3b1]/25 bg-[#83f3b1]/10 text-[#83f3b1]'
    : tone === 'red'
      ? 'border-[#ff7d7d]/25 bg-[#ff7d7d]/10 text-[#ff9b9b]'
      : 'border-white/[0.1] bg-white/[0.035] text-white/55';
  return (
    <button type="button" onClick={onClick} className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium transition hover:scale-[1.01] ${classes}`}>
      <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
      {label}
    </button>
  );
}

function MetricBox({ label, value, tone = 'cyan' }: { label: string; value: string; tone?: 'cyan' | 'mint' | 'red' }) {
  const color = tone === 'mint' ? 'text-[#83f3b1]' : tone === 'red' ? 'text-[#ff7d7d]' : 'text-[#19e6ff]';
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/25 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/32">{label}</p>
      <p className={`mt-1 truncate text-sm font-medium ${color}`}>{value}</p>
    </div>
  );
}

function SubtleBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_12%,rgba(25,230,255,0.09),transparent_24%),radial-gradient(circle_at_82%_28%,rgba(131,243,177,0.06),transparent_20%)]" />
      <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:52px_52px]" />
      <div className="absolute left-[42%] top-[10%] h-[760px] w-[760px] rounded-full border border-white/[0.035]" />
      <div className="absolute left-[52%] top-[18%] h-[520px] w-[520px] rounded-full border border-white/[0.04]" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}

function mockAnalyze(text: string, previousYesness: number): AnalyzeResult {
  const signals = new Set<string>();
  if (/代码|仓库|repo|前端|后端|codex|claude/i.test(text)) signals.add('coding_task');
  if (/先|别|不要|乱动|看看|read-only/i.test(text)) signals.add('permission_sensitive');
  if (/evomap|gep|进化/i.test(text)) signals.add('evomap_integration');
  if (/mcp/i.test(text)) signals.add('mcp_native');
  if (/机器学习|ml|policy|reward/i.test(text)) signals.add('ml_policy');
  if (/路演|demo|评委/.test(text)) signals.add('roadshow_planning');
  if (!signals.size) signals.add('agent_event');

  const geneId = signals.has('permission_sensitive')
    ? 'gene_ask_before_execution'
    : signals.has('roadshow_planning')
      ? 'gene_visualize_first'
      : signals.has('mcp_native') || signals.has('evomap_integration')
        ? 'gene_mcp_first_architecture'
        : signals.has('ml_policy')
          ? 'gene_yes_engineer_policy'
          : 'gene_concise_direct_answer';

  return {
    geneId,
    yesness: geneId === 'gene_ask_before_execution' ? 0.864 : 0.812,
    previousYesness,
    signals: [...signals],
    taskType: signals.has('coding_task') ? 'coding' : signals.has('roadshow_planning') ? 'product' : 'general',
    riskLevel: signals.has('permission_sensitive') ? 'medium' : 'low',
    semantic: mockSemantic(text, [...signals]),
    source: 'demo',
    llmUsed: false,
    llmIntent: 'simulated agent event classification',
    llmConfidence: 0.68
  };
}

function normalizeSemantic(value: unknown, fallback: Pick<SemanticResult, 'signals' | 'taskType' | 'riskLevel'>): SemanticResult {
  const item = value && typeof value === 'object' ? value as Partial<SemanticResult> : {};
  return {
    taskType: asString(item.taskType, fallback.taskType),
    intent: asString(item.intent, 'general_help'),
    riskLevel: asString(item.riskLevel, fallback.riskLevel),
    permissionMode: asString(item.permissionMode, fallback.riskLevel === 'high' ? 'ask_before_editing' : 'unknown'),
    userTone: asString(item.userTone, 'neutral'),
    workstyleSignals: asStringArray(item.workstyleSignals),
    domainSignals: asStringArray(item.domainSignals),
    toolNeeds: asStringArray(item.toolNeeds),
    feedbackSemantics: item.feedbackSemantics && typeof item.feedbackSemantics === 'object'
      ? {
          sentiment: asString(item.feedbackSemantics.sentiment, 'neutral'),
          correctionType: typeof item.feedbackSemantics.correctionType === 'string' ? item.feedbackSemantics.correctionType : undefined,
          rewardHint: typeof item.feedbackSemantics.rewardHint === 'number' ? item.feedbackSemantics.rewardHint : 0
        }
      : null,
    signals: asStringArray(item.signals).length ? asStringArray(item.signals) : fallback.signals,
    confidence: typeof item.confidence === 'number' ? clamp(item.confidence, 0, 1) : 0.52
  };
}

function mockSemantic(text: string, signals: string[]): SemanticResult {
  const wantsCaution = /先|别|不要|乱动|看看|read-only/i.test(text);
  const wantsFrontend = /前端|界面|ui|视觉|布局|dashboard/i.test(text);
  const wantsRoadshow = /路演|demo|评委|黑客松/i.test(text);
  const wantsML = /机器学习|ml|policy|reward|进化/i.test(text);
  const isNegative = /不是|不对|丑|错|你干啥|别乱动|太像|难看|不行/.test(text);

  return {
    taskType: signals.includes('coding_task') ? 'coding' : wantsRoadshow ? 'product' : 'general',
    intent: wantsCaution
      ? 'analysis_before_execution'
      : wantsFrontend
        ? 'frontend_iteration'
        : wantsRoadshow
          ? 'roadshow_packaging'
          : wantsML
            ? 'ml_optimization'
            : 'direct_execution',
    riskLevel: wantsCaution ? 'medium' : 'low',
    permissionMode: wantsCaution ? 'ask_before_editing' : 'safe_to_execute',
    userTone: /快|啥几把|别废话/.test(text) ? 'impatient' : wantsCaution ? 'cautious' : 'direct',
    workstyleSignals: wantsCaution ? ['prefers_analysis_before_execution'] : ['wants_forward_progress'],
    domainSignals: [
      signals.includes('evomap_integration') ? 'evomap' : '',
      signals.includes('ml_policy') ? 'ml_policy' : '',
      signals.includes('mcp_native') ? 'mcp' : ''
    ].filter(Boolean),
    toolNeeds: [
      signals.includes('coding_task') ? 'repo_inspection' : '',
      wantsFrontend ? 'frontend_iteration' : '',
      wantsRoadshow ? 'roadshow_packaging' : ''
    ].filter(Boolean),
    feedbackSemantics: isNegative ? { sentiment: 'negative', correctionType: wantsFrontend ? 'layout_mismatch' : 'execution_mismatch', rewardHint: -0.65 } : null,
    signals,
    confidence: 0.68
  };
}

function asString(value: unknown, fallback: string) {
  return typeof value === 'string' && value ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}


function mockRemoteJob(): RemoteJob {
  const jobId = `job_evolution_gym_eval_${Date.now().toString().slice(-8)}`;
  return {
    jobId,
    type: 'evolution_gym_eval',
    status: 'queued',
    objective: 'Full remote evolution prototype: evaluate behavior policy, produce ValidationReport and EvolutionBundle.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    target: { host: 'remote.example.com', port: 22, user: 'evomate', executeRemote: false },
    remotePlan: { bootstrap: ['ssh mkdir'], sync: ['rsync repo'], submit: ['python remote_worker'], import: ['scp artifacts'] }
  };
}

function remoteArtifactsToAssets(artifacts: Record<string, unknown>): GepAsset[] {
  const validation = artifacts?.validationReport as { id?: string } | undefined;
  const bundle = artifacts?.evolutionBundle as { id?: string } | undefined;
  const mutations = Array.isArray(artifacts?.suggestedMutations) ? artifacts.suggestedMutations as Array<{ id?: string }> : [];
  const assets: GepAsset[] = [];
  if (validation?.id) assets.push({ type: 'ValidationReport', id: validation.id, asset_id: 'remote:imported' });
  for (const mutation of mutations.slice(0, 2)) {
    if (mutation.id) assets.push({ type: 'Mutation', id: mutation.id, asset_id: 'remote:imported' });
  }
  if (bundle?.id) assets.push({ type: 'EvolutionBundle', id: bundle.id, asset_id: 'remote:imported' });
  return assets;
}

function formatReward(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
