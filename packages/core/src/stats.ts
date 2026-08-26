import { withAccount } from './tenant';

export interface PlatformTotals {
  id: string;
  name: string;
  deposited: number; // cents — deposits that actually settled
  withdrawn: number; // cents — cash-out amount actually paid out (incl. partial fills)
}

/**
 * Per-platform money in and out for a club:
 *   deposited = settled deposits, withdrawn = the paid portion of cash-outs
 *   (amount − amount_remaining, so partial fills count). RLS-scoped to the account.
 */
export async function platformTotals(accountId: string): Promise<PlatformTotals[]> {
  return withAccount(accountId, (sql) => sql<PlatformTotals[]>`
    select p.id, p.name,
           coalesce((select sum(d.amount) from deposit_requests d
                      where d.platform_id = p.id and d.status = 'settled'), 0)::bigint as deposited,
           coalesce((select sum(w.amount - w.amount_remaining) from withdraw_requests w
                      where w.platform_id = p.id and w.status <> 'cancelled'), 0)::bigint as withdrawn
      from platforms p
     order by p.sort_order, p.name`);
}

export interface ClubTotals {
  platformId: string;
  clubId: string;
  name: string;
  deposited: number;
  withdrawn: number;
}

/**
 * The same money split by CLUB. Loady doesn't snapshot a club on each request, so
 * a deposit / cash-out is attributed to the player's current club for that platform
 * (player_platforms.club_id). Players with no club set are left out, so a club's
 * rows may sum to a touch under its platform total. RLS-scoped to the account.
 */
export async function clubTotals(accountId: string): Promise<ClubTotals[]> {
  return withAccount(accountId, (sql) => sql<ClubTotals[]>`
    with dep as (
      select platform_id, club_id, sum(amount)::bigint as amt from (
        select d.platform_id, d.amount,
               (select pp.club_id from player_platforms pp
                 where pp.player_id = d.player_id and pp.platform_id = d.platform_id limit 1) as club_id
          from deposit_requests d where d.status = 'settled'
      ) x where club_id is not null group by platform_id, club_id
    ), wd as (
      select platform_id, club_id, sum(amt)::bigint as amt from (
        select w.platform_id, (w.amount - w.amount_remaining) as amt,
               (select pp.club_id from player_platforms pp
                 where pp.player_id = w.player_id and pp.platform_id = w.platform_id limit 1) as club_id
          from withdraw_requests w where w.status <> 'cancelled'
      ) x where club_id is not null group by platform_id, club_id
    )
    select coalesce(dep.platform_id, wd.platform_id) as "platformId",
           coalesce(dep.club_id, wd.club_id) as "clubId", c.name,
           coalesce(dep.amt, 0)::bigint as deposited,
           coalesce(wd.amt, 0)::bigint as withdrawn
      from dep full join wd on dep.platform_id = wd.platform_id and dep.club_id = wd.club_id
      join clubs c on c.id = coalesce(dep.club_id, wd.club_id)
     order by c.name`);
}
