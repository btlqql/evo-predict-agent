import { resolve } from 'node:path';

export function projectRoot(): string {
  return resolve(process.env.INIT_CWD || process.env.EVOMATE_PROJECT_ROOT || process.cwd());
}

export function resolveFromProjectRoot(pathOrDefault: string): string {
  return resolve(projectRoot(), pathOrDefault);
}
