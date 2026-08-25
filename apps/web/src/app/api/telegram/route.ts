import { webhookCallback } from 'grammy';
import { buildBot } from '@loady/telegram-bot/bot';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// One shared bot, driven by Telegram webhooks (serverless). Flow state lives in
// the DB (bot_sessions), so cold starts don't lose a player mid-deposit.
const bot = buildBot();
const handle = webhookCallback(bot, 'std/http', { secretToken: process.env.TELEGRAM_WEBHOOK_SECRET });

export async function POST(req: Request): Promise<Response> {
  return handle(req);
}
