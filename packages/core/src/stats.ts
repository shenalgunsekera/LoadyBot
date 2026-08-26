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
