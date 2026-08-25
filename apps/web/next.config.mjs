import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Load the monorepo-root .env so one file serves the web app, bots and scripts.
// Next only reads its own dir by default; this pulls in DATABASE_URL etc.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const envPath = join(root, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@loady/core', '@loady/telegram-bot'],
  serverExternalPackages: ['postgres'],
};

export default nextConfig;
