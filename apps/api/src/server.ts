import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { extractSignalsWithEvoMapLlm, getEvoMapLlmConfig } from './evomap-llm.js';
import { loadLocalEnv } from './env.js';
import { recordFeedbackGepAssets } from './gep-assets.js';
import { resolveFromProjectRoot } from './paths.js';
import {
  importRemoteEvolutionArtifacts,
  listRemoteEvolutionJobs,
  readRemoteEvolutionJob,
  submitRemoteEvolutionJob
} from './remote-jobs.js';
import {
  applyFeedback,
  createInitialEvolutionState,
  EVOMATE_TECH_STACK,
  extractSignals,
  normalizeEvolutionState,
  previewFeedbackReward,
  selectBehaviorGeneDecision,
  type EvolutionState,
  type FeedbackInput,
  type RemoteJobType,
  type UserInputSignal
} from '@evomate/core';

loadLocalEnv();

const PORT = Number(process.env.EVOMATE_API_PORT || 8787);
const STATE_DIR = process.env.EVOMATE_STATE_DIR
  ? resolveFromProjectRoot(process.env.EVOMATE_STATE_DIR)
  : resolveFromProjectRoot('memory/evomate');
const STATE_FILE = resolve(STATE_DIR, 'evolution-state.json');

const app = new Hono();
app.use('*', cors());

const feedbackSchema = z.object({
  kind: z.enum(['accepted', 'corrected', 'interrupted', 'rejected', 'undo', 'manual_score']),
  text: z.string().optional(),
  score: z.number().min(0).max(1).optional(),
  geneId: z.string().optional(),
  signals: z.array(z.string()).optional()
});

const agentMetadataSchema = z.record(z.string(), z.unknown()).optional();

const agentEventSchema = z.object({
  source: z.string().default('manual'),
  event: z.string().default('user_message'),
  workspace: z.string().optional(),
  sessionId: z.string().optional(),
  content: z.string().optional(),
  cwd: z.string().optional(),
  metadata: agentMetadataSchema
});

const advisorSchema = z.object({
  source: z.string().default('manual'),
  event: z.string().default('advisor_prepare'),
  workspace: z.string().optional(),
  sessionId: z.string().optional(),
  input: z.string().min(1),
  metadata: agentMetadataSchema
});

const outcomeSchema = agentEventSchema.extend({
  kind: feedbackSchema.shape.kind.optional(),
  outcome: z.enum(['accepted', 'corrected', 'interrupted', 'rejected', 'undo', 'success', 'failure']).optional(),
  score: z.number().min(0).max(1).optional(),
  geneId: z.string().optional(),
  signals: z.array(z.string()).optional()
});

const remoteJobSchema = z.object({
  type: z.enum(['policy_replay_eval', 'evolution_gym_eval', 'preference_train', 'embedding_build']).default('evolution_gym_eval'),
  objective: z.string().optional(),
  source: z.string().default('control_plane'),
  executeRemote: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

app.get('/health', (c) => c.json({
  ok: true,
  service: 'evomate-api',
  port: PORT,
  evomapLlm: Boolean(getEvoMapLlmConfig()) && process.env.EVOMAP_LLM_DISABLED !== '1'
}));

app.get('/api/tech-stack', (c) => c.json(EVOMATE_TECH_STACK));

app.get('/api/evolution/state', async (c) => {
  const state = await loadState();
  return c.json(state);
});

app.get('/api/remote-jobs', async (c) => {
  const jobs = await listRemoteEvolutionJobs();
  return c.json({ ok: true, jobs });
});

app.post('/api/remote-jobs/submit', async (c) => {
  const parsed = remoteJobSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'invalid_remote_job', details: parsed.error.flatten() }, 400);

  const state = await loadState();
  const result = await submitRemoteEvolutionJob({
    ...parsed.data,
    type: parsed.data.type as RemoteJobType
  }, state);
  return c.json(result);
});

app.get('/api/remote-jobs/:jobId', async (c) => {
  try {
    const job = await readRemoteEvolutionJob(c.req.param('jobId'));
    return c.json({ ok: true, job });
  } catch (err) {
    return c.json({ error: 'remote_job_not_found', details: err instanceof Error ? err.message : String(err) }, 404);
  }
});

app.post('/api/remote-jobs/:jobId/import', async (c) => {
  try {
    const result = await importRemoteEvolutionArtifacts(c.req.param('jobId'));
    return c.json(result);
  } catch (err) {
    return c.json({ error: 'remote_artifact_import_failed', details: err instanceof Error ? err.message : String(err) }, 500);
  }
});

app.post('/api/interactions/analyze', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const input = typeof body.input === 'string' ? body.input : '';
  if (!input.trim()) return c.json({ error: 'input_required' }, 400);

  const state = await loadState();
  const advisor = await prepareAdvisor(input, state, {
    source: typeof body.source === 'string' ? body.source : 'manual',
    event: 'interaction_analyze',
    workspace: typeof body.workspace === 'string' ? body.workspace : undefined,
    sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined
  });
  const { signalExtraction, signal, policyDecision, gene, predictedSatisfaction } = advisor;

  const nextState: EvolutionState = {
    ...state,
    phase: 'strategy_decision',
    timeline: [
      {
        id: `evt_${Date.now()}`,
        type: 'gene_selected',
        summary: `Selected ${gene.id} for signals: ${signal.signals.join(', ') || 'none'} via ${signalExtraction.llm.used ? 'evomap_llm' : 'seed_rules'}`,
        score: predictedSatisfaction,
        createdAt: new Date().toISOString(),
        geneId: gene.id,
        signals: signal.signals
      },
      ...state.timeline
    ].slice(0, 100)
  };
  await saveState(nextState);

  return c.json({
    semantic: signal.semantic,
    signal,
    signalExtraction,
    gene,
    policyDecision,
    predictedSatisfaction,
    advisorPrompt: advisor.advisorPrompt,
    state: nextState
  });
});

app.post('/api/feedback', async (c) => {
  const parsed = feedbackSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'invalid_feedback', details: parsed.error.flatten() }, 400);

  const state = await loadState();
  const rewardPreview = previewFeedbackReward(parsed.data);
  const nextState = applyFeedback(state, parsed.data);
  await saveState(nextState);
  const gepAssets = await recordFeedbackGepAssets({
    beforeState: state,
    afterState: nextState,
    feedback: parsed.data,
    reward: rewardPreview,
    prompt: parsed.data.text
  });
  return c.json({ ok: true, reward: rewardPreview, gepAssets, state: nextState });
});

app.post('/api/advisor/prepare', async (c) => {
  const parsed = advisorSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'invalid_advisor_request', details: parsed.error.flatten() }, 400);

  const state = await loadState();
  const advisor = await prepareAdvisor(parsed.data.input, state, parsed.data);
  return c.json({
    ok: true,
    mode: 'read_only_advisor',
    source: normalizeHookText(parsed.data.source, 'manual'),
    workspace: parsed.data.workspace,
    sessionId: parsed.data.sessionId,
    advisorPrompt: advisor.advisorPrompt,
    semantic: advisor.signal.semantic,
    signal: advisor.signal,
    signalExtraction: advisor.signalExtraction,
    gene: advisor.gene,
    policyDecision: advisor.policyDecision,
    predictedSatisfaction: advisor.predictedSatisfaction
  });
});

app.post('/api/agent-events/observe', async (c) => {
  const parsed = agentEventSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'invalid_agent_event', details: parsed.error.flatten() }, 400);

  const event = normalizeAgentEvent(parsed.data);
  const input = extractAgentEventContent(event);
  if (!input.trim()) {
    return c.json({
      ok: true,
      observed: false,
      reason: 'empty_content',
      mode: 'non_blocking_sidecar'
    }, 202);
  }

  const state = await loadState();
  const advisor = await prepareAdvisor(input, state, event);
  const nextState: EvolutionState = {
    ...state,
    phase: 'user_input_received',
    timeline: [
      {
        id: `evt_hook_${Date.now()}`,
        type: 'agent_event_observed',
        summary: `${event.source}:${event.event} selected ${advisor.gene.id} for ${advisor.signal.signals.join(', ') || 'empty signals'}`,
        score: advisor.predictedSatisfaction,
        createdAt: new Date().toISOString(),
        geneId: advisor.gene.id,
        signals: advisor.signal.signals
      },
      ...state.timeline
    ].slice(0, 100)
  };
  await saveState(nextState);

  return c.json({
    ok: true,
    observed: true,
    mode: 'non_blocking_sidecar',
    source: event.source,
    event: event.event,
    workspace: event.workspace,
    sessionId: event.sessionId,
    advisorPrompt: advisor.advisorPrompt,
    semantic: advisor.signal.semantic,
    signal: advisor.signal,
    signalExtraction: advisor.signalExtraction,
    gene: advisor.gene,
    policyDecision: advisor.policyDecision,
    predictedSatisfaction: advisor.predictedSatisfaction,
    state: nextState
  });
});

app.post('/api/agent-events/outcome', async (c) => {
  const parsed = outcomeSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'invalid_agent_outcome', details: parsed.error.flatten() }, 400);

  const event = normalizeAgentEvent(parsed.data);
  const content = extractAgentEventContent(event);
  const inferred = content.trim() ? extractSignals(content) : undefined;
  const feedback: FeedbackInput = {
    kind: inferFeedbackKind(parsed.data),
    text: content || `${event.source}:${event.event}`,
    score: parsed.data.score,
    geneId: parsed.data.geneId,
    signals: parsed.data.signals?.length ? parsed.data.signals : inferred?.signals
  };

  const state = await loadState();
  const rewardPreview = previewFeedbackReward(feedback);
  const nextState = applyFeedback(state, feedback);
  await saveState(nextState);
  const gepAssets = await recordFeedbackGepAssets({
    beforeState: state,
    afterState: nextState,
    feedback,
    reward: rewardPreview,
    prompt: content
  });

  return c.json({
    ok: true,
    mode: 'non_blocking_sidecar',
    source: event.source,
    event: event.event,
    workspace: event.workspace,
    sessionId: event.sessionId,
    feedback,
    reward: rewardPreview,
    gepAssets,
    state: nextState
  });
});

app.get('/api/events', async (c) => {
  const state = await loadState();
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  return c.body(`event: state\ndata: ${JSON.stringify(state)}\n\n`);
});

async function loadState(): Promise<EvolutionState> {
  try {
    const raw = await readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<EvolutionState>;
    return normalizeEvolutionState(parsed);
  } catch {
    const initial = createInitialEvolutionState();
    await saveState(initial);
    return initial;
  }
}

async function saveState(state: EvolutionState): Promise<void> {
  await mkdir(dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

type AgentEventInput = z.infer<typeof agentEventSchema>;
type OutcomeInput = z.infer<typeof outcomeSchema>;

interface AdvisorContext {
  source?: string;
  event?: string;
  workspace?: string;
  sessionId?: string;
}

async function prepareAdvisor(input: string, state: EvolutionState, context: AdvisorContext) {
  const seedSignal = extractSignals(input);
  const signalExtraction = await extractSignalsWithEvoMapLlm(input, seedSignal);
  const signal = signalExtraction.merged;
  const policyDecision = selectBehaviorGeneDecision(state, signal);
  const gene = policyDecision.selectedGene;
  const predictedSatisfaction = policyDecision.predictedYesness;
  const advisorPrompt = buildAdvisorPrompt({
    context,
    signal,
    gene,
    predictedSatisfaction
  });

  return { signalExtraction, signal, policyDecision, gene, predictedSatisfaction, advisorPrompt };
}

function buildAdvisorPrompt(input: {
  context: AdvisorContext;
  signal: UserInputSignal;
  gene: EvolutionState['activeGenes'][number];
  predictedSatisfaction: number;
}): string {
  const { context, signal, gene, predictedSatisfaction } = input;
  const semantic = signal.semantic;
  const strategy = gene.strategy.map((line, index) => `${index + 1}. ${line}`).join('\n');
  const riskGuard = semantic.permissionMode === 'analysis_only'
    ? 'Guardrail: stay in analysis mode. Do not edit files, install packages, push, deploy, or run high-impact commands unless the user explicitly changes permission.'
    : semantic.permissionMode === 'ask_before_editing'
      ? 'Guardrail: inspect and explain first; ask or verify before file edits, installs, pushes, deploys, or destructive actions.'
      : semantic.riskLevel === 'high'
        ? 'Guardrail: high-risk action detected. Prefer a dry run / plan first, then confirm before irreversible execution.'
        : 'Guardrail: keep the host agent flow unchanged; this advisor is guidance, not a blocking controller.';

  return [
    'EvoMate Advisor — read-only sidecar guidance for this turn.',
    `Host: ${normalizeHookText(context.source, 'manual')} / ${normalizeHookText(context.event, 'advisor_prepare')}`,
    context.workspace ? `Workspace: ${context.workspace}` : undefined,
    context.sessionId ? `Session: ${context.sessionId}` : undefined,
    `Selected Behavior Gene: ${gene.label} (${gene.id})`,
    `Predicted Yesness: ${Math.round(predictedSatisfaction * 100)}%`,
    `Semantic: task=${semantic.taskType}; intent=${semantic.intent}; risk=${semantic.riskLevel}; permission=${semantic.permissionMode}; tone=${semantic.userTone}; confidence=${Math.round(semantic.confidence * 100)}%`,
    `Signals: ${signal.signals.join(', ') || 'none'}`,
    'Apply these behavior rules:',
    strategy,
    riskGuard,
    'When the user gives feedback, let EvoMate record the outcome so the behavior policy can evolve.'
  ].filter(Boolean).join('\n');
}

function normalizeAgentEvent(input: AgentEventInput): AgentEventInput {
  return {
    ...input,
    source: normalizeHookText(input.source, 'manual'),
    event: normalizeHookText(input.event, 'user_message'),
    workspace: input.workspace || input.cwd,
    sessionId: input.sessionId ? normalizeHookText(input.sessionId, 'local_session', 120) : undefined,
    content: input.content?.slice(0, 12000)
  };
}

function extractAgentEventContent(event: AgentEventInput): string {
  const metadata = event.metadata ?? {};
  const candidates: unknown[] = [
    event.content,
    metadata.input,
    metadata.prompt,
    metadata.message,
    metadata.user_input,
    metadata.userInput,
    metadata.text,
    metadata.command
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.slice(0, 12000);
  }
  return '';
}

function inferFeedbackKind(input: OutcomeInput): FeedbackInput['kind'] {
  if (input.kind) return input.kind;
  if (typeof input.score === 'number') return 'manual_score';
  switch (input.outcome) {
    case 'accepted':
    case 'success':
      return 'accepted';
    case 'corrected':
    case 'failure':
      return 'corrected';
    case 'interrupted':
      return 'interrupted';
    case 'rejected':
      return 'rejected';
    case 'undo':
      return 'undo';
    default:
      break;
  }

  const event = `${input.event ?? ''}`.toLowerCase();
  if (/interrupt|cancel|stop|abort/.test(event)) return 'interrupted';
  if (/reject|deny/.test(event)) return 'rejected';
  if (/undo|revert|rollback/.test(event)) return 'undo';
  if (/error|fail|exception/.test(event)) return 'corrected';
  return 'accepted';
}

function normalizeHookText(value: unknown, fallback: string, maxLength = 80): string {
  const normalized = typeof value === 'string' ? value.trim().replace(/[^\w:./@-]+/g, '_') : '';
  return (normalized || fallback).slice(0, maxLength);
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`EvoMate API listening on http://localhost:${info.port}`);
});
