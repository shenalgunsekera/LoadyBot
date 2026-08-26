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
 * The same money split by CLUB, from the club snapshotted on each request at
 * creation (migration 0018) — so it's historically exact. Rows with no club are
 * left out, so a club's rows can sum a touch under its platform total. RLS-scoped.
 */
export async function clubTotals(accountId: string): Promise<ClubTotals[]> {
  return withAccount(accountId, (sql) => sql<ClubTotals[]>`
    with dep as (
      select platform_id, club_id, sum(amount)::bigint as amt
        from deposit_requests where status = 'settled' and club_id is not null
       group by platform_id, club_id
    ), wd as (
      select platform_id, club_id, sum(amount - amount_remaining)::bigint as amt
        from withdraw_requests where status <> 'cancelled' and club_id is not null
       group by platform_id, club_id
    )
    select coalesce(dep.platform_id, wd.platform_id) as "platformId",
           coalesce(dep.club_id, wd.club_id) as "clubId", c.name,
           coalesce(dep.amt, 0)::bigint as deposited,
           coalesce(wd.amt, 0)::bigint as withdrawn
      from dep full join wd on dep.platform_id = wd.platform_id and dep.club_id = wd.club_id
      join clubs c on c.id = coalesce(dep.club_id, wd.club_id)
     order by c.name`);
}
