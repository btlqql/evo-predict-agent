#!/usr/bin/env node

const args = parseArgs(process.argv.slice(2));
const apiUrl = trimSlash(args.api || process.env.EVOMATE_API_URL || 'http://127.0.0.1:8787');
const shouldWriteFeedback = args.writeFeedback !== false && args.noWrite !== true;
const scenario = String(args.scenario || 'preference');
const fastAdvisor = args.llm === true ? false : args.fast !== false;

const scenarios = {
  preference: {
    input: '这次太啰嗦，下次直接给结论，最后跑检查。',
    expectedExpert: 'preference',
    feedbackKind: 'corrected',
    score: 0.32,
    signals: ['too_verbose', 'prefer_concise_answer', 'memory_moe_smoke']
  },
  validation: {
    input: '需要跑测试验证这个改动，失败就先修。',
    expectedExpert: 'validation',
    feedbackKind: 'accepted',
    score: 0.86,
    signals: ['validation_required', 'test_before_claim', 'memory_moe_smoke']
  },
  procedural: {
    input: '把这次流程沉淀成 GEP capsule workflow，下次复用。',
    expectedExpert: 'procedural',
    feedbackKind: 'accepted',
    score: 0.9,
    signals: ['gep_capsule', 'workflow_memory', 'memory_moe_smoke']
  },
  repo: {
    input: '先看 git diff 和本地文件，再决定怎么改。',
    expectedExpert: 'repo',
    feedbackKind: 'accepted',
    score: 0.84,
    signals: ['repo_context', 'git_activity', 'memory_moe_smoke']
  }
};

const selected = scenarios[scenario] || scenarios.preference;
const startedAt = new Date().toISOString();

try {
  const health = await getJson('/health', 8000);
  assert(health.ok, 'health_not_ok');

  const hook = await postJson('/api/hook-events', {
    protocolVersion: 'evomate.hook.v1',
    source: 'evomate-smoke',
    channel: 'demo-smoke',
    eventKind: 'context_update',
    event: 'memory_moe_smoke_observe',
    route: 'observe',
    sessionId: `smoke-${Date.now()}`,
    content: selected.input,
    signals: selected.signals,
    metadata: { scenario, startedAt, evomateFastSmoke: fastAdvisor }
  }, 15000);
  assert(hook.ok && hook.count >= 1, 'hook_not_observed');

  const advisor = await postJson('/api/advisor/prepare', {
    source: 'evomate-smoke',
    event: 'memory_moe_smoke_advisor',
    workspace: process.cwd(),
    sessionId: `smoke-${Date.now()}`,
    input: selected.input,
    metadata: { scenario, startedAt, evomateFastSmoke: fastAdvisor }
  }, 70000);
  assert(advisor.ok, 'advisor_not_ok');
  assert(typeof advisor.advisorPrompt === 'string' && advisor.advisorPrompt.includes('│ MEM'), 'advisor_missing_MEM');
  assert(advisor.advisorPrompt.includes('│ GEP'), 'advisor_missing_GEP');
  assert(advisor.memoryRoute?.activeExpert === selected.expectedExpert, `unexpected_advisor_expert:${advisor.memoryRoute?.activeExpert}`);

  let feedback = null;
  if (shouldWriteFeedback) {
    feedback = await postJson('/api/feedback', {
      kind: selected.feedbackKind,
      text: `Smoke feedback (${scenario}): ${selected.input}`,
      score: selected.score,
      geneId: advisor.gene?.id,
      signals: selected.signals
    }, 20000);
    assert(feedback.ok, 'feedback_not_ok');
    assert(Array.isArray(feedback.gepAssets?.written) && feedback.gepAssets.written.length >= 1, 'gep_assets_not_written');
  }

  const route = await postJson('/api/memory/route', {
    source: 'evomate-smoke',
    input: selected.input,
    signals: selected.signals
  }, 15000);
  assert(route.ok, 'memory_route_not_ok');
  assert(route.activeExpert === selected.expectedExpert, `unexpected_route_expert:${route.activeExpert}`);
  assert(route.gepProof?.events >= 1, 'gep_proof_missing_events');

  const summary = {
    ok: true,
    apiUrl,
    scenario,
    fastAdvisor,
    expectedExpert: selected.expectedExpert,
    advisorExpert: advisor.memoryRoute.activeExpert,
    routeExpert: route.activeExpert,
    promptHasMEM: advisor.advisorPrompt.includes('│ MEM'),
    promptHasGEP: advisor.advisorPrompt.includes('│ GEP'),
    hookCount: hook.count,
    gepWritten: feedback?.gepAssets?.written?.map((asset) => ({ type: asset.type, id: asset.id || asset.asset_id })) || [],
    gepProof: route.gepProof,
    latestEventId: route.latestEventId,
    startedAt,
    finishedAt: new Date().toISOString()
  };
  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log('EVOMATE_SMOKE_OK');
    console.log(JSON.stringify(summary, null, 2));
  }
} catch (error) {
  const failure = {
    ok: false,
    apiUrl,
    scenario,
    error: error instanceof Error ? error.message : String(error),
    hint: `Start API first: EVOMATE_API_PORT=8787 npm run evomate:api`,
    startedAt,
    failedAt: new Date().toISOString()
  };
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
}

async function getJson(path, timeoutMs) {
  const response = await fetchWithTimeout(`${apiUrl}${path}`, { method: 'GET', headers: { accept: 'application/json' } }, timeoutMs);
  return parseJsonResponse(response);
}

async function postJson(path, body, timeoutMs) {
  const response = await fetchWithTimeout(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body)
  }, timeoutMs);
  return parseJsonResponse(response);
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function parseJsonResponse(response) {
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = typeof json.error === 'string' ? json.error : response.statusText;
    throw new Error(`api_${response.status}:${error}`);
  }
  return json;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function trimSlash(value) {
  return String(value).replace(/\/+$/, '');
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const raw = item.slice(2);
    const eq = raw.indexOf('=');
    if (eq >= 0) {
      parsed[toCamel(raw.slice(0, eq))] = coerce(raw.slice(eq + 1));
      continue;
    }
    const key = toCamel(raw);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      parsed[key] = coerce(next);
      i += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function coerce(value) {
  if (value === 'false') return false;
  if (value === 'true') return true;
  return value;
}
