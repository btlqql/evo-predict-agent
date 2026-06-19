#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  applyFeedback,
  createInitialEvolutionState,
  EVOMATE_TECH_STACK,
  extractSignals,
  normalizeEvolutionState,
  parseSemantics,
  predictSatisfaction,
  selectBehaviorGene,
  selectBehaviorGeneDecision,
  type EvolutionState,
  type FeedbackInput
} from '@evomate/core';

const STATE_DIR = resolve(process.env.EVOMATE_STATE_DIR || './memory/evomate');
const STATE_FILE = resolve(STATE_DIR, 'evolution-state.json');

const server = new Server(
  {
    name: 'evomate-mcp-server',
    version: '0.1.0'
  },
  {
    capabilities: { tools: {} }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'evomate_get_evolution_state',
      description: 'Return EvoMate assistant evolution state: current phase, generation, behavior genes, timeline, and understanding score.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'evomate_parse_semantics',
      description: 'Parse a raw user request into EvoMate semantic fields before policy, instruction, and workflow evolution.',
      inputSchema: {
        type: 'object',
        required: ['input'],
        properties: {
          input: { type: 'string', description: 'Raw user request or situation text.' }
        }
      }
    },
    {
      name: 'evomate_select_behavior_gene',
      description: 'Analyze user input, extract signals, select the best behavior gene, and predict satisfaction before answering.',
      inputSchema: {
        type: 'object',
        required: ['input'],
        properties: {
          input: { type: 'string', description: 'Raw user request or situation text.' }
        }
      }
    },
    {
      name: 'evomate_record_feedback',
      description: 'Record user feedback and update behavior gene weights/fitness in the local EvoMate state.',
      inputSchema: {
        type: 'object',
        required: ['kind'],
        properties: {
          kind: { type: 'string', enum: ['accepted', 'corrected', 'interrupted', 'rejected', 'undo', 'manual_score'] },
          text: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 1 },
          geneId: { type: 'string' },
          signals: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    {
      name: 'evomate_predict_satisfaction',
      description: 'Predict whether a proposed behavior gene is likely to satisfy the user for a given input.',
      inputSchema: {
        type: 'object',
        required: ['input'],
        properties: {
          input: { type: 'string' },
          geneId: { type: 'string' }
        }
      }
    },
    {
      name: 'evomate_get_tech_stack',
      description: 'Return the recorded EvoMate technical stack and architecture commitments.',
      inputSchema: { type: 'object', properties: {} }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    if (name === 'evomate_get_evolution_state') {
      return text(await loadState());
    }

    if (name === 'evomate_select_behavior_gene') {
      const input = String((args as { input?: unknown }).input || '');
      if (!input.trim()) return error('input_required');
      const state = await loadState();
      const signal = extractSignals(input);
      const policyDecision = selectBehaviorGeneDecision(state, signal);
      const gene = policyDecision.selectedGene;
      const predictedSatisfaction = policyDecision.predictedYesness;
      const nextState: EvolutionState = {
        ...state,
        phase: 'gene_selection',
        timeline: [
          {
            id: `evt_${Date.now()}`,
            type: 'mcp_gene_selected',
            summary: `MCP selected ${gene.id} for ${signal.signals.join(', ') || 'empty signals'}`,
            score: predictedSatisfaction,
            createdAt: new Date().toISOString(),
            geneId: gene.id,
            signals: signal.signals
          },
          ...state.timeline
        ].slice(0, 100)
      };
      await saveState(nextState);
      return text({ semantic: signal.semantic, signal, gene, policyDecision, predictedSatisfaction, state: nextState });
    }

    if (name === 'evomate_parse_semantics') {
      const input = String((args as { input?: unknown }).input || '');
      if (!input.trim()) return error('input_required');
      return text(parseSemantics(input));
    }

    if (name === 'evomate_record_feedback') {
      const feedback = args as unknown as FeedbackInput;
      const state = await loadState();
      const nextState = applyFeedback(state, feedback);
      await saveState(nextState);
      return text({ ok: true, state: nextState });
    }

    if (name === 'evomate_predict_satisfaction') {
      const input = String((args as { input?: unknown }).input || '');
      const geneId = (args as { geneId?: string }).geneId;
      const state = await loadState();
      const signal = extractSignals(input);
      const policyDecision = selectBehaviorGeneDecision(state, signal);
      const gene = geneId
        ? state.activeGenes.find((candidate) => candidate.id === geneId) ?? selectBehaviorGene(state, signal)
        : policyDecision.selectedGene;
      return text({ semantic: signal.semantic, signal, gene, policyDecision, predictedSatisfaction: predictSatisfaction(state, signal, gene) });
    }

    if (name === 'evomate_get_tech_stack') {
      return text(EVOMATE_TECH_STACK);
    }

    return error(`unknown_tool:${name}`);
  } catch (err) {
    return error(err instanceof Error ? err.message : String(err));
  }
});

async function loadState(): Promise<EvolutionState> {
  try {
    const raw = await readFile(STATE_FILE, 'utf8');
    return normalizeEvolutionState(JSON.parse(raw) as Partial<EvolutionState>);
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

function text(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function error(message: string) {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }, null, 2) }], isError: true };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('EvoMate MCP Server running on stdio');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
