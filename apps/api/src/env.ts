import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadLocalEnv(cwd = process.cwd()): void {
  const roots = [...new Set([process.env.INIT_CWD, cwd].filter(Boolean) as string[])];
  for (const root of roots) {
    for (const file of ['.env.local', '.env']) {
      const path = resolve(root, file);
      if (!existsSync(path)) continue;
      const lines = readFileSync(path, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = unquote(trimmed.slice(eq + 1).trim());
        if (!(key in process.env)) process.env[key] = value;
      }
    }
  }
}

function unquote(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
