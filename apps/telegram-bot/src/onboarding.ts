import { Bot, InlineKeyboard } from 'grammy';
import { withAccount, type Account } from '@loady/core';
import type { Ctx } from './bot';
import { resolvePlayer, type Player } from './ui';

/**
 * GUIDED ONBOARDING — the poker bot's flow, ported to Loady.
 * ═════════════════════════════════════════════════════════
 * One guided sequence collects everything before a player's first move, in the
 * SAME chat it was started in, and remembers it so nothing is re-typed later:
 *
 *   name
 *   → which platform(s): tap all that apply
 *   → account IDs   (ClubGG: 8-digit ID + username; others: username)
 *   → which club    (auto if the account has just one)
 *   → preferred deposit methods (choose several)
 *   → preferred cash-out method + where to send it (saved, never re-typed)
 *   → done
 *
 * Every prompt is a force_reply so Telegram Group Privacy can't eat the answer.
 * Multi-select state lives in session.ob; step is a plain string.
 *
 * (Two things the poker bot does that Loady's generic data model doesn't: the
 *  Sportsbook "make me an account" pause is APT-specific, so Sportsbook just
 *  asks for the username; and clubs are account-wide here, not per-platform, so
 *  the club question is asked once.)
 */

const FR = { reply_markup: { force_reply: true as const }, parse_mode: 'Markdown' as const };
const CG_MSG_ID = "What's your *ClubGG ID*?\n_The 8-digit player ID (e.g. 1234-5678) — NOT the 6-digit club code._";

const player = (ctx: Ctx, account: Account): Promise<Player> =>
  resolvePlayer(account.id, String(ctx.from!.id), ctx.from?.username ?? null, String(ctx.chat!.id));

// ── Entry ────────────────────────────────────────────────────────────────────

/** Kick off setup for a brand-new (or unfinished) player. */
export async function startOnboarding(ctx: Ctx, account: Account): Promise<void> {
  await player(ctx, account); // ensure a player row exists
  ctx.session = { step: 'ob_name', ob: {} };
  await ctx.reply(
    `👋 *Welcome to ${account.name}!* Let's get you set up.\n\n` +
      `First — what's your *name*? This is how our team will know you, so use the name you actually go by. ` +
      `*Reply* to this message with it.`,
    FR,
  );
}

// ── The driver — works out the next thing to ask from what's already stored ────

export async function advance(ctx: Ctx, account: Account): Promise<void> {
  const p = await player(ctx, account);
  const ob = (ctx.session.ob ??= {});

  const { name, platforms, links, clubs, depN, payoutN } = await withAccount(account.id, async (sql) => {
    const [pl] = await sql<{ display_name: string | null }[]>`select display_name from players where id = ${p.id}`;
    const platforms = await sql<{ id: string; code: string; name: string }[]>`select id, code, name from platforms where enabled order by sort_order, name`;
    const links = await sql<{ platform_id: string; platform_uid: string | null; club_id: string | null }[]>`select platform_id, platform_uid, club_id from player_platforms where player_id = ${p.id}`;
    const clubs = await sql<{ id: string; name: string }[]>`select id, name from clubs order by name`;
    const [dm] = await sql<{ n: number }[]>`select count(*)::int n from player_method_prefs where player_id = ${p.id}`;
    const [pm] = await sql<{ n: number }[]>`select count(*)::int n from player_payout_prefs where player_id = ${p.id}`;
    return { name: pl?.display_name ?? null, platforms, links, clubs, depN: dm?.n ?? 0, payoutN: pm?.n ?? 0 };
  });

  // 1 — Name.
  if (!name || !name.trim()) {
    ctx.session.step = 'ob_name';
    await ctx.reply(
      `👋 *Welcome to ${account.name}!* Let's get you set up.\n\nFirst — what's your *name*? *Reply* with it.`,
      FR,
    );
    return;
  }

  // 2 — Platform selection.
  if (!ob.platforms || ob.platforms.length === 0) {
    return askPlatforms(ctx, account);
  }

  // 3 — Account ID for each chosen platform that doesn't have one yet.
  const linkFor = (id: string) => links.find((l) => l.platform_id === id);
  for (const pid of ob.platforms) {
    const pf = platforms.find((x) => x.id === pid);
    if (!pf) continue;
    if (linkFor(pid)?.platform_uid) continue; // already collected
    if (pf.code === 'clubgg') {
      ctx.session = { ...ctx.session, step: 'ob_cg_id', platformId: pid };
      await ctx.reply(CG_MSG_ID, FR);
    } else {
      ctx.session = { ...ctx.session, step: 'ob_uid', platformId: pid };
      await ctx.reply(`Great — what is your *${pf.name} username*? *Reply* with it.`, FR);
    }
    return;
  }

  // 4 — Which club? (account-wide here). One → assign silently; several → ask once.
  const anyLink = links.find((l) => ob.platforms!.includes(l.platform_id));
  if (clubs.length > 0 && anyLink && !anyLink.club_id) {
    if (clubs.length === 1) {
      await withAccount(account.id, (sql) => sql`update player_platforms set club_id = ${clubs[0]!.id} where player_id = ${p.id} and club_id is null`);
    } else {
      ctx.session.step = 'ob_club';
      const kb = new InlineKeyboard();
      for (const c of clubs) kb.text(c.name, `obc:${c.id}`).row();
      await ctx.reply('Which *club* will you be using?', { parse_mode: 'Markdown', reply_markup: kb });
      return;
    }
  }

  // 5 — Preferred deposit methods.
  if (depN === 0) return askDepMethods(ctx, account);

  // 6 — Preferred cash-out method + handle.
  if (payoutN === 0 && (!ob.wdQueue || ob.wdQueue.length === 0) && !ob.wdAsked) {
    return askWdMethods(ctx, account);
  }

  // 7 — Done.
  return finish(ctx, account, p);
}

// ── Prompts ────────────────────────────────────────────────────────────────

async function platformKb(ctx: Ctx, account: Account): Promise<InlineKeyboard> {
  const platforms = await withAccount(account.id, (sql) => sql<{ id: string; name: string }[]>`select id, name from platforms where enabled order by sort_order, name`);
  const sel = ctx.session.ob?.platforms ?? [];
  const kb = new InlineKeyboard();
  for (const pf of platforms) kb.text(`${sel.includes(pf.id) ? '✅' : '⬜'} ${pf.name}`, `obp:${pf.id}`).row();
  if (sel.length) kb.text('➡️ Done', 'obpdone');
  return kb;
}

async function askPlatforms(ctx: Ctx, account: Account): Promise<void> {
  ctx.session.step = 'ob_platforms';
  ctx.session.ob ??= {};
  await ctx.reply('Which platform(s) will you be using? Tap all that apply, then Done.', {
    parse_mode: 'Markdown', reply_markup: await platformKb(ctx, account),
  });
}

async function methodKb(ctx: Ctx, account: Account, kind: 'dep' | 'wd'): Promise<{ text: string; kb: InlineKeyboard }> {
  const methods = await withAccount(account.id, (sql) => kind === 'wd'
    ? sql<{ id: string; name: string }[]>`select id, name from payment_methods where enabled and payout_enabled order by sort_order, name`
    : sql<{ id: string; name: string }[]>`select id, name from payment_methods where enabled order by sort_order, name`);
  const sel = (kind === 'dep' ? ctx.session.ob?.depSel : ctx.session.ob?.wdSel) ?? [];
  const kb = new InlineKeyboard();
  for (const m of methods) kb.text(`${sel.includes(m.id) ? '✅' : '⬜'} ${m.name}`, `${kind === 'dep' ? 'obd' : 'obw'}:${m.id}`).row();
  if (sel.length) kb.text('➡️ Done', kind === 'dep' ? 'obddone' : 'obwdone');
  return {
    text: kind === 'dep'
      ? 'Which methods do you want to use to deposit? Tap all that apply, then Done.'
      : 'Which methods do you want to use to withdraw? Tap all that apply, then Done.',
    kb,
  };
}

async function askDepMethods(ctx: Ctx, account: Account): Promise<void> {
  ctx.session.step = 'ob_dep';
  ctx.session.ob ??= {};
  ctx.session.ob.depSel = [];
  const { text, kb } = await methodKb(ctx, account, 'dep');
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
}

async function askWdMethods(ctx: Ctx, account: Account): Promise<void> {
  ctx.session.step = 'ob_wd';
  ctx.session.ob ??= {};
  ctx.session.ob.wdSel = [];
  const { text, kb } = await methodKb(ctx, account, 'wd');
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
}

/** How to word the "where do we send it?" prompt, per method. Mirrors the poker
 *  bot's withdrawHandlePrompt. */
function handlePrompt(code: string, name: string): string {
  switch (code) {
    case 'paypal': return `What's your *Paypal* address?\n(e.g. @bob123)`;
    case 'cashapp': return `What's your *Cashapp* address?\n(e.g. $bob123)`;
    case 'venmo': return `What's your *Venmo* address?\n(e.g. @bob123)`;
    case 'zelle': return `What's your *Zelle* address? (Email or Phone Number)\n(e.g. you@gmail.com or 555-123-4567)`;
    default: return `What's your *${name}* address?\n\n⚠️ Double-check it — crypto sent to the wrong address can't come back.`;
  }
}

/** After the cash-out multi-select, collect a destination for each chosen method,
 *  one at a time. */
async function askNextWdHandle(ctx: Ctx, account: Account): Promise<void> {
  const q = ctx.session.ob?.wdQueue ?? [];
  if (q.length === 0) return advance(ctx, account); // all handles collected
  const methodId = q[0]!;
  const [m] = await withAccount(account.id, (sql) => sql<{ code: string; name: string }[]>`select code, name from payment_methods where id = ${methodId}`);
  ctx.session = { ...ctx.session, step: 'ob_wd_handle', methodId };
  const left = q.length > 1 ? `\n\n_(${q.length} more after this)_` : '';
  await ctx.reply(handlePrompt(m!.code, m!.name) + left + '\n\n*Reply* with it.', FR);
}

async function finish(ctx: Ctx, account: Account, p: Player): Promise<void> {
  await withAccount(account.id, (sql) => sql`select player_mark_onboarded(${p.id})`);
  ctx.session = { step: 'idle' };
  await ctx.reply(
    `✅ *You're all set!*\n\n` +
      '💵 /deposit — add money\n' +
      '💸 /withdraw — cash-out\n' +
      '📄 /withdrawalhistory — cash-outs paid to you & receipts\n' +
      '📥 /deposithistory — deposits you made & receipts\n' +
      '📋 /pending — your pending cash-outs\n' +
      '➕ /editplatform — add or remove ClubGG / Sportsbook\n' +
      '🏆 /editclubs — change which club you play in\n' +
      '💳 /editdeposit — change how you deposit\n' +
      '🏦 /editwithdraw — change how you get paid\n' +
      '💬 /support — message our team\n' +
      '📖 /guide — what each command does',
    { parse_mode: 'Markdown' },
  );
}

// ── Text answers ─────────────────────────────────────────────────────────────

/** Handle a text reply while onboarding. Returns true if it consumed the message. */
export async function onboardingText(ctx: Ctx, account: Account, text: string): Promise<boolean> {
  const s = ctx.session;
  const p = () => player(ctx, account);

  if (s.step === 'ob_name') {
    const name = text.trim().slice(0, 60);
    const who = await p();
    await withAccount(account.id, (sql) => sql`update players set display_name = ${name} where id = ${who.id}`);
    await ctx.reply(`Nice to meet you, *${name}*! 👋`, { parse_mode: 'Markdown' });
    await advance(ctx, account);
    return true;
  }

  if (s.step === 'ob_cg_id') {
    const uid = validClubggId(text);
    if (!uid) { await ctx.reply(clubggIdError(text), { parse_mode: 'Markdown' }); return true; } // step stays
    ctx.session = { ...s, step: 'ob_cg_user', amount: undefined };
    (ctx.session.ob ??= {}).cgId = uid;
    await ctx.reply(`What's your *ClubGG username*? *Reply* with it.`, FR);
    return true;
  }

  if (s.step === 'ob_cg_user') {
    const who = await p();
    const uid = ctx.session.ob?.cgId ?? text.trim();
    await withAccount(account.id, (sql) => sql`select player_set_platform_full(${who.id}, ${s.platformId!}, ${uid}, ${text.trim()})`);
    if (ctx.session.ob) ctx.session.ob.cgId = undefined;
    await advance(ctx, account);
    return true;
  }

  if (s.step === 'ob_uid') {
    const who = await p();
    await withAccount(account.id, (sql) => sql`select player_set_platform(${who.id}, ${s.platformId!}, ${text.trim()})`);
    await advance(ctx, account);
    return true;
  }

  if (s.step === 'ob_wd_handle') {
    const who = await p();
    const methodId = s.methodId!;
    const [m] = await withAccount(account.id, (sql) => sql<{ code: string; name: string }[]>`select code, name from payment_methods where id = ${methodId}`);
    // Zelle is addressed by handle AND account-holder name — collect it next.
    if (m?.code === 'zelle') {
      ctx.session = { ...s, step: 'ob_wd_name', methodId, wdHandle: text.trim() } as typeof s;
      await withAccount(account.id, (sql) => sql`select player_remember_payout(${who.id}, ${methodId}, ${text.trim()}, null)`);
      await ctx.reply(`✅ Saved your *Zelle* — \`${text.trim()}\`.\n\nWhat is the first and last name on that Zelle account? *Reply* with it.`, FR);
      return true;
    }
    await withAccount(account.id, (sql) => sql`select player_remember_payout(${who.id}, ${methodId}, ${text.trim()}, null)`);
    await ctx.reply(`✅ Saved your *${m?.name}* — \`${text.trim()}\`.`, { parse_mode: 'Markdown' });
    if (ctx.session.ob) ctx.session.ob.wdQueue = (ctx.session.ob.wdQueue ?? []).filter((id) => id !== methodId);
    await askNextWdHandle(ctx, account);
    return true;
  }

  if (s.step === 'ob_wd_name') {
    const who = await p();
    const methodId = s.methodId!;
    await withAccount(account.id, (sql) => sql`select player_remember_payout(${who.id}, ${methodId}, ${s.wdHandle!}, ${text.trim()})`);
    await ctx.reply(`✅ Zelle name saved — *${text.trim()}*.`, { parse_mode: 'Markdown' });
    if (ctx.session.ob) ctx.session.ob.wdQueue = (ctx.session.ob.wdQueue ?? []).filter((id) => id !== methodId);
    await askNextWdHandle(ctx, account);
    return true;
  }

  return false;
}

// ── Callbacks ────────────────────────────────────────────────────────────────

/** Register every onboarding callback on the bot. `acct` resolves the account for
 *  a callback (the account middleware may not have run on a cold serverless hit).
 *  `ack` answers the callback query and never throws. */
export function registerOnboarding(
  bot: Bot<Ctx>,
  acct: (ctx: Ctx) => Promise<Account | null>,
  ack: (ctx: Ctx, opts?: Parameters<Ctx['answerCallbackQuery']>[0]) => Promise<unknown>,
): void {
  // Platform multi-select — toggle a tick in place.
  bot.callbackQuery(/^obp:(.+)$/, async (ctx) => {
    await ack(ctx);
    const account = await acct(ctx); if (!account) return;
    ctx.account = account;
    const ob = (ctx.session.ob ??= {});
    const sel = (ob.platforms ??= []);
    const id = ctx.match![1]!;
    const i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else sel.push(id);
    try { await ctx.editMessageReplyMarkup({ reply_markup: await platformKb(ctx, account) }); } catch { /* unchanged */ }
  });
  bot.callbackQuery('obpdone', async (ctx) => {
    const account = await acct(ctx); if (!account) return void ack(ctx);
    ctx.account = account;
    if (!ctx.session.ob?.platforms?.length) return void ack(ctx, { text: 'Pick at least one platform.' });
    await ack(ctx);
    try { await ctx.editMessageReplyMarkup(); } catch { /* gone */ }
    const names = await withAccount(account.id, (sql) => sql<{ name: string }[]>`select name from platforms where id = any(${sql.array(ctx.session.ob!.platforms!)}::uuid[]) order by sort_order`);
    await ctx.reply(`✅ Playing on: *${names.map((n) => n.name).join(', ')}*`, { parse_mode: 'Markdown' });
    await advance(ctx, account);
  });

  // Club (single, account-wide).
  bot.callbackQuery(/^obc:(.+)$/, async (ctx) => {
    await ack(ctx, { text: 'Saved ✓' });
    const account = await acct(ctx); if (!account) return;
    ctx.account = account;
    const who = await player(ctx, account);
    await withAccount(account.id, (sql) => sql`update player_platforms set club_id = ${ctx.match![1]!} where player_id = ${who.id}`);
    try { await ctx.editMessageReplyMarkup(); } catch { /* gone */ }
    const [c] = await withAccount(account.id, (sql) => sql<{ name: string }[]>`select name from clubs where id = ${ctx.match![1]!}`);
    await ctx.reply(`✅ Club: *${c?.name ?? '—'}*`, { parse_mode: 'Markdown' });
    await advance(ctx, account);
  });

  // Deposit-method multi-select.
  bot.callbackQuery(/^obd:(.+)$/, async (ctx) => {
    await ack(ctx);
    const account = await acct(ctx); if (!account) return;
    ctx.account = account;
    const ob = (ctx.session.ob ??= {});
    const sel = (ob.depSel ??= []);
    const id = ctx.match![1]!;
    const i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else sel.push(id);
    try { await ctx.editMessageReplyMarkup({ reply_markup: (await methodKb(ctx, account, 'dep')).kb }); } catch { /* unchanged */ }
  });
  bot.callbackQuery('obddone', async (ctx) => {
    const account = await acct(ctx); if (!account) return void ack(ctx);
    ctx.account = account;
    const sel = ctx.session.ob?.depSel ?? [];
    if (!sel.length) return void ack(ctx, { text: 'Pick at least one.' });
    await ack(ctx);
    const who = await player(ctx, account);
    await withAccount(account.id, (sql) => sql`select player_set_method_prefs(${who.id}, ${sql.array(sel)}::uuid[])`);
    try { await ctx.editMessageReplyMarkup(); } catch { /* gone */ }
    await ctx.reply('✅ Saved how you like to deposit.');
    await advance(ctx, account);
  });

  // Cash-out-method multi-select → then a handle for each.
  bot.callbackQuery(/^obw:(.+)$/, async (ctx) => {
    await ack(ctx);
    const account = await acct(ctx); if (!account) return;
    ctx.account = account;
    const ob = (ctx.session.ob ??= {});
    const sel = (ob.wdSel ??= []);
    const id = ctx.match![1]!;
    const i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else sel.push(id);
    try { await ctx.editMessageReplyMarkup({ reply_markup: (await methodKb(ctx, account, 'wd')).kb }); } catch { /* unchanged */ }
  });
  bot.callbackQuery('obwdone', async (ctx) => {
    const account = await acct(ctx); if (!account) return void ack(ctx);
    ctx.account = account;
    const sel = ctx.session.ob?.wdSel ?? [];
    if (!sel.length) return void ack(ctx, { text: 'Pick at least one.' });
    await ack(ctx);
    try { await ctx.editMessageReplyMarkup(); } catch { /* gone */ }
    (ctx.session.ob ??= {}).wdQueue = [...sel];
    ctx.session.ob.wdAsked = true;
    await askNextWdHandle(ctx, account);
  });
}

// ── ClubGG ID validation (same rules as the poker bot) ───────────────────────

/** A ClubGG player ID is 8 digits (players keep sending the 6-digit CLUB code).
 *  Returns the normalized `1234-5678` form, or null. */
export function validClubggId(text: string): string | null {
  const d = text.replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4)}` : null;
}
export function clubggIdError(text: string): string {
  const d = text.replace(/\D/g, '');
  return d.length === 6
    ? `That's the *club code* (6 digits). We need your *ClubGG player ID* — the *8-digit* number on your ClubGG profile, e.g. \`1234-5678\`. Send that one.`
    : `A ClubGG ID is *8 digits* (e.g. \`1234-5678\`). Please check and send it again.`;
}
