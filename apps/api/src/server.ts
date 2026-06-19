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
  applyFeedback,
  createInitialEvolutionState,
  EVOMATE_TECH_STACK,
  extractSignals,
  normalizeEvolutionState,
  previewFeedbackReward,
  selectBehaviorGeneDecision,
  type EvolutionState
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

app.post('/api/interactions/analyze', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const input = typeof body.input === 'string' ? body.input : '';
  if (!input.trim()) return c.json({ error: 'input_required' }, 400);

  const state = await loadState();
  const seedSignal = extractSignals(input);
  const signalExtraction = await extractSignalsWithEvoMapLlm(input, seedSignal);
  const signal = signalExtraction.merged;
  const policyDecision = selectBehaviorGeneDecision(state, signal);
  const gene = policyDecision.selectedGene;
  const predictedSatisfaction = policyDecision.predictedYesness;

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

  return c.json({ semantic: signal.semantic, signal, signalExtraction, gene, policyDecision, predictedSatisfaction, state: nextState });
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

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`EvoMate API listening on http://localhost:${info.port}`);
});
