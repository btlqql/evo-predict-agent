#!/usr/bin/env tsx
import { appendQueue, buildHookPayload, compactResponse, parseArgs, postJson, printHookFailure, printJson, readStdin } from './shared.js';

const args = parseArgs();
const stdinText = await readStdin();
const payload = buildHookPayload('advisor', args, stdinText);
const input = payload.content || '';

if (!input.trim()) {
  printJson({ ok: false, queued: false, error: 'input_required' });
} else {
  try {
    const advisorPayload = {
      source: payload.source,
      event: payload.event,
      workspace: payload.workspace,
      sessionId: payload.sessionId,
      input,
      metadata: payload.metadata
    };
    const queuePath = await appendQueue('advisor', advisorPayload);
    const response = await postJson('/api/advisor/prepare', advisorPayload);
    if (args.text === true && response.advisorPrompt) {
      process.stdout.write(`${response.advisorPrompt}\n`);
    } else {
      printJson(compactResponse(response, { queued: false, queuePath }));
    }
  } catch (error) {
    printHookFailure('advisor', error);
  }
}
