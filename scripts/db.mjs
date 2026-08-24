import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import postgres from 'postgres';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Load DATABASE_URL from the environment or a local .env, and connect. */
export function connect(opts = {}) {
  let url = process.env.DATABASE_URL;
  if (!url) {
    const envPath = join(ROOT, '.env');
    if (existsSync(envPath)) {
      const m = readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.+)$/m);
      if (m) url = m[1].trim();
    }
  }
  if (!url) {
    console.error('DATABASE_URL is not set (env or .env).');
    process.exit(1);
  }
  return postgres(url, { ssl: 'require', max: 1, ...opts });
}
