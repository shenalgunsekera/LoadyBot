import { withAccount } from '@loady/core';

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
export const whole = (cents: number) => `$${Math.round(cents / 100)}`;

export function parseAmount(text: string): number | null {
  const m = text.replace(/[$,\s]/g, '').match(/^\d+(\.\d{1,2})?$/);
  return m ? Math.round(parseFloat(m[0]) * 100) : null;
}

export interface Player { id: string; display_name: string | null }
export interface Platform { id: string; name: string }
export interface Method { id: string; name: string; club_handle: string | null }
export interface Bounds { min: number; max: number; step: number }

/** Amount rules: account floor raised by the method min, capped by its max, in
 *  whole multiples of the step (same as the telegram bot / poker). */
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

export function amountProblem(amount: number, b: Bounds): string | null {
  if (amount < b.min) return `The minimum is ${whole(b.min)}. Send a bigger amount.`;
  if (amount > b.max) return `The most you can do at once is ${whole(b.max)}. Send a smaller amount.`;
  if (b.step > 0 && amount % b.step !== 0) return `Please use whole multiples of ${whole(b.step)} — no cents.`;
  return null;
}

export function receiptInstruction(code: string): string {
  switch (code) {
    case 'venmo': return 'a screenshot showing the amount and the transaction ID';
    case 'paypal': return 'a screenshot showing your receipt and the transaction ID';
    default: return 'a screenshot of the payment confirmation';
  }
}

/** A saved cash-out destination for this player + method (last used, else the one
 *  saved at setup), or null. */
export function savedPayoutHandle(accountId: string, playerId: string, methodId: string): Promise<string | null> {
  return withAccount(accountId, async (sql) => {
    const [w] = await sql<{ payout_handle: string }[]>`select payout_handle from withdraw_requests where player_id = ${playerId} and method_id = ${methodId} and payout_handle is not null order by created_at desc limit 1`;
    if (w?.payout_handle) return w.payout_handle;
    const [pref] = await sql<{ handle: string }[]>`select handle from player_payout_prefs where player_id = ${playerId} and method_id = ${methodId} limit 1`;
    return pref?.handle ?? null;
  });
}

export function resolvePlayer(accountId: string, dcUserId: string, username: string | null, channelId: string): Promise<Player> {
  return withAccount(accountId, async (sql) => {
    const [p] = await sql<Player[]>`select * from player_touch_dc(${dcUserId}, ${username}, ${channelId})`;
    return p!;
  });
}

export function platformsFor(accountId: string): Promise<Platform[]> {
  return withAccount(accountId, (sql) => sql<Platform[]>`select id, name from platforms where enabled order by sort_order, name`);
}

export function methodsFor(accountId: string, payout = false): Promise<Method[]> {
  return withAccount(accountId, (sql) =>
    payout
      ? sql<Method[]>`select id, name, club_handle from payment_methods where enabled and payout_enabled order by sort_order, name`
      : sql<Method[]>`select id, name, club_handle from payment_methods where enabled order by sort_order, name`);
}
