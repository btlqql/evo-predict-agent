import { spawn } from 'node:child_process';

export interface CodexExecOptions {
  prompt: string;
  cwd?: string;
  sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access';
  json?: boolean;
  timeoutMs?: number;
}

export interface CodexExecResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
}

export function runCodexExec(options: CodexExecOptions): Promise<CodexExecResult> {
  const codexBin = process.env.CODEX_BIN || 'codex';
  const args = ['exec'];
  if (options.json) args.push('--json');
  if (options.sandbox) args.push('--sandbox', options.sandbox);
  args.push(options.prompt);

  return new Promise((resolve, reject) => {
    const child = spawn(codexBin, args, {
      cwd: options.cwd || process.env.CODEX_DEFAULT_CWD || process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`codex exec timed out after ${options.timeoutMs ?? 300000}ms`));
    }, options.timeoutMs ?? 300000);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}
