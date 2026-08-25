import { loadRootEnv } from '@loady/core';
import { buildBot, PLAYER_COMMANDS } from './bot';

// `pnpm -C apps/telegram-bot register` — publish the command menu (matches poker).
loadRootEnv();
const bot = buildBot();
await bot.api.setMyCommands(PLAYER_COMMANDS);
console.log(`[telegram] set ${PLAYER_COMMANDS.length} commands`);
process.exit(0);
