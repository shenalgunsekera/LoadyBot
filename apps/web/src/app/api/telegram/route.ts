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
    // No secret_token check — the webhook is accepted as-is so setup never needs a
    // matching TELEGRAM_WEBHOOK_SECRET. (The bot token in the URL path is the guard.)
    handle = webhookCallback(bot, 'std/http');
  }
  // Always 200 back to Telegram. A thrown handler error (e.g. a callback query that
  // expired during a cold start) must never surface as a 500 — that makes Telegram
  // retry-storm the same update and leaves the user's button "stuck".
  try {
    return await handle(req);
  } catch (e) {
    console.error('[telegram webhook]', e);
    return new Response('ok');
  }
}
