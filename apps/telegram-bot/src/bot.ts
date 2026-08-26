import { Bot, Context, InlineKeyboard, session, type SessionFlavor } from 'grammy';
import {
  accountForChat, accountByJoinToken, redeemConnectCode, redeemLinkCode, isAccountAdmin,
  accountForAdminUser, autoBindChat, markAdminChat,
  withAccount, isServiceable, botEnabled, storageConfigured, uploadReceipt, platformTotals, type Account,
} from '@loady/core';
import { money, parseAmount, resolvePlayer, platformsFor, methodsFor, adminChatFor, type Player } from './ui';
import { pgSessions } from './session-store';

interface SessionData { step: string; platformId?: string; methodId?: string; amount?: number; fillId?: string; withdrawId?: string }
export type Ctx = Context & SessionFlavor<SessionData> & { account?: Account; player?: Player };

const errText = (e: unknown) => ((e as { message?: string })?.message ?? String(e)).replace(/^error:\s*/i, '');

// Exactly the poker bot's player menu (see apps/bot/src/build.ts PLAYER_COMMANDS).
export const PLAYER_COMMANDS = [
  { command: 'start', description: 'Set up your account' },
  { command: 'deposit', description: 'Add money' },
  { command: 'canceldeposit', description: 'Cancel your latest unpaid deposit' },
  { command: 'withdraw', description: 'Cash-out' },
  { command: 'cancelwithdraw', description: 'Cancel a cash-out that has not been paid' },
  { command: 'addtowithdraw', description: 'Add more to a cash-out already in the queue' },
  { command: 'pending', description: 'Your pending cash-outs' },
  { command: 'withdrawalhistory', description: 'Cash-outs paid to you & receipts' },
  { command: 'deposithistory', description: 'Deposits you made & receipts' },
  { command: 'editplatform', description: 'Add or remove ClubGG / Sportsbook' },
  { command: 'editclubs', description: 'Change which clubs you play in' },
  { command: 'editdeposit', description: 'Change how you deposit (payment methods)' },
  { command: 'editwithdraw', description: 'Change how you get paid' },
  { command: 'support', description: 'Message our team' },
  { command: 'guide', description: 'What each command does' },
  { command: 'stop', description: "Stop whatever you're in the middle of" },
];

const GUIDE = `*Loady — how it works*

/deposit — add money to your account
/withdraw — cash out
/canceldeposit — cancel your latest unpaid deposit
/cancelwithdraw — cancel a cash-out that hasn't been paid
/pending — see your pending cash-outs
/deposithistory · /withdrawalhistory — your past activity
/support — message the team
/stop — cancel whatever you're in the middle of`;

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
        return welcome(ctx, account);
      }
    }
    if (ctx.account) return welcome(ctx, ctx.account); // connected chat → same onboarding flow
    await ctx.reply('👋 Welcome to Loady. Open your club’s link to get started, or ask an admin to add me to your club chat.');
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

  // Auto-connect: the moment a linked admin adds the bot to a group, bind that
  // group to their club — no /connect code. One admin = one club, so unambiguous.
  bot.on('my_chat_member', async (ctx) => {
    const status = ctx.myChatMember.new_chat_member.status;
    if (status !== 'member' && status !== 'administrator') return; // added or promoted only
    if (!ctx.from || ctx.chat.type === 'private') return;
    const acc = await accountForAdminUser('telegram', String(ctx.from.id));
    if (!acc || !botEnabled(acc, 'telegram')) return; // only a linked, enabled admin can bind
    const res = await autoBindChat(acc.id, 'telegram', String(ctx.chat.id), ctx.chat.title ?? null);
    if (res === 'new') {
      ctx.account = acc;
      await welcome(ctx, acc).catch(() => {}); // kick off the onboarding flow, like Poker
    }
  });

  bot.use(async (ctx, next) => {
    if (ctx.chat) {
      let account = await accountForChat('telegram', String(ctx.chat.id));
      // Lazy fallback: bot was already in the chat before it was linked. The first
      // message from a linked admin binds it (covers a missed my_chat_member event).
      if (!account && ctx.from && ctx.chat.type !== 'private') {
        const adminAcc = await accountForAdminUser('telegram', String(ctx.from.id));
        if (adminAcc && botEnabled(adminAcc, 'telegram')) {
          const res = await autoBindChat(adminAcc.id, 'telegram', String(ctx.chat.id), ctx.chat.title ?? null);
          if (res !== 'taken') account = adminAcc;
          if (res === 'new') await ctx.reply(`✅ Connected this chat to *${adminAcc.name}*.`, { parse_mode: 'Markdown' }).catch(() => {});
        }
      }
      if (account) {
        if (!botEnabled(account, 'telegram')) {
          if (ctx.message?.text?.startsWith('/')) {
            await ctx.reply(isServiceable(account.status)
              ? 'Telegram isn’t switched on for your club. Ask your Loady operator to enable it.'
              : 'This club is paused right now. An owner needs to sort out billing on the Loady dashboard.');
          }
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

  // Poker-style onboarding: greet, show the menu, and kick off account-linking.
  // Fired when the bot lands in a new chat and on /start in a connected chat.
  const welcome = async (ctx: Ctx, account: Account) => {
    const platforms = await platformsFor(account.id);
    const kb = new InlineKeyboard();
    for (const pl of platforms) kb.text(`Link ${pl.name}`, `ep:${pl.id}`).row();
    await ctx.reply(
      `👋 *Welcome to ${account.name}!*\n\nThis is your private chat with the club. Here's how it works:\n\n` +
      `💸 /deposit — add funds\n🏦 /withdraw — cash out\n📋 /pending — cash-outs in progress\n🧾 /deposithistory · /withdrawalhistory\n❓ /guide — what every command does\n\n` +
      (platforms.length
        ? `First, link your game account so we can match your deposits & cash-outs — tap below:`
        : `Ask your club admin to add a platform, then you're ready to /deposit.`),
      { parse_mode: 'Markdown', reply_markup: platforms.length ? kb : undefined },
    );
  };

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

  bot.command('canceldeposit', async (ctx) => {
    const account = await needClub(ctx); if (!account) return;
    const p = await player(ctx, account);
    ctx.session = { step: 'idle' };
    const [d] = await withAccount(account.id, (sql) => sql<{ id: string }[]>`select id from deposit_cancel(${p.id})`);
    await ctx.reply(d ? '✅ Your deposit was cancelled.' : 'You don’t have an unpaid deposit to cancel. Start one with /deposit.');
  });

  bot.command('cancelwithdraw', async (ctx) => {
    const account = await needClub(ctx); if (!account) return;
    const p = await player(ctx, account);
    try {
      const done = await withAccount(account.id, async (sql) => {
        const [w] = await sql<{ id: string }[]>`select id from withdraw_requests where player_id = ${p.id} and status in ('queued','partially_filled') order by created_at desc limit 1`;
        if (!w) return false;
        await sql`select withdraw_cancel(${w.id})`;
        return true;
      });
      await ctx.reply(done ? '✅ Your cash-out was cancelled and the funds returned to your account.' : 'You don’t have a cash-out waiting to cancel.');
    } catch (e) { await ctx.reply(`❌ ${errText(e)}`); }
  });

  bot.command('pending', async (ctx) => {
    const account = await needClub(ctx); if (!account) return;
    const p = await player(ctx, account);
    const rows = await withAccount(account.id, (sql) => sql<{ amount: number; amount_remaining: number; payout_handle: string | null }[]>`
      select amount, amount_remaining, payout_handle from withdraw_requests where player_id = ${p.id} and status in ('queued','partially_filled') order by created_at`);
    if (rows.length === 0) return ctx.reply('You have no pending cash-outs.');
    await ctx.reply(`⏳ *Your pending cash-outs:*\n${rows.map((r) => `• ${money(r.amount)} — ${money(r.amount_remaining)} still owed → \`${r.payout_handle}\``).join('\n')}`, { parse_mode: 'Markdown' });
  });

  const history = (label: string, table: 'deposit_requests' | 'withdraw_requests') =>
    async (ctx: Ctx) => {
      const account = await needClub(ctx); if (!account) return;
      const p = await player(ctx, account);
      const rows = await withAccount(account.id, (sql) => table === 'deposit_requests'
        ? sql<{ amount: number; status: string }[]>`select amount, status from deposit_requests where player_id = ${p.id} order by created_at desc limit 10`
        : sql<{ amount: number; status: string }[]>`select amount, status from withdraw_requests where player_id = ${p.id} order by created_at desc limit 10`);
      if (rows.length === 0) return ctx.reply(`No ${label} yet.`);
      await ctx.reply(`*Your ${label}:*\n${rows.map((r) => `• ${money(r.amount)} — ${r.status.replace(/_/g, ' ')}`).join('\n')}`, { parse_mode: 'Markdown' });
    };
  bot.command('deposithistory', history('deposits', 'deposit_requests'));
  bot.command('withdrawalhistory', history('cash-outs', 'withdraw_requests'));

  bot.command('stop', async (ctx) => { ctx.session = { step: 'idle' }; await ctx.reply('Okay, stopped. Start again anytime with /deposit or /withdraw.'); });
  bot.command('guide', async (ctx) => { await ctx.reply(GUIDE, { parse_mode: 'Markdown' }); });

  // Mark THIS group as the club's payments/admin group — verification cards land here.
  bot.command('setadmingroup', async (ctx) => {
    const account = await needClub(ctx); if (!account) return;
    if (ctx.chat?.type === 'private') return ctx.reply('Run this inside the group you want as your payments/admin group.');
    if (!ctx.from || !(await isAccountAdmin(account.id, 'telegram', String(ctx.from.id)))) return ctx.reply('Admins only.');
    const ok = await markAdminChat(account.id, 'telegram', String(ctx.chat.id));
    await ctx.reply(ok
      ? '✅ This group is now your payments/admin group — payment verification cards and admin alerts will come here.'
      : 'Couldn’t set this group. Make sure I’m connected to your club here first.');
  });

  // The player a chat belongs to (their tg_chat_id points here). One player per
  // group, so this is the "ticket target" for admin cash-out commands.
  const chatPlayer = (account: Account, ctx: Ctx) =>
    withAccount(account.id, async (sql) => {
      const [p] = await sql<{ id: string; display_name: string | null }[]>`
        select id, display_name from players where tg_chat_id = ${String(ctx.chat!.id)} order by created_at limit 1`;
      return p ?? null;
    });
  const adminGate = async (account: Account, ctx: Ctx) =>
    !!ctx.from && (await isAccountAdmin(account.id, 'telegram', String(ctx.from.id)));

  // Admin: pause / resume this player's cash-out (run in the player's group).
  bot.command('pausewithdraw', async (ctx) => {
    const account = await needClub(ctx); if (!account) return;
    if (!(await adminGate(account, ctx))) return ctx.reply('Admins only.');
    const p = await chatPlayer(account, ctx);
    if (!p) return ctx.reply('No player is linked to this chat yet.');
    try {
      const done = await withAccount(account.id, async (sql) => {
        const [w] = await sql<{ id: string }[]>`select id from withdraw_requests where player_id = ${p.id} and status in ('queued','partially_filled') order by created_at desc limit 1`;
        if (!w) return false;
        await sql`select withdraw_pause(${w.id})`; return true;
      });
      await ctx.reply(done ? `⏸ Paused ${p.display_name ?? 'the player'}’s cash-out — it’s out of the queue until you /resumewithdraw.` : 'That player has no cash-out in the queue.');
    } catch (e) { await ctx.reply(`❌ ${errText(e)}`); }
  });
  bot.command('resumewithdraw', async (ctx) => {
    const account = await needClub(ctx); if (!account) return;
    if (!(await adminGate(account, ctx))) return ctx.reply('Admins only.');
    const p = await chatPlayer(account, ctx);
    if (!p) return ctx.reply('No player is linked to this chat yet.');
    try {
      const done = await withAccount(account.id, async (sql) => {
        const [w] = await sql<{ id: string }[]>`select id from withdraw_requests where player_id = ${p.id} and status = 'paused' order by created_at desc limit 1`;
        if (!w) return false;
        await sql`select withdraw_resume(${w.id})`; return true;
      });
      await ctx.reply(done ? `▶️ Resumed ${p.display_name ?? 'the player'}’s cash-out — it’s back in the queue.` : 'That player has no paused cash-out.');
    } catch (e) { await ctx.reply(`❌ ${errText(e)}`); }
  });

  // Admin panel: money in / out per platform (ClubGG, Sportsbook, …).
  bot.command('totals', async (ctx) => {
    const account = await needClub(ctx); if (!account) return;
    if (!ctx.from || !(await isAccountAdmin(account.id, 'telegram', String(ctx.from.id)))) return ctx.reply('Admins only.');
    const totals = await platformTotals(account.id);
    if (totals.length === 0) return ctx.reply('No platforms set up yet.');
    let din = 0, dout = 0;
    const lines = totals.map((t) => {
      din += Number(t.deposited); dout += Number(t.withdrawn);
      const net = Number(t.deposited) - Number(t.withdrawn);
      return `*${t.name}*\n  ⬇︎ Deposited in: ${money(Number(t.deposited))}\n  ⬆︎ Cashed out: ${money(Number(t.withdrawn))}\n  ⚖︎ Net: ${money(net)}`;
    });
    await ctx.reply(`📊 *Totals by platform*\n\n${lines.join('\n\n')}\n\n————\n*All platforms* — in ${money(din)} · out ${money(dout)} · net ${money(din - dout)}`, { parse_mode: 'Markdown' });
  });

  // Link / edit a game account (ClubGG / Sportsbook).
  bot.command('editplatform', async (ctx) => {
    const account = await needClub(ctx); if (!account) return;
    const p = await player(ctx, account);
    const { platforms, linked } = await withAccount(account.id, async (sql) => {
      const platforms = await sql<{ id: string; name: string }[]>`select id, name from platforms where enabled order by sort_order, name`;
      const linked = await sql<{ platform_id: string; platform_uid: string | null }[]>`select platform_id, platform_uid from player_platforms where player_id = ${p.id}`;
      return { platforms, linked };
    });
    const map = new Map(linked.map((l) => [l.platform_id, l.platform_uid]));
    if (platforms.length === 0) return ctx.reply('No platforms are set up yet — ask an admin.');
    const lines = platforms.map((pl) => (map.has(pl.id) ? `✅ *${pl.name}*: \`${map.get(pl.id)}\`` : `▫️ *${pl.name}*: not linked`));
    const kb = new InlineKeyboard();
    for (const pl of platforms) kb.text(map.has(pl.id) ? `Change ${pl.name}` : `Add ${pl.name}`, `ep:${pl.id}`).row();
    await ctx.reply(`*Your game accounts:*\n${lines.join('\n')}\n\nTap to add or change one.`, { parse_mode: 'Markdown', reply_markup: kb });
  });
  bot.callbackQuery(/^ep:(.+)$/, async (ctx) => {
    if (!ctx.account) return ctx.answerCallbackQuery();
    ctx.session = { step: 'ep_uid', platformId: ctx.match![1]! };
    await ctx.answerCallbackQuery();
    await ctx.reply('What’s your username / ID on that platform? Send it here.');
  });

  // Assign a club to a linked platform.
  async function showClubs(ctx: Ctx, clubs: { id: string; name: string }[], platformId: string) {
    const kb = new InlineKeyboard();
    for (const c of clubs) kb.text(c.name, `ecc:${platformId}:${c.id}`).row();
    await ctx.reply('Pick your club:', { reply_markup: kb });
  }
  bot.command('editclubs', async (ctx) => {
    const account = await needClub(ctx); if (!account) return;
    const p = await player(ctx, account);
    const { clubs, linked } = await withAccount(account.id, async (sql) => {
      const clubs = await sql<{ id: string; name: string }[]>`select id, name from clubs order by name`;
      const linked = await sql<{ platform_id: string; name: string }[]>`select pp.platform_id, pf.name from player_platforms pp join platforms pf on pf.id = pp.platform_id where pp.player_id = ${p.id}`;
      return { clubs, linked };
    });
    if (clubs.length === 0) return ctx.reply('No clubs are set up yet — ask an admin.');
    if (linked.length === 0) return ctx.reply('Link your game account first with /editplatform.');
    if (linked.length === 1) return showClubs(ctx, clubs, linked[0]!.platform_id);
    const kb = new InlineKeyboard();
    for (const l of linked) kb.text(l.name, `ec:${l.platform_id}`).row();
    await ctx.reply('Which account’s club do you want to set?', { reply_markup: kb });
  });
  bot.callbackQuery(/^ec:(.+)$/, async (ctx) => {
    const account = ctx.account; if (!account) return ctx.answerCallbackQuery();
    const clubs = await withAccount(account.id, (sql) => sql<{ id: string; name: string }[]>`select id, name from clubs order by name`);
    await ctx.answerCallbackQuery();
    await showClubs(ctx, clubs, ctx.match![1]!);
  });
  bot.callbackQuery(/^ecc:(.+):(.+)$/, async (ctx) => {
    const account = ctx.account; if (!account) return ctx.answerCallbackQuery();
    const p = await player(ctx, account);
    await withAccount(account.id, (sql) => sql`select player_set_club(${p.id}, ${ctx.match![1]!}, ${ctx.match![2]!})`);
    await ctx.answerCallbackQuery({ text: 'Saved ✓' });
    await ctx.reply('✅ Club saved.');
  });

  bot.command('editdeposit', async (ctx) => {
    const account = await needClub(ctx); if (!account) return;
    const methods = await methodsFor(account.id);
    await ctx.reply(`💸 *You can deposit with:*\n${methods.map((m) => '• ' + m.name).join('\n') || '—'}\n\nStart anytime with /deposit.`, { parse_mode: 'Markdown' });
  });
  bot.command('editwithdraw', async (ctx) => {
    const account = await needClub(ctx); if (!account) return;
    const methods = await methodsFor(account.id, true);
    await ctx.reply(`💵 *You can get paid with:*\n${methods.map((m) => '• ' + m.name).join('\n') || '—'}\n\nWe’ll ask where to send it when you /withdraw.`, { parse_mode: 'Markdown' });
  });

  // Add more to a cash-out that's already waiting in the queue.
  bot.command('addtowithdraw', async (ctx) => {
    const account = await needClub(ctx); if (!account) return;
    const p = await player(ctx, account);
    const [w] = await withAccount(account.id, (sql) => sql<{ id: string; amount: number; payout_handle: string | null }[]>`
      select id, amount, payout_handle from withdraw_requests
       where player_id = ${p.id} and status in ('queued','partially_filled','paused') order by created_at desc limit 1`);
    if (!w) { ctx.session = { step: 'idle' }; return ctx.reply('You have no cash-out in the queue to add to. Start one with /withdraw.'); }
    ctx.session = { step: 'atw_amount', withdrawId: w.id };
    await ctx.reply(`Your current cash-out is *${money(w.amount)}*${w.payout_handle ? ` → \`${w.payout_handle}\`` : ''}.\nHow much would you like to *add*? Send the number, e.g. \`25\`.`, { parse_mode: 'Markdown' });
  });

  // Message the team — relays the next message the player sends to the admin chat.
  bot.command('support', async (ctx) => {
    const account = await needClub(ctx); if (!account) return;
    ctx.session = { step: 'support_msg' };
    await ctx.reply('What do you need help with? Send your message and we’ll pass it straight to the team.');
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
    if (s.step === 'ep_uid') {
      const uid = ctx.message.text.trim();
      const p = await player(ctx, account);
      await withAccount(account.id, (sql) => sql`select player_set_platform(${p.id}, ${s.platformId!}, ${uid})`);
      ctx.session = { step: 'idle' };
      return ctx.reply('✅ Saved. You can /deposit or /withdraw now.');
    }
    if (s.step === 'wd_amount') {
      const amount = parseAmount(ctx.message.text);
      if (amount == null) return ctx.reply('That doesn’t look like an amount. Try `50`.', { parse_mode: 'Markdown' });
      ctx.session = { ...s, step: 'wd_handle', amount };
      return ctx.reply('Where should we send it? Send your payout handle (e.g. your Venmo / Zelle / wallet).');
    }
    if (s.step === 'support_msg') {
      const p = await player(ctx, account);
      ctx.session = { step: 'idle' };
      const adminChat = await adminChatFor(account.id);
      if (!adminChat) return ctx.reply('Support isn’t set up for your club yet — please reach your admin directly.');
      const who = p.display_name ?? ctx.from?.first_name ?? 'A player';
      const tag = ctx.from?.username ? ` (@${ctx.from.username})` : '';
      await bot.api.sendMessage(adminChat, `🆘 Support request from ${who}${tag}:\n\n${ctx.message.text}`).catch((e) => console.error('[support]', e));
      return ctx.reply('✅ Sent to the team — they’ll get back to you here.');
    }
    if (s.step === 'atw_amount') {
      const amount = parseAmount(ctx.message.text);
      if (amount == null) return ctx.reply('That doesn’t look like an amount. Try `25`.', { parse_mode: 'Markdown' });
      try {
        const [w] = await withAccount(account.id, (sql) => sql<{ amount: number; payout_handle: string | null }[]>`
          select amount, payout_handle from withdraw_topup(${s.withdrawId!}, ${amount})`);
        ctx.session = { step: 'idle' };
        await ctx.reply(`✅ *Added ${money(amount)}.* Your cash-out is now *${money(w!.amount)}*${w!.payout_handle ? ` → \`${w!.payout_handle}\`` : ''} and still in the queue.`, { parse_mode: 'Markdown' });
      } catch (e) { ctx.session = { step: 'idle' }; await ctx.reply(`❌ ${errText(e)}`); }
      return;
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

    await withAccount(account.id, (sql) => sql`select fill_submit_proof(${s.fillId!}, null, null)`);

    // Save the screenshot durably (Supabase Storage) + record the receipt row.
    try {
      if (storageConfigured()) {
        const file = await ctx.api.getFile(fileId);
        const dl = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${file.file_path}`);
        const bytes = new Uint8Array(await dl.arrayBuffer());
        const ct = ctx.message.document?.mime_type ?? 'image/jpeg';
        const path = await uploadReceipt(account.id, s.fillId!, bytes, ct);
        if (path) await withAccount(account.id, (sql) => sql`select receipt_add(${s.fillId!}, ${path}, ${ct})`);
      }
    } catch (e) { console.error('[receipt store]', e); }

    const info = await withAccount(account.id, async (sql) => {
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
