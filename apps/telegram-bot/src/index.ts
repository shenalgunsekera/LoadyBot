import { loadRootEnv } from '@loady/core';
import { buildBot } from './bot';

// Local development: long-poll. Production runs as a Vercel webhook
// (apps/web/src/app/api/telegram) using the same buildBot().
loadRootEnv();
const bot = buildBot();
console.log('[telegram] Loady bot starting (long-poll dev mode)…');
bot.start();
