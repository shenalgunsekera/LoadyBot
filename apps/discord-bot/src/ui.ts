import { withAccount } from '@loady/core';

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function parseAmount(text: string): number | null {
  const m = text.replace(/[$,\s]/g, '').match(/^\d+(\.\d{1,2})?$/);
  return m ? Math.round(parseFloat(m[0]) * 100) : null;
}

export interface Player { id: string; display_name: string | null }
export interface Platform { id: string; name: string }
export interface Method { id: string; name: string; club_handle: string | null }

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
