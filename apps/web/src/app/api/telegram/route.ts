import { webhookCallback } from 'grammy';
import { buildBot } from '@loady/telegram-bot/bot';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Build the bot lazily on the first request — NOT at import time — so Vercel's
// build-time page-data collection doesn't need TELEGRAM_TOKEN. Flow state lives
// in the DB (bot_sessions), so cold starts don't lose a player mid-deposit.
let handle: ((req: Request) => Promise<Response>) | null = null;

export async function POST(req: Request): Promise<Response> {
  if (!handle) {
    const bot = buildBot();
    handle = webhookCallback(bot, 'std/http', { secretToken: process.env.TELEGRAM_WEBHOOK_SECRET });
  }
  return handle(req);
}
