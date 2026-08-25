import { InlineKeyboard } from 'grammy';
import { db, withAccount } from '@loady/core';

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Parse "$20", "20", "20.00" → cents, or null. */
export function parseAmount(text: string): number | null {
  const m = text.replace(/[$,\s]/g, '').match(/^\d+(\.\d{1,2})?$/);
  if (!m) return null;
  return Math.round(parseFloat(m[0]) * 100);
}

export interface Player { id: string; display_name: string | null }
export interface Platform { id: string; name: string }
export interface Method { id: string; name: string; club_handle: string | null; payout_enabled: boolean }

/** Find-or-create the player for this Telegram user in the given account. */
export function resolvePlayer(accountId: string, tgUserId: string, username: string | null, chatId: string): Promise<Player> {
  return withAccount(accountId, async (sql) => {
    const [p] = await sql<Player[]>`select * from player_touch_tg(${tgUserId}, ${username}, ${chatId})`;
    return p!;
  });
}

export function platformsFor(accountId: string): Promise<Platform[]> {
  return withAccount(accountId, (sql) => sql<Platform[]>`select id, name from platforms where enabled order by sort_order, name`);
}

export function methodsFor(accountId: string, payout = false): Promise<Method[]> {
  return withAccount(accountId, (sql) =>
    payout
      ? sql<Method[]>`select id, name, club_handle, payout_enabled from payment_methods where enabled and payout_enabled order by sort_order, name`
      : sql<Method[]>`select id, name, club_handle, payout_enabled from payment_methods where enabled order by sort_order, name`);
}

/** The chat where admin cards go: the account's 'admin' binding, else any binding. */
export async function adminChatFor(accountId: string): Promise<string | null> {
  const [row] = await db()<{ chat_id: string }[]>`
    select chat_id from chat_bindings
     where account_id = ${accountId} and platform = 'telegram'
     order by (kind = 'admin') desc, created_at limit 1`;
  return row?.chat_id ?? null;
}

export const kbFrom = (rows: { text: string; data: string }[][]) => {
  const kb = new InlineKeyboard();
  for (const row of rows) { for (const b of row) kb.text(b.text, b.data); kb.row(); }
  return kb;
};
