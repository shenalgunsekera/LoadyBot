import { Bot, Context, InlineKeyboard, session, type SessionFlavor } from 'grammy';
import {
  accountForChat, accountByJoinToken, redeemConnectCode, redeemLinkCode, isAccountAdmin,
  withAccount, isServiceable, type Account,
} from '@loady/core';
import { money, parseAmount, resolvePlayer, platformsFor, methodsFor, adminChatFor, type Player } from './ui';
import { pgSessions } from './session-store';

interface SessionData { step: string; platformId?: string; methodId?: string; amount?: number; fillId?: string }
export type Ctx = Context & SessionFlavor<SessionData> & { account?: Account; player?: Player };

const errText = (e: unknown) => ((e as { message?: string })?.message ?? String(e)).replace(/^error:\s*/i, '');

/** Build the bot with every handler registered. Shared by the dev long-poll
 *  entry (index.ts) and the Vercel webhook (apps/web/api/telegram). */
export function buildBot(): Bot<Ctx> {
  const token = process.env.TELEGRAM_TOKEN;
  if (!token) throw new Error('TELEGRAM_TOKEN is not set');
  const bot = new Bot<Ctx>(token);

  bot.use(session<SessionData, Ctx>({
    initial: () => ({ step: 'idle' }),
    getSessionKey: (ctx) => (ctx.chat && ctx.from ? `${ctx.chat.id}:${ctx.from.id}` : undefined),
    storage: pgSessions<SessionData>(),
  }));

  bot.command('start', async (ctx) => {
    const arg = (ctx.match ?? '').trim();
    if (arg && ctx.chat?.type === 'private') {
      const account = await accountByJoinToken(arg);
      if (account) {
        await resolvePlayer(account.id, String(ctx.from!.id), ctx.from?.username ?? null, String(ctx.chat.id));
        return ctx.reply(`👋 You're connected to *${account.name}*. Use /deposit to add funds or /withdraw to cash out.`, { parse_mode: 'Markdown' });
      }
    }
    await ctx.reply('👋 Welcome to Loady. Open your club’s link to get started, or ask an admin to connect this chat with /connect.');
  });

  bot.command('connect', async (ctx) => {
    const code = (ctx.match ?? '').trim().toUpperCase();
    if (!code) return ctx.reply('Send the code from your dashboard, e.g. /connect LOADY-7F3K');
    const title = ctx.chat && 'title' in ctx.chat ? ctx.chat.title ?? null : null;
    const r = await redeemConnectCode(code, 'telegram', String(ctx.chat!.id), title);
    await ctx.reply(r.ok ? '✅ Connected! This chat is now linked to your club on Loady.' : `❌ ${r.error}`);
  });

  bot.command('link', async (ctx) => {
    const code = (ctx.match ?? '').trim().toUpperCase();
    if (!code) return ctx.reply('Send the link code from your dashboard, e.g. /link LOADY-AB12');
    const r = await redeemLinkCode(code, 'telegram', String(ctx.from!.id));
    await ctx.reply(r.ok ? `✅ Linked! You can now verify payments and run admin commands for *${r.accountName}*.` : `❌ ${r.error}`, { parse_mode: 'Markdown' });
  });

  bot.use(async (ctx, next) => {
    if (ctx.chat) {
      const account = await accountForChat('telegram', String(ctx.chat.id));
      if (account) {
        if (!isServiceable(account.status)) {
          if (ctx.message?.text?.startsWith('/')) await ctx.reply('This club is paused right now. An owner needs to sort out billing on the Loady dashboard.');
          return;
        }
        ctx.account = account;
      }
    }
    await next();
  });

  const needClub = async (ctx: Ctx): Promise<Account | null> => {
    if (ctx.account) return ctx.account;
    await ctx.reply('This chat isn’t linked to a club yet. An admin can run /connect <code>, or open your club’s link.');
    return null;
  };
  const player = (ctx: Ctx, account: Account) => resolvePlayer(account.id, String(ctx.from!.id), ctx.from?.username ?? null, String(ctx.chat!.id));

  bot.command('deposit', async (ctx) => {
    const account = await needClub(ctx); if (!account) return;
    const platforms = await platformsFor(account.id);
    if (platforms.length === 0) return ctx.reply('No platforms are set up yet — ask an admin to add one.');
    if (platforms.length === 1) return showDepositMethods(ctx, account, platforms[0]!.id);
    const kb = new InlineKeyboard();
    for (const p of platforms) kb.text(p.name, `dp:${p.id}`).row();
    await ctx.reply('Which account are you adding to?', { reply_markup: kb });
  });

  async function showDepositMethods(ctx: Ctx, account: Account, platformId: string) {
    const methods = await methodsFor(account.id);
    if (methods.length === 0) return ctx.reply('No payment methods are set up yet — ask an admin.');
    const kb = new InlineKeyboard();
    for (const m of methods) kb.text(m.name, `dm:${platformId}:${m.id}`).row();
    await ctx.reply('How would you like to pay?', { reply_markup: kb });
  }

  bot.callbackQuery(/^dp:(.+)$/, async (ctx) => {
    const account = ctx.account; if (!account) return ctx.answerCallbackQuery();
    await ctx.answerCallbackQuery();
    await showDepositMethods(ctx, account, ctx.match![1]!);
  });
  bot.callbackQuery(/^dm:(.+):(.+)$/, async (ctx) => {
    if (!ctx.account) return ctx.answerCallbackQuery();
    ctx.session = { step: 'dep_amount', platformId: ctx.match![1]!, methodId: ctx.match![2]! };
    await ctx.answerCallbackQuery();
    await ctx.reply('How much would you like to add? Send the number, e.g. `50`.', { parse_mode: 'Markdown' });
  });

  bot.command('withdraw', async (ctx) => {
    const account = await needClub(ctx); if (!account) return;
    const platforms = await platformsFor(account.id);
    if (platforms.length === 0) return ctx.reply('No platforms are set up yet — ask an admin.');
    if (platforms.length === 1) return showWithdrawMethods(ctx, account, platforms[0]!.id);
    const kb = new InlineKeyboard();
    for (const p of platforms) kb.text(p.name, `wp:${p.id}`).row();
    await ctx.reply('Which account are you cashing out from?', { reply_markup: kb });
  });
  async function showWithdrawMethods(ctx: Ctx, account: Account, platformId: string) {
    const methods = await methodsFor(account.id, true);
    if (methods.length === 0) return ctx.reply('No cash-out methods are set up yet — ask an admin.');
    const kb = new InlineKeyboard();
    for (const m of methods) kb.text(m.name, `wm:${platformId}:${m.id}`).row();
    await ctx.reply('How would you like to get paid?', { reply_markup: kb });
  }
  bot.callbackQuery(/^wp:(.+)$/, async (ctx) => {
    const account = ctx.account; if (!account) return ctx.answerCallbackQuery();
    await ctx.answerCallbackQuery();
    await showWithdrawMethods(ctx, account, ctx.match![1]!);
  });
  bot.callbackQuery(/^wm:(.+):(.+)$/, async (ctx) => {
    ctx.session = { step: 'wd_amount', platformId: ctx.match![1]!, methodId: ctx.match![2]! };
    await ctx.answerCallbackQuery();
    await ctx.reply('How much would you like to cash out? Send the number, e.g. `50`.', { parse_mode: 'Markdown' });
  });

  bot.on('message:text', async (ctx, next) => {
    if (ctx.message.text.startsWith('/')) return next();
    const account = ctx.account; if (!account) return next();
    const s = ctx.session;

    if (s.step === 'dep_amount') {
      const amount = parseAmount(ctx.message.text);
      if (amount == null) return ctx.reply('That doesn’t look like an amount. Try `50`.', { parse_mode: 'Markdown' });
      const p = await player(ctx, account);
      try {
        const info = await withAccount(account.id, async (sql) => {
          const [d] = await sql<{ id: string }[]>`select id from deposit_create(${p.id}, ${s.platformId!}, ${s.methodId!}, ${amount})`;
          const [f] = await sql<{ id: string; withdraw_id: string | null; payout_handle: string | null; club_handle: string | null }[]>`
            select f.id, f.withdraw_id, f.payout_handle, pm.club_handle from fills f join payment_methods pm on pm.id = f.method_id
             where f.deposit_id = ${d!.id} order by seq limit 1`;
          return f!;
        });
        const handle = info.payout_handle ?? info.club_handle;
        ctx.session = { step: 'dep_receipt', fillId: info.id };
        await ctx.reply(`💸 *Send ${money(amount)} now.*\n\n` + (handle ? `Pay to: \`${handle}\`\n\n` : `An admin will send you where to pay shortly.\n\n`) + `Once you’ve paid, send a *screenshot* here so we can confirm it and add your money.`, { parse_mode: 'Markdown' });
      } catch (e) { ctx.session = { step: 'idle' }; await ctx.reply(`❌ ${errText(e)}`); }
      return;
    }
    if (s.step === 'wd_amount') {
      const amount = parseAmount(ctx.message.text);
      if (amount == null) return ctx.reply('That doesn’t look like an amount. Try `50`.', { parse_mode: 'Markdown' });
      ctx.session = { ...s, step: 'wd_handle', amount };
      return ctx.reply('Where should we send it? Send your payout handle (e.g. your Venmo / Zelle / wallet).');
    }
    if (s.step === 'wd_handle') {
      const handle = ctx.message.text.trim();
      const p = await player(ctx, account);
      try {
        const [w] = await withAccount(account.id, (sql) => sql<{ id: string; amount: number }[]>`
          select id, amount from withdraw_create(${p.id}, ${s.platformId!}, ${s.methodId!}, ${s.amount!}, ${handle})`);
        ctx.session = { step: 'idle' };
        await ctx.reply(`✅ *Cash-out for ${money(w!.amount)} is in the queue.* We’ll pay it to \`${handle}\` and message you here when it’s done.`, { parse_mode: 'Markdown' });
      } catch (e) { ctx.session = { step: 'idle' }; await ctx.reply(`❌ ${errText(e)}`); }
      return;
    }
    return next();
  });

  bot.on(['message:photo', 'message:document'], async (ctx) => {
    const account = ctx.account; if (!account) return;
    const s = ctx.session;
    if (s.step !== 'dep_receipt' || !s.fillId) return;
    const fileId = ctx.message.photo?.at(-1)?.file_id ?? ctx.message.document?.file_id;
    if (!fileId) return ctx.reply('Send a picture of your payment confirmation.');

    const info = await withAccount(account.id, async (sql) => {
      await sql`select fill_submit_proof(${s.fillId!}, null, null)`;
      const [f] = await sql<{ amount: number; name: string | null }[]>`
        select f.amount, dp.display_name as name from fills f
          left join deposit_requests d on d.id = f.deposit_id left join players dp on dp.id = d.player_id
         where f.id = ${s.fillId!}`;
      return f!;
    });
    ctx.session = { step: 'idle' };
    await ctx.reply('✅ Got your screenshot! We’ll check it and add your money — you’ll get a message here the moment it’s done.');

    const adminChat = await adminChatFor(account.id);
    if (adminChat) {
      const kb = new InlineKeyboard().text('✅ Verify & credit', `v:${s.fillId}`).text('🗑 Discard', `x:${s.fillId}`);
      await bot.api.sendPhoto(adminChat, fileId, {
        caption: `🧾 *Deposit to verify* — ${money(info.amount)} from ${info.name ?? 'a player'}.\nCheck it landed, then Verify.`,
        parse_mode: 'Markdown', reply_markup: kb,
      }).catch((e) => console.error('[admin card]', e));
    }
  });

  bot.callbackQuery(/^v:(.+)$/, async (ctx) => {
    const account = await accountForChat('telegram', String(ctx.chat!.id));
    if (!account || !(await isAccountAdmin(account.id, 'telegram', String(ctx.from.id)))) return ctx.answerCallbackQuery({ text: 'Admins only.' });
    try {
      await withAccount(account.id, (sql) => sql`select fill_release(${ctx.match![1]!}, null, 'verified in telegram')`);
      await ctx.answerCallbackQuery({ text: 'Credited ✓' });
      await ctx.editMessageCaption({ caption: `✅ Verified & credited by @${ctx.from.username ?? ctx.from.first_name}.` }).catch(() => {});
    } catch (e) { await ctx.answerCallbackQuery({ text: errText(e).slice(0, 190) }); }
  });
  bot.callbackQuery(/^x:(.+)$/, async (ctx) => {
    const account = await accountForChat('telegram', String(ctx.chat!.id));
    if (!account || !(await isAccountAdmin(account.id, 'telegram', String(ctx.from.id)))) return ctx.answerCallbackQuery({ text: 'Admins only.' });
    await withAccount(account.id, (sql) => sql`update fills set status = 'discarded' where id = ${ctx.match![1]!} and status = 'awaiting_confirmation'`);
    await ctx.answerCallbackQuery({ text: 'Discarded' });
    await ctx.editMessageCaption({ caption: '🗑 Discarded.' }).catch(() => {});
  });

  bot.catch((err) => console.error('[telegram] error', err.error));
  return bot;
}
