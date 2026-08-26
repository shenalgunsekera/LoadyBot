import { db } from './db';
import type { Account, BotPlatform } from './types';

/**
 * Resolve which account a message belongs to from the chat it arrived in. This
 * is the door: chat_bindings has a UNIQUE (platform, chat_id), so a group/server
 * maps to exactly one account and can never be claimed by two. Returns null when
 * the chat isn't connected yet.
 */
export async function accountForChat(platform: BotPlatform, chatId: string): Promise<Account | null> {
  const [row] = await db()<Account[]>`
    select a.* from chat_bindings b
      join accounts a on a.id = b.account_id
     where b.platform = ${platform} and b.chat_id = ${chatId}
     limit 1`;
  return row ?? null;
}

/**
 * For a private DM (no group to identify the account), resolve via the accounts
 * a player/member belongs to. One account → use it. Several → the caller should
 * ask which. Zero → not linked yet.
 */
export async function accountsForUser(platform: BotPlatform, userId: string): Promise<Account[]> {
  const sql = db();
  return platform === 'telegram'
    ? sql<Account[]>`select distinct a.* from accounts a join players p on p.account_id = a.id
                      where p.telegram_user_id = ${userId} order by a.name`
    : sql<Account[]>`select distinct a.* from accounts a join players p on p.account_id = a.id
                      where p.discord_user_id = ${userId} order by a.name`;
}

/** Resolve a club from its stable player deep-link token (t.me/Bot?start=<token>). */
export async function accountByJoinToken(token: string): Promise<Account | null> {
  const [row] = await db()<Account[]>`select * from accounts where join_token = ${token} limit 1`;
  return row ?? null;
}

/**
 * Is this Telegram/Discord user an ADMIN of this specific club? Authority is
 * always per-account — resolve the club from the chat first, then check here.
 * Never a global admin.
 */
export async function isAccountAdmin(accountId: string, platform: BotPlatform, userId: string): Promise<boolean> {
  const [m] = platform === 'telegram'
    ? await db()`select 1 from account_members where account_id = ${accountId} and telegram_user_id = ${userId} limit 1`
    : await db()`select 1 from account_members where account_id = ${accountId} and discord_user_id = ${userId} limit 1`;
  return !!m;
}

/** Redeem a one-time link code: stamp the member's Telegram/Discord user id so
 *  the bots recognise them as an admin of that club. */
export async function redeemLinkCode(
  code: string, platform: BotPlatform, userId: string,
): Promise<{ ok: true; accountName: string } | { ok: false; error: string }> {
  return db().begin(async (tx) => {
    const [c] = await tx<{ account_id: string; member_id: string; platform: BotPlatform; expires_at: Date; used_at: Date | null }[]>`
      select account_id, member_id, platform, expires_at, used_at from member_link_codes where code = ${code} for update`;
    if (!c) return { ok: false as const, error: 'That code is not valid.' };
    if (c.used_at) return { ok: false as const, error: 'That code was already used.' };
    if (c.platform !== platform) return { ok: false as const, error: 'That code is for the other platform.' };
    if (c.expires_at < new Date()) return { ok: false as const, error: 'That code has expired.' };
    if (platform === 'telegram') await tx`update account_members set telegram_user_id = ${userId} where id = ${c.member_id}`;
    else await tx`update account_members set discord_user_id = ${userId} where id = ${c.member_id}`;
    await tx`update member_link_codes set used_at = now() where code = ${code}`;
    const [a] = await tx<{ name: string }[]>`select name from accounts where id = ${c.account_id}`;
    return { ok: true as const, accountName: a!.name };
  });
}

/** Redeem a one-time connect code and bind the chat to its account. */
export async function redeemConnectCode(
  code: string,
  platform: BotPlatform,
  chatId: string,
  title: string | null,
): Promise<{ ok: true; accountId: string } | { ok: false; error: string }> {
  return db().begin(async (tx) => {
    const [c] = await tx<{ account_id: string; platform: BotPlatform; expires_at: Date; used_at: Date | null }[]>`
      select account_id, platform, expires_at, used_at from connect_codes where code = ${code} for update`;
    if (!c) return { ok: false as const, error: 'That code is not valid.' };
    if (c.used_at) return { ok: false as const, error: 'That code was already used.' };
    if (c.platform !== platform) return { ok: false as const, error: 'That code is for the other platform.' };
    if (c.expires_at < new Date()) return { ok: false as const, error: 'That code has expired.' };

    await tx`insert into chat_bindings (account_id, platform, chat_id, title)
             values (${c.account_id}, ${platform}, ${chatId}, ${title})
             on conflict (platform, chat_id) do update set account_id = excluded.account_id, title = excluded.title`;
    await tx`update connect_codes set used_at = now(), used_chat_id = ${chatId} where code = ${code}`;
    return { ok: true as const, accountId: c.account_id };
  });
}

/**
 * The account a bot user is an admin/owner of. One admin = one club, so at most
 * one row; owner wins if somehow both. This is what lets an admin add the bot to
 * a new chat and have it bind automatically — no connect code.
 */
export async function accountForAdminUser(platform: BotPlatform, userId: string): Promise<Account | null> {
  const sql = db();
  const [a] = platform === 'telegram'
    ? await sql<Account[]>`select a.* from account_members m join accounts a on a.id = m.account_id
                            where m.telegram_user_id = ${userId} order by (m.role = 'owner') desc limit 1`
    : await sql<Account[]>`select a.* from account_members m join accounts a on a.id = m.account_id
                            where m.discord_user_id = ${userId} order by (m.role = 'owner') desc limit 1`;
  return a ?? null;
}

/**
 * Bind a chat to an account if it isn't already bound. Returns 'new' when it was
 * just bound, 'exists' when this chat already belongs to this account, and 'taken'
 * when it belongs to a DIFFERENT account (we never steal a chat).
 */
export async function autoBindChat(
  accountId: string, platform: BotPlatform, chatId: string, title: string | null,
): Promise<'new' | 'exists' | 'taken'> {
  const [existing] = await db()<{ account_id: string }[]>`
    select account_id from chat_bindings where platform = ${platform} and chat_id = ${chatId} limit 1`;
  if (existing) return existing.account_id === accountId ? 'exists' : 'taken';
  await db()`insert into chat_bindings (account_id, platform, chat_id, title)
             values (${accountId}, ${platform}, ${chatId}, ${title})
             on conflict (platform, chat_id) do nothing`;
  return 'new';
}

/** Mark a chat (already bound to this account) as the club's admin/payments group. */
export async function markAdminChat(accountId: string, platform: BotPlatform, chatId: string): Promise<boolean> {
  const [row] = await db()<{ id: string }[]>`
    update chat_bindings set kind = 'admin'
     where platform = ${platform} and chat_id = ${chatId} and account_id = ${accountId} returning id`;
  return !!row;
}
