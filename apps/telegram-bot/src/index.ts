import { Bot, type Context } from 'grammy';
import {
  accountForChat, redeemConnectCode, withAccount, isServiceable,
  type Account,
} from '@loady/core';

/**
 * The ONE shared Loady Telegram bot. Every account adds this same bot to its
 * group. A request is routed to its account by the chat it came from — then all
 * data access happens inside withAccount(), where RLS seals it off. No per-tenant
 * bots, no cross-account leakage.
 */
const token = process.env.TELEGRAM_TOKEN;
if (!token) throw new Error('TELEGRAM_TOKEN is not set');

type Ctx = Context & { account?: Account };
const bot = new Bot<Ctx>(token);

// ── /connect <CODE> — bind this group to the account that generated the code ──
bot.command('connect', async (ctx) => {
  const code = (ctx.match ?? '').trim().toUpperCase();
  if (!code) return ctx.reply('Send the code from your dashboard, e.g. /connect LOADY-7F3K');
  const chatId = String(ctx.chat!.id);
  const title = 'title' in ctx.chat! ? ctx.chat.title ?? null : null;
  const r = await redeemConnectCode(code, 'telegram', chatId, title);
  await ctx.reply(r.ok ? '✅ Connected! This group is now linked to your club on Loady.' : `❌ ${r.error}`);
});

// ── Route every other update to its account, gate on billing, then handle ────
bot.use(async (ctx, next) => {
  if (ctx.chat) {
    const account = await accountForChat('telegram', String(ctx.chat.id));
    if (account) {
      if (!isServiceable(account.status)) {
        // Paid-up gate — a suspended club's bot politely stands down.
        if (ctx.message?.text?.startsWith('/')) {
          await ctx.reply('This club is paused right now. An owner needs to sort out billing on the Loady dashboard.');
        }
        return;
      }
      ctx.account = account;
    }
  }
  await next();
});

// ── Example tenant-scoped command (data access is sealed to ctx.account) ─────
bot.command('players', async (ctx) => {
  if (!ctx.account) return ctx.reply('This chat isn’t connected to a club yet. An admin can run /connect <code>.');
  const rows = await withAccount(ctx.account.id, (sql) =>
    sql<{ n: number }[]>`select count(*)::int as n from players`);
  await ctx.reply(`👥 ${rows[0]!.n} players in ${ctx.account.name}.`);
  // TODO(engine): port /deposit, /withdraw, /cancel… — each wrapped in
  // withAccount(ctx.account.id, …) so it can only ever touch this club's data.
});

bot.catch((err) => console.error('[telegram] error', err.error));

console.log('[telegram] Loady bot starting (long-poll dev mode)…');
bot.start();
