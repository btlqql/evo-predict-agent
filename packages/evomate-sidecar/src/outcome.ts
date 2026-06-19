#!/usr/bin/env tsx
import { appendQueue, buildHookPayload, compactResponse, parseArgs, postJson, printHookFailure, printJson, readStdin } from './shared.js';

const args = parseArgs();
const stdinText = await readStdin();
const payload = buildHookPayload('outcome', args, stdinText);

try {
  const queuePath = await appendQueue('outcome', payload);
  const response = await postJson('/api/agent-events/outcome', payload);
  printJson(compactResponse(response, {
    queued: false,
    queuePath,
    reward: response.reward,
    gepAssets: response.gepAssets
  }));
} catch (error) {
  printHookFailure('outcome', error);
}
