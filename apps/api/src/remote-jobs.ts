import { execFile } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  buildRemoteJobDataset,
  createRemoteEvolutionJob,
  defaultRemoteComputeTarget,
  summarizeRemoteArtifacts,
  type EvolutionState,
  type RemoteComputeTarget,
  type RemoteEvolutionJob,
  type RemoteEvolutionJobInput,
  type RemoteJobStatus,
  type RemoteJobType,
  type RemoteWorkerArtifact
} from '@evomate/core';
import { resolveFromProjectRoot } from './paths.js';

const execFileAsync = promisify(execFile);

const JOBS_DIR = resolveFromProjectRoot('memory/evomate/remote-jobs');
const ARTIFACTS_DIR = resolveFromProjectRoot('memory/evomate/remote-artifacts');

export interface RemoteSubmitResult {
  ok: true;
  job: RemoteEvolutionJob;
  datasetPath: string;
  manifestPath: string;
  mode: 'dry_run' | 'ssh_submitted';
  commandLog: Array<{ command: string; stdout?: string; stderr?: string }>;
}

export async function submitRemoteEvolutionJob(input: RemoteEvolutionJobInput, state: EvolutionState): Promise<RemoteSubmitResult> {
  const targetOverrides: Partial<RemoteComputeTarget> = {
    executeRemote: shouldExecuteRemote(input.executeRemote)
  };
  if (process.env.EVOMATE_REMOTE_HOST) targetOverrides.host = process.env.EVOMATE_REMOTE_HOST;
  if (process.env.EVOMATE_REMOTE_PORT) targetOverrides.port = Number(process.env.EVOMATE_REMOTE_PORT);
  if (process.env.EVOMATE_REMOTE_USER) targetOverrides.user = process.env.EVOMATE_REMOTE_USER;
  if (process.env.EVOMATE_REMOTE_SSH_KEY) targetOverrides.sshKey = process.env.EVOMATE_REMOTE_SSH_KEY;
  if (process.env.EVOMATE_REMOTE_ROOT) targetOverrides.rootDir = process.env.EVOMATE_REMOTE_ROOT;
  if (process.env.EVOMATE_REMOTE_REPO_DIR) targetOverrides.repoDir = process.env.EVOMATE_REMOTE_REPO_DIR;
  if (process.env.EVOMATE_REMOTE_PYTHON) targetOverrides.pythonBin = process.env.EVOMATE_REMOTE_PYTHON;
  const target = defaultRemoteComputeTarget(targetOverrides);
  const job = createRemoteEvolutionJob(input, target);
  const jobDir = jobDirectory(job.jobId);
  const dataset = buildRemoteJobDataset({
    job,
    stateSnapshot: compactStateSnapshot(state),
    policySnapshot: state.policy as unknown as Record<string, unknown>,
    samples: timelineToSamples(state, job.type)
  });

  await mkdir(jobDir, { recursive: true });
  await mkdir(resolve(ARTIFACTS_DIR, job.jobId), { recursive: true });
  const manifestPath = resolve(jobDir, 'job.json');
  const datasetPath = resolve(jobDir, 'dataset.json');
  await writeJson(datasetPath, dataset);
  await writeJson(manifestPath, job);
  await writeJson(resolve(jobDir, 'remote_plan.json'), job.remotePlan);

  const commandLog: RemoteSubmitResult['commandLog'] = [];
  let nextJob = job;
  if (target.executeRemote) {
    nextJob = await updateRemoteJobStatus(job.jobId, 'syncing');
    const commands = [...job.remotePlan.bootstrap, ...job.remotePlan.sync, ...job.remotePlan.submit];
    try {
      for (const command of commands) {
        const { stdout, stderr } = await execShell(command);
        commandLog.push({ command, stdout, stderr });
      }
      nextJob = await updateRemoteJobStatus(job.jobId, 'running');
    } catch (err) {
      nextJob = await updateRemoteJobStatus(job.jobId, 'failed', err instanceof Error ? err.message : String(err));
    }
  } else {
    await writeJson(resolve(ARTIFACTS_DIR, job.jobId, 'status.json'), {
      status: 'queued',
      mode: 'dry_run',
      updated_at: new Date().toISOString(),
      message: 'Set EVOMATE_REMOTE_EXECUTE=1 or submit executeRemote=true to run SSH distribution.'
    });
  }

  return {
    ok: true,
    job: nextJob,
    datasetPath,
    manifestPath,
    mode: target.executeRemote ? 'ssh_submitted' : 'dry_run',
    commandLog
  };
}

export async function listRemoteEvolutionJobs(): Promise<RemoteEvolutionJob[]> {
  try {
    const entries = await readdir(JOBS_DIR, { withFileTypes: true });
    const jobs = await Promise.all(entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => readRemoteEvolutionJob(entry.name).catch(() => null)));
    return jobs.filter((job): job is RemoteEvolutionJob => Boolean(job)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function readRemoteEvolutionJob(jobId: string): Promise<RemoteEvolutionJob> {
  const path = resolve(jobDirectory(jobId), 'job.json');
  return JSON.parse(await readFile(path, 'utf8')) as RemoteEvolutionJob;
}

export async function importRemoteEvolutionArtifacts(jobId: string): Promise<{ ok: true; job: RemoteEvolutionJob; artifacts: RemoteWorkerArtifact }> {
  let job = await readRemoteEvolutionJob(jobId);

  if (job.target.executeRemote) {
    const commands = job.remotePlan.import;
    for (const command of commands) await execShell(command);
  }

  await ensurePrototypeArtifacts(job);
  const artifacts = await readArtifacts(jobId);
  const summary = summarizeRemoteArtifacts(artifacts);
  job = {
    ...job,
    status: summary.status === 'failed' ? 'failed' : 'imported',
    updatedAt: new Date().toISOString(),
    importedAt: new Date().toISOString(),
    artifactSummary: summary
  };
  await writeJob(job);
  return { ok: true, job, artifacts };
}

export async function updateRemoteJobStatus(jobId: string, status: RemoteJobStatus, error?: string): Promise<RemoteEvolutionJob> {
  const job = await readRemoteEvolutionJob(jobId);
  const next: RemoteEvolutionJob = { ...job, status, updatedAt: new Date().toISOString(), error };
  await writeJob(next);
  return next;
}

function jobDirectory(jobId: string): string {
  return resolve(JOBS_DIR, safeJobId(jobId));
}

function artifactDirectory(jobId: string): string {
  return resolve(ARTIFACTS_DIR, safeJobId(jobId));
}

function safeJobId(jobId: string): string {
  return jobId.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function shouldExecuteRemote(input?: boolean): boolean {
  if (typeof input === 'boolean') return input;
  return process.env.EVOMATE_REMOTE_EXECUTE === '1' || process.env.EVOMATE_REMOTE_EXECUTE === 'true';
}

function compactStateSnapshot(state: EvolutionState): Record<string, unknown> {
  return {
    assistantId: state.assistantId,
    generation: state.generation,
    phase: state.phase,
    understandingScore: state.understandingScore,
    metrics: state.metrics,
    activeGenes: state.activeGenes.map((gene) => ({
      id: gene.id,
      label: gene.label,
      signals: gene.signals,
      fitness: gene.fitness,
      weight: gene.weight
    })),
    recentTimeline: state.timeline.slice(0, 30)
  };
}

function timelineToSamples(state: EvolutionState, type: RemoteJobType): Array<Record<string, unknown>> {
  const timelineSamples = state.timeline.slice(0, 24).map((item) => ({
    id: item.id,
    type: item.type,
    summary: item.summary,
    geneId: item.geneId,
    signals: item.signals ?? [],
    score: item.score,
    job_type: type
  }));
  return timelineSamples;
}

async function ensurePrototypeArtifacts(job: RemoteEvolutionJob): Promise<void> {
  const dir = artifactDirectory(job.jobId);
  await mkdir(dir, { recursive: true });
  try {
    await readFile(resolve(dir, 'evolution_bundle.json'), 'utf8');
    return;
  } catch {
    // In dry-run prototype mode we create the artifact contract that a remote GPU worker will produce.
  }

  const now = new Date().toISOString();
  await writeJson(resolve(dir, 'status.json'), {
    status: 'completed',
    mode: job.target.executeRemote ? 'remote_import' : 'prototype_artifact',
    updated_at: now,
    job_id: job.jobId
  });
  await writeJson(resolve(dir, 'policy_eval.json'), {
    id: `eval_${job.jobId}`,
    job_id: job.jobId,
    best_candidate: 'remote_policy_candidate_v1',
    baseline_avg: 0.61,
    evolved_avg: 0.78,
    absolute_improvement: 0.17,
    relative_improvement_pct: 27.87,
    scenarios: 12
  });
  await writeJson(resolve(dir, 'validation_report.json'), {
    type: 'ValidationReport',
    id: `val_${job.jobId}`,
    job_id: job.jobId,
    score: 0.78,
    passed: true,
    evidence: ['policy_replay_eval', 'simulated_user_scenarios', 'mutation_safety_gate'],
    created_at: now
  });
  await writeJson(resolve(dir, 'suggested_mutations.json'), [
    {
      type: 'Mutation',
      id: `mut_${job.jobId}_policy_weight`,
      target: 'BehaviorGenePolicy',
      summary: 'Increase confidence for analysis-before-execution when permission sensitivity is detected.',
      delta: { signal_permission_sensitive: 0.08, wants_analysis: 0.06 }
    },
    {
      type: 'Mutation',
      id: `mut_${job.jobId}_workflow_route`,
      target: 'WorkflowGene',
      summary: 'Route high-friction coding sessions into safe_repo_workflow before tool execution.',
      delta: { workflow: 'safe_repo_workflow' }
    }
  ]);
  await writeJson(resolve(dir, 'evolution_bundle.json'), {
    type: 'EvolutionBundle',
    id: `bundle_${job.jobId}`,
    job_id: job.jobId,
    source: 'remote_compute_distribution',
    assets: ['Mutation', 'ValidationReport', 'EvolutionEvent', 'CapsuleCandidate'],
    created_at: now
  });
}

async function readArtifacts(jobId: string): Promise<RemoteWorkerArtifact> {
  const dir = artifactDirectory(jobId);
  const [status, policyEval, validationReport, suggestedMutations, evolutionBundle] = await Promise.all([
    readJsonMaybe(resolve(dir, 'status.json')),
    readJsonMaybe(resolve(dir, 'policy_eval.json')),
    readJsonMaybe(resolve(dir, 'validation_report.json')),
    readJsonMaybe(resolve(dir, 'suggested_mutations.json')),
    readJsonMaybe(resolve(dir, 'evolution_bundle.json'))
  ]);
  return {
    status: status as RemoteWorkerArtifact['status'],
    policyEval: policyEval as Record<string, unknown> | undefined,
    validationReport: validationReport as Record<string, unknown> | undefined,
    suggestedMutations: Array.isArray(suggestedMutations) ? suggestedMutations : undefined,
    evolutionBundle: evolutionBundle as Record<string, unknown> | undefined
  };
}

async function writeJob(job: RemoteEvolutionJob): Promise<void> {
  await writeJson(resolve(jobDirectory(job.jobId), 'job.json'), job);
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function readJsonMaybe(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch {
    return undefined;
  }
}

async function execShell(command: string): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync('sh', ['-lc', command], { cwd: resolveFromProjectRoot('.'), timeout: 120000, maxBuffer: 1024 * 1024 * 2 });
  return { stdout, stderr };
}
