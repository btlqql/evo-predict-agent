import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { SCHEMA_VERSION, computeAssetId } from '@evomap/gep-sdk';
import type { EvolutionState, FeedbackInput, RewardBreakdown } from '@evomate/core';
import { resolveFromProjectRoot } from './paths.js';

interface GepMutationAsset {
  type: 'Mutation';
  schema_version: string;
  id: string;
  category: 'repair' | 'optimize' | 'innovate' | 'explore';
  trigger_signals: string[];
  target: string;
  expected_effect: string;
  risk_level: 'low' | 'medium' | 'high';
  asset_id?: string;
}

interface GepEvolutionEventAsset {
  type: 'EvolutionEvent';
  schema_version: string;
  id: string;
  parent: string | null;
  intent: 'repair' | 'optimize' | 'innovate' | 'explore';
  signals: string[];
  genes_used: string[];
  mutation_id: string;
  personality_state: Record<string, unknown> | null;
  blast_radius: { files: number; lines: number };
  outcome: { status: 'success' | 'failed'; score: number };
  capsule_id: string | null;
  source_type: 'generated';
  reused_asset_id: string | null;
  env_fingerprint: Record<string, unknown> | null;
  validation_report_id: string | null;
  meta: Record<string, unknown> | null;
  trigger_context: {
    prompt: string;
    reasoning_trace: string;
    context_signals: string[];
    session_id: string;
    agent_model: string;
  };
  asset_id?: string;
}

interface GepCapsuleAsset {
  type: 'Capsule';
  schema_version: string;
  id: string;
  trigger: string[];
  gene: string;
  summary: string;
  confidence: number;
  blast_radius: { files: number; lines: number };
  outcome: { status: 'success' | 'failed'; score: number };
  success_streak?: number;
  success_reason?: string | null;
  gene_library_version?: string | null;
  env_fingerprint?: Record<string, unknown> | null;
  source_type?: 'generated';
  reused_asset_id?: string | null;
  content?: Record<string, unknown> | null;
  strategy?: string[];
  execution_trace?: Array<{ stage: 'build' | 'validate' | 'canary' }>;
  trigger_context?: {
    prompt: string;
    reasoning_trace: string;
    context_signals: string[];
    session_id: string;
    agent_model: string;
  };
  visibility?: 'private';
  asset_id?: string;
}

interface CapsuleStore {
  version: number;
  capsules: GepCapsuleAsset[];
}

export interface GepAssetWriteInput {
  beforeState: EvolutionState;
  afterState: EvolutionState;
  feedback: FeedbackInput;
  reward: RewardBreakdown;
  prompt?: string;
}

export interface GepAssetWriteResult {
  ok: boolean;
  assetsDir: string;
  eventsPath: string;
  written: Array<{ type: string; id: string; asset_id?: string }>;
  skippedCapsule?: string;
  error?: string;
}

export async function recordFeedbackGepAssets(input: GepAssetWriteInput): Promise<GepAssetWriteResult> {
  const assetsDir = resolveAssetsDir();
  const eventsPath = resolve(assetsDir, 'events.jsonl');
  const written: GepAssetWriteResult['written'] = [];

  try {
    await mkdir(assetsDir, { recursive: true });
    const geneId = resolveGeneId(input);
    const gene = input.afterState.activeGenes.find((candidate) => candidate.id === geneId) ?? input.afterState.activeGenes[0];
    const signals = normalizeSignals(input.feedback.signals ?? []);
    const category = gene?.category ?? 'optimize';
    const riskLevel = riskFromSignals(signals);
    const status = input.reward.reward >= 0 ? 'success' : 'failed';
    const score = clamp(input.reward.yesness, 0, 1);
    const sessionId = `evomate_${input.afterState.assistantId}_${input.afterState.generation}`;
    const weightSummary = diffPolicyWeights(input.beforeState, input.afterState, geneId);
    const mutationId = `mut_evomate_${Date.now()}_${shortHash(`${geneId}:${signals.join(',')}:${input.reward.reward}`)}`;

    const mutation = stampAsset<GepMutationAsset>({
      type: 'Mutation',
      schema_version: SCHEMA_VERSION,
      id: mutationId,
      category,
      trigger_signals: signals.length ? signals : ['evomate_behavior_feedback'],
      target: `${geneId}.policy_weights`,
      expected_effect: expectedEffect(input.reward.reward, geneId, weightSummary),
      risk_level: riskLevel
    });

    const event = stampAsset<GepEvolutionEventAsset>({
      type: 'EvolutionEvent',
      schema_version: SCHEMA_VERSION,
      id: `evt_evomate_${Date.now()}_${shortHash(mutation.asset_id ?? mutation.id)}`,
      parent: null,
      intent: category,
      signals: signals.length ? signals : ['evomate_behavior_feedback'],
      genes_used: [geneId],
      mutation_id: mutation.id,
      personality_state: {
        yesness_score: input.afterState.metrics.yesnessScore,
        understanding_score: input.afterState.understandingScore,
        policy_total_updates: input.afterState.policy.totalUpdates
      },
      blast_radius: { files: 0, lines: 0 },
      outcome: { status, score },
      capsule_id: null,
      source_type: 'generated',
      reused_asset_id: null,
      env_fingerprint: {
        platform: 'evomate-local',
        runtime: 'node',
        policy_model: input.afterState.policy.model,
        policy_version: input.afterState.policy.version
      },
      validation_report_id: null,
      meta: {
        feedback_kind: input.feedback.kind,
        feedback_text: input.feedback.text ?? null,
        reward: input.reward.reward,
        yesness: input.reward.yesness,
        reward_components: input.reward.components,
        weight_summary: weightSummary,
        before_metrics: input.beforeState.metrics,
        after_metrics: input.afterState.metrics
      },
      trigger_context: {
        prompt: (input.prompt ?? input.feedback.text ?? '').slice(0, 2000),
        reasoning_trace: `EvoMate converted user feedback into reward=${input.reward.reward.toFixed(3)} and updated ${geneId}.`,
        context_signals: signals,
        session_id: sessionId,
        agent_model: process.env.EVOMAP_LLM_MODEL || 'evomate-policy-engine'
      }
    });

    await appendJsonl(eventsPath, mutation);
    await appendJsonl(eventsPath, event);
    written.push(pickWritten(mutation), pickWritten(event));

    const capsule = await maybeSolidifyCapsule({ assetsDir, state: input.afterState, geneId, signals, score, status, prompt: input.prompt ?? input.feedback.text });
    if (capsule) written.push(pickWritten(capsule));

    return { ok: true, assetsDir, eventsPath, written, skippedCapsule: capsule ? undefined : 'threshold_not_met' };
  } catch (err) {
    return {
      ok: false,
      assetsDir,
      eventsPath,
      written,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

function resolveAssetsDir(): string {
  return process.env.GEP_ASSETS_DIR ? resolveFromProjectRoot(process.env.GEP_ASSETS_DIR) : resolveFromProjectRoot('assets');
}

function resolveGeneId(input: GepAssetWriteInput): string {
  if (input.feedback.geneId) return input.feedback.geneId;
  const latest = input.afterState.timeline.find((item) => item.geneId);
  return latest?.geneId ?? input.afterState.activeGenes[0]?.id ?? 'gene_unknown';
}

function stampAsset<T extends { asset_id?: string }>(asset: T): T & { asset_id: string } {
  const clean = { ...asset };
  delete clean.asset_id;
  return { ...clean, asset_id: computeAssetId(clean) } as T & { asset_id: string };
}

async function appendJsonl(path: string, asset: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(asset)}\n`, 'utf8');
}

async function maybeSolidifyCapsule(input: {
  assetsDir: string;
  state: EvolutionState;
  geneId: string;
  signals: string[];
  score: number;
  status: 'success' | 'failed';
  prompt?: string;
}): Promise<GepCapsuleAsset | null> {
  if (input.status !== 'success') return null;
  const genePolicy = input.state.policy.genes[input.geneId];
  if (!genePolicy || genePolicy.wins < 3 || genePolicy.averageReward < 0.55 || input.score < 0.82) return null;

  const capsulesPath = resolve(input.assetsDir, 'capsules.json');
  const store = await readCapsules(capsulesPath);
  const capsuleId = `capsule_evomate_${shortHash(`${input.geneId}:${input.signals.sort().join(',')}`)}`;
  if (store.capsules.some((capsule) => capsule.id === capsuleId)) return null;

  const gene = input.state.activeGenes.find((candidate) => candidate.id === input.geneId);
  const capsule = stampAsset<GepCapsuleAsset>({
    type: 'Capsule',
    schema_version: SCHEMA_VERSION,
    id: capsuleId,
    trigger: input.signals.length ? input.signals : ['evomate_behavior_feedback'],
    gene: input.geneId,
    summary: `EvoMate learned that ${input.geneId} improves this user's Yesness for ${input.signals.slice(0, 4).join(', ') || 'general'} contexts.`,
    confidence: clamp(input.score, 0, 1),
    blast_radius: { files: 0, lines: 0 },
    outcome: { status: 'success', score: input.score },
    success_streak: genePolicy.wins,
    success_reason: `Average reward ${genePolicy.averageReward.toFixed(3)} after ${genePolicy.plays} plays.`,
    gene_library_version: 'evomate-0.1',
    env_fingerprint: {
      platform: 'evomate-local',
      policy_model: input.state.policy.model,
      policy_version: input.state.policy.version
    },
    source_type: 'generated',
    reused_asset_id: null,
    content: {
      yesness_score: input.state.metrics.yesnessScore,
      average_reward: genePolicy.averageReward,
      policy_plays: genePolicy.plays,
      policy_wins: genePolicy.wins
    },
    strategy: gene?.strategy ?? [],
    execution_trace: [{ stage: 'validate' }],
    trigger_context: {
      prompt: (input.prompt ?? '').slice(0, 2000),
      reasoning_trace: `Solidified ${input.geneId} because repeated user feedback produced stable positive reward.`,
      context_signals: input.signals,
      session_id: `evomate_${input.state.assistantId}_${input.state.generation}`,
      agent_model: process.env.EVOMAP_LLM_MODEL || 'evomate-policy-engine'
    },
    visibility: 'private'
  });

  store.capsules.push(capsule);
  await writeFile(capsulesPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  return capsule;
}

async function readCapsules(path: string): Promise<CapsuleStore> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<CapsuleStore> | GepCapsuleAsset[];
    if (Array.isArray(parsed)) return { version: 1, capsules: parsed };
    return { version: parsed.version ?? 1, capsules: Array.isArray(parsed.capsules) ? parsed.capsules : [] };
  } catch {
    return { version: 1, capsules: [] };
  }
}

function diffPolicyWeights(before: EvolutionState, after: EvolutionState, geneId: string): Record<string, number> {
  const beforeWeights = before.policy.genes[geneId]?.weights ?? {};
  const afterWeights = after.policy.genes[geneId]?.weights ?? {};
  const deltas: Record<string, number> = {};
  for (const key of Object.keys(afterWeights)) {
    const delta = Number(((afterWeights[key] ?? 0) - (beforeWeights[key] ?? 0)).toFixed(4));
    if (delta !== 0) deltas[key] = delta;
  }
  return Object.fromEntries(Object.entries(deltas).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 12));
}

function expectedEffect(reward: number, geneId: string, deltas: Record<string, number>): string {
  const direction = reward >= 0 ? 'Increase' : 'Decrease';
  const features = Object.keys(deltas).slice(0, 5).join(', ') || 'active context features';
  return `${direction} future selection confidence for ${geneId} under features: ${features}.`;
}

function riskFromSignals(signals: string[]): 'low' | 'medium' | 'high' {
  if (signals.includes('high_risk_action')) return 'high';
  if (signals.includes('coding_task') || signals.includes('permission_sensitive')) return 'medium';
  return 'low';
}

function normalizeSignals(signals: string[]): string[] {
  const normalized = signals.map((item) => item.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')).filter(Boolean);
  return [...new Set(['evomate_behavior_evolution', ...normalized])];
}

function pickWritten(asset: { type: string; id: string; asset_id?: string }) {
  return { type: asset.type, id: asset.id, asset_id: asset.asset_id };
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number(value.toFixed(4))));
}
