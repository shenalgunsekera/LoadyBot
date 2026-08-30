import { InlineKeyboard } from 'grammy';
import { db, withAccount } from '@loady/core';

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
/** Whole-dollar money for prompts (no cents), like the poker bot's `whole`. */
export const whole = (cents: number) => `$${Math.round(cents / 100)}`;

/** Parse "$20", "20", "20.00" → cents, or null. */
export function parseAmount(text: string): number | null {
  const m = text.replace(/[$,\s]/g, '').match(/^\d+(\.\d{1,2})?$/);
  if (!m) return null;
  return Math.round(parseFloat(m[0]) * 100);
}

export interface Bounds { min: number; max: number; step: number }

/** The min/max/step for an amount — the account floor, raised by the method's own
 *  minimum, capped by its max. Matches the poker bot's amount rules. `payout` uses
 *  the widest range across enabled cash-out methods (method picked after amount). */
export function amountBounds(accountId: string, methodId?: string, payout = false): Promise<Bounds> {
  return withAccount(accountId, async (sql) => {
    if (methodId) {
      const [r] = await sql<Bounds[]>`
        select greatest(coalesce(m.min_amount, c.min_amount), c.min_amount) as min,
               coalesce(m.max_amount, c.max_amount) as max, c.amount_step as step
          from account_config c cross join payment_methods m where m.id = ${methodId}`;
      return r!;
    }
    const [r] = await sql<Bounds[]>`
      select c.amount_step as step,
             greatest(coalesce((select min(coalesce(m.min_amount, c.min_amount)) from payment_methods m where m.enabled ${payout ? sql`and m.payout_enabled` : sql``}), c.min_amount), c.min_amount) as min,
             coalesce((select max(coalesce(m.max_amount, c.max_amount)) from payment_methods m where m.enabled ${payout ? sql`and m.payout_enabled` : sql``}), c.max_amount) as max
        from account_config c`;
    return r!;
  });
}

/** Human reason an amount is out of bounds, or null if it's fine. */
export function amountProblem(amount: number, b: Bounds): string | null {
  if (amount < b.min) return `The minimum is ${whole(b.min)}. Send a bigger amount.`;
  if (amount > b.max) return `The most you can do at once is ${whole(b.max)}. Send a smaller amount.`;
  if (b.step > 0 && amount % b.step !== 0) return `Please use whole multiples of ${whole(b.step)} — no cents.`;
  return null;
}

/** How to word the deposit receipt ask, per method (mirrors the poker bot). */
export function receiptInstruction(code: string): string {
  switch (code) {
    case 'venmo': return 'a screenshot showing the *amount* and the *transaction ID*';
    case 'paypal': return 'a screenshot showing your receipt and the *transaction ID*';
    case 'cashapp': return 'a screenshot of the payment confirmation';
    case 'zelle': return 'a screenshot of the Zelle confirmation';
    default: return 'a screenshot of the payment confirmation';
  }
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

/** The platforms THIS player actually has an account on (linked a username/ID to).
 *  Deposit / withdraw offer only these — never a platform they never set up. */
export function playerPlatformsFor(accountId: string, playerId: string): Promise<Platform[]> {
  return withAccount(accountId, (sql) => sql<Platform[]>`
    select pf.id, pf.name from platforms pf
      join player_platforms pp on pp.platform_id = pf.id
     where pp.player_id = ${playerId} and pf.enabled and pp.platform_uid is not null
     order by pf.sort_order, pf.name`);
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
