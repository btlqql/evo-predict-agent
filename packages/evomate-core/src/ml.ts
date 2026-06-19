import type { BehaviorGene, EvolutionState, FeedbackInput, UserInputSignal } from './index.js';
import { parseSemantics } from './semantic.js';

export type FeatureVector = Record<string, number>;

export interface GenePolicyParameters {
  geneId: string;
  weights: FeatureVector;
  plays: number;
  wins: number;
  averageReward: number;
  lastUpdatedAt?: string;
}

export interface BanditPolicyState {
  model: 'linear_contextual_bandit';
  version: 1;
  learningRate: number;
  explorationRate: number;
  totalUpdates: number;
  featureNames: string[];
  genes: Record<string, GenePolicyParameters>;
}

export interface PolicyScore {
  geneId: string;
  exploitation: number;
  exploration: number;
  prior: number;
  score: number;
  predictedReward: number;
  predictedYesness: number;
  matchedSignals: string[];
}

export interface PolicyDecision {
  algorithm: 'linear_contextual_bandit';
  selectedGene: BehaviorGene;
  features: FeatureVector;
  scores: PolicyScore[];
  predictedYesness: number;
  explanation: string;
}

export interface RewardComponent {
  name: string;
  value: number;
}

export interface RewardBreakdown {
  kind: FeedbackInput['kind'];
  reward: number;
  yesness: number;
  components: RewardComponent[];
}

export interface PolicyMutation {
  geneId: string;
  beforeAverageReward: number;
  afterAverageReward: number;
  weightDeltas: Record<string, number>;
}

export interface PolicyUpdateResult {
  policy: BanditPolicyState;
  reward: RewardBreakdown;
  mutations: PolicyMutation[];
  updatedGeneIds: string[];
}

export const FEATURE_NAMES = [
  'bias',
  'task_coding',
  'task_product',
  'task_research',
  'task_general',
  'risk_low',
  'risk_medium',
  'risk_high',
  'signal_coding_task',
  'signal_ambiguous_execution_permission',
  'signal_user_interruption',
  'signal_high_risk_action',
  'signal_mcp_native',
  'signal_evomap_integration',
  'signal_strategy_discussion',
  'signal_impatient_user',
  'signal_roadshow_planning',
  'signal_rapid_iteration',
  'signal_permission_sensitive',
  'signal_research_task',
  'signal_visualization_request',
  'signal_architecture_request',
  'signal_ml_policy',
  'signal_infrastructure',
  'wants_analysis',
  'wants_direct_action',
  'wants_visualization',
  'wants_research',
  'wants_roadshow',
  'message_short',
  'message_long',
  'history_understanding',
  'previous_interruption_pressure'
] as const;

export function createInitialPolicyState(genes: BehaviorGene[]): BanditPolicyState {
  return {
    model: 'linear_contextual_bandit',
    version: 1,
    learningRate: 0.12,
    explorationRate: 0.08,
    totalUpdates: 0,
    featureNames: [...FEATURE_NAMES],
    genes: Object.fromEntries(genes.map((gene) => [gene.id, seedGenePolicy(gene)]))
  };
}

export function ensurePolicyState(policy: BanditPolicyState | undefined, genes: BehaviorGene[]): BanditPolicyState {
  const base = policy?.model === 'linear_contextual_bandit' ? policy : createInitialPolicyState(genes);
  const next: BanditPolicyState = {
    ...base,
    featureNames: [...FEATURE_NAMES],
    genes: { ...base.genes }
  };

  for (const gene of genes) {
    const existing = next.genes[gene.id];
    next.genes[gene.id] = existing
      ? {
          ...existing,
          weights: normalizeWeights(existing.weights)
        }
      : seedGenePolicy(gene);
  }

  for (const geneId of Object.keys(next.genes)) {
    if (!genes.some((gene) => gene.id === geneId)) {
      delete next.genes[geneId];
    }
  }

  return next;
}

export function extractFeatures(signal: UserInputSignal, state?: Pick<EvolutionState, 'timeline' | 'understandingScore'>): FeatureVector {
  const features = zeroVector();
  const raw = signal.rawInput;

  features.bias = 1;
  features[`task_${signal.taskType}`] = 1;
  features[`risk_${signal.riskLevel}`] = 1;

  for (const signalName of signal.signals) {
    const key = `signal_${signalName}`;
    if (key in features) features[key] = 1;
  }

  if (/先|看看|分析|讲|解释|别|不要|没叫你|你干啥/.test(raw)) features.wants_analysis = 1;
  if (/继续|直接|开始|搞|跑|推|部署|改/.test(raw)) features.wants_direct_action = 1;
  if (/图|画|可视化|前端|界面|dashboard|驾驶舱/i.test(raw)) features.wants_visualization = 1;
  if (/查|搜索|研究|官网|调查|资料/.test(raw)) features.wants_research = 1;
  if (/路演|pitch|demo|评委|黑客松|商业|故事/.test(raw)) features.wants_roadshow = 1;

  features.message_short = raw.length <= 24 ? 1 : 0;
  features.message_long = raw.length >= 120 ? 1 : 0;
  features.history_understanding = state?.understandingScore ?? 0.42;

  const recent = state?.timeline?.slice(0, 20) ?? [];
  const interruptions = recent.filter((item) => item.type.includes('interrupted') || item.type.includes('corrected') || item.type.includes('rejected')).length;
  features.previous_interruption_pressure = clamp(interruptions / 5, 0, 1);

  return features;
}

export function selectBehaviorGeneWithPolicy(state: EvolutionState, signal: UserInputSignal): PolicyDecision {
  const policy = ensurePolicyState(state.policy, state.activeGenes);
  const features = extractFeatures(signal, state);
  const scores = state.activeGenes.map((gene) => scoreGene(policy, gene, features, signal));
  scores.sort((a, b) => b.score - a.score);

  const best = scores[0] ?? scoreGene(policy, state.activeGenes[0], features, signal);
  const selectedGene = state.activeGenes.find((gene) => gene.id === best.geneId) ?? state.activeGenes[0];

  return {
    algorithm: 'linear_contextual_bandit',
    selectedGene,
    features,
    scores,
    predictedYesness: best.predictedYesness,
    explanation: `Selected ${selectedGene.id} because it matched ${best.matchedSignals.length} signal(s) and scored ${best.score.toFixed(3)}.`
  };
}

export function calculateFeedbackReward(feedback: FeedbackInput): RewardBreakdown {
  const components: RewardComponent[] = [];
  const add = (name: string, value: number) => {
    if (value !== 0) components.push({ name, value });
  };

  if (typeof feedback.score === 'number') {
    add('manual_score', (feedback.score - 0.5) * 2);
  } else {
    switch (feedback.kind) {
      case 'accepted': add('accepted', 0.85); break;
      case 'corrected': add('corrected', -0.45); break;
      case 'interrupted': add('interrupted', -0.75); break;
      case 'rejected': add('rejected', -0.95); break;
      case 'undo': add('undo', -0.9); break;
      case 'manual_score': add('manual_score_missing', 0); break;
    }
  }

  const text = feedback.text ?? '';
  if (/好的|可以|继续|就这样|对|yes|ok/i.test(text)) add('positive_text', 0.12);
  if (/不是|你干啥|别乱动|没叫你|错|太啰嗦|废话|不对/i.test(text)) add('negative_text', -0.18);
  if (feedback.signals?.includes('high_risk_action') && feedback.kind === 'accepted') add('risky_action_accepted_bonus', 0.06);
  if (feedback.signals?.includes('ambiguous_execution_permission') && ['corrected', 'interrupted'].includes(feedback.kind)) add('permission_mismatch_penalty', -0.1);

  const reward = clamp(components.reduce((sum, item) => sum + item.value, 0), -1, 1);
  return {
    kind: feedback.kind,
    reward,
    yesness: clamp((reward + 1) / 2, 0, 1),
    components
  };
}

export function updatePolicyWithFeedback(policy: BanditPolicyState, genes: BehaviorGene[], feedback: FeedbackInput): PolicyUpdateResult {
  const ensured = ensurePolicyState(policy, genes);
  const reward = calculateFeedbackReward(feedback);
  const targetGenes = selectTargetGenes(genes, feedback);
  const signal = signalFromFeedback(feedback);
  const features = extractFeatures(signal);
  const next: BanditPolicyState = {
    ...ensured,
    totalUpdates: ensured.totalUpdates + 1,
    genes: { ...ensured.genes }
  };
  const mutations: PolicyMutation[] = [];

  for (const gene of targetGenes) {
    const current = next.genes[gene.id] ?? seedGenePolicy(gene);
    const beforeAverageReward = current.averageReward;
    const plays = current.plays + 1;
    const afterAverageReward = clamp((current.averageReward * current.plays + reward.reward) / plays, -1, 1);
    const error = reward.reward - current.averageReward;
    const weightDeltas: Record<string, number> = {};
    const weights = { ...current.weights };

    for (const name of FEATURE_NAMES) {
      const value = features[name] ?? 0;
      if (value === 0) continue;
      const delta = clamp(next.learningRate * error * value, -0.25, 0.25);
      weights[name] = clamp((weights[name] ?? 0) + delta, -2, 2);
      weightDeltas[name] = Number(delta.toFixed(4));
    }

    next.genes[gene.id] = {
      ...current,
      weights: normalizeWeights(weights),
      plays,
      wins: current.wins + (reward.reward > 0.25 ? 1 : 0),
      averageReward: afterAverageReward,
      lastUpdatedAt: new Date().toISOString()
    };

    mutations.push({
      geneId: gene.id,
      beforeAverageReward,
      afterAverageReward,
      weightDeltas
    });
  }

  return {
    policy: next,
    reward,
    mutations,
    updatedGeneIds: targetGenes.map((gene) => gene.id)
  };
}

function scoreGene(policy: BanditPolicyState, gene: BehaviorGene, features: FeatureVector, signal: UserInputSignal): PolicyScore {
  const params = policy.genes[gene.id] ?? seedGenePolicy(gene);
  const exploitation = dot(params.weights, features);
  const matchedSignals = gene.signals.filter((item) => signal.signals.includes(item));
  const prior = gene.fitness * 0.35 + gene.weight * 0.18 + Math.min(matchedSignals.length, 4) * 0.1;
  const exploration = policy.explorationRate * Math.sqrt(Math.log(policy.totalUpdates + 2) / (params.plays + 1));
  const score = exploitation + prior + exploration;
  const predictedYesness = clamp(sigmoid(score), 0.02, 0.98);

  return {
    geneId: gene.id,
    exploitation: round(exploitation),
    exploration: round(exploration),
    prior: round(prior),
    score: round(score),
    predictedReward: round(predictedYesness * 2 - 1),
    predictedYesness,
    matchedSignals
  };
}

function seedGenePolicy(gene: BehaviorGene): GenePolicyParameters {
  const weights = zeroVector();
  weights.bias = clamp((gene.fitness - 0.5) * 0.2, -0.2, 0.2);

  for (const signalName of gene.signals) {
    const key = `signal_${signalName}`;
    if (key in weights) weights[key] = 0.18;
  }

  if (gene.signals.includes('coding_task')) weights.task_coding = 0.12;
  if (gene.signals.includes('strategy_discussion')) weights.task_product = 0.12;
  if (gene.signals.includes('research_task')) weights.task_research = 0.12;
  if (gene.signals.includes('high_risk_action')) weights.risk_high = 0.15;
  if (gene.signals.includes('ambiguous_execution_permission')) weights.wants_analysis = 0.16;
  if (gene.signals.includes('rapid_iteration')) weights.wants_direct_action = 0.16;
  if (gene.signals.includes('visualization_request')) weights.wants_visualization = 0.16;
  if (gene.signals.includes('roadshow_planning')) weights.wants_roadshow = 0.16;

  return {
    geneId: gene.id,
    weights: normalizeWeights(weights),
    plays: 1,
    wins: gene.fitness >= 0.6 ? 1 : 0,
    averageReward: clamp(gene.fitness * 2 - 1, -1, 1)
  };
}

function selectTargetGenes(genes: BehaviorGene[], feedback: FeedbackInput): BehaviorGene[] {
  if (feedback.geneId) {
    const found = genes.find((gene) => gene.id === feedback.geneId);
    if (found) return [found];
  }

  if (feedback.signals?.length) {
    const matched = genes.filter((gene) => feedback.signals?.some((signal) => gene.signals.includes(signal)));
    if (matched.length) return matched;
  }

  return genes.slice(0, 1);
}

function signalFromFeedback(feedback: FeedbackInput): UserInputSignal {
  const signals = [...new Set(feedback.signals ?? [])];
  const rawInput = feedback.text ?? signals.join(' ');
  const taskType: UserInputSignal['taskType'] = signals.includes('coding_task')
    ? 'coding'
    : signals.includes('research_task')
      ? 'research'
      : signals.includes('strategy_discussion') || signals.includes('roadshow_planning')
        ? 'product'
        : 'general';
  const riskLevel: UserInputSignal['riskLevel'] = signals.includes('high_risk_action')
    ? 'high'
    : signals.includes('coding_task') || signals.includes('permission_sensitive')
      ? 'medium'
      : 'low';
  return { rawInput, taskType, riskLevel, signals, semantic: parseSemantics(rawInput) };
}

function zeroVector(): FeatureVector {
  return Object.fromEntries(FEATURE_NAMES.map((name) => [name, 0]));
}

function normalizeWeights(weights: FeatureVector): FeatureVector {
  const normalized = zeroVector();
  for (const name of FEATURE_NAMES) {
    normalized[name] = clamp(weights[name] ?? 0, -2, 2);
  }
  return normalized;
}

function dot(weights: FeatureVector, features: FeatureVector): number {
  return FEATURE_NAMES.reduce((sum, name) => sum + (weights[name] ?? 0) * (features[name] ?? 0), 0);
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number(value.toFixed(4))));
}

function round(value: number): number {
  return Number(value.toFixed(4));
}
