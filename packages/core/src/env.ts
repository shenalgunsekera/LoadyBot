import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

/**
 * Walk up from the current directory to find the monorepo-root .env and load any
 * KEY=VALUE that isn't already set. Lets one root .env serve the bots and
 * scripts, the same way next.config loads it for the web app. Call once at
 * startup, before reading process.env.
 */
export function loadRootEnv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const p = join(dir, '.env');
    if (existsSync(p)) {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2]!.replace(/^["']|["']$/g, '');
      }
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}
