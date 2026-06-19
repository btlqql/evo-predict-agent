#!/usr/bin/env tsx
import { appendQueue, buildHookPayload, compactResponse, parseArgs, postJson, printHookFailure, printJson, readStdin } from './shared.js';

const args = parseArgs();
const stdinText = await readStdin();
const payload = buildHookPayload('observe', args, stdinText);

try {
  const queuePath = await appendQueue('observe', payload);
  const response = await postJson('/api/agent-events/observe', payload);
  printJson(compactResponse(response, { queued: false, queuePath, observed: response.observed }));
} catch (error) {
  printHookFailure('observe', error);
}
