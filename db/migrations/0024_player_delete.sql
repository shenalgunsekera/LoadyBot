-- ═══════════════════════════════════════════════════════════════════════════
-- 0024 — Hard-delete a player (admin "Delete player" on the Players page)
-- ═══════════════════════════════════════════════════════════════════════════
-- Erases the player and everything hanging off them: platform links, method /
-- payout prefs (both cascade), receipts, fills, deposit + cash-out requests, and
-- any empty ledger accounts they never used.
--
-- The ledger is append-only (ledger_entries / ledger_transactions have immutable
-- triggers), so a player who actually moved money CANNOT be fully erased — their
-- ledger_accounts still carry entries, and the final players delete then trips
-- the ledger_accounts.player_id foreign key and the whole thing rolls back. That
-- is deliberate: the books stay intact. The caller surfaces that as "put them on
-- hold instead". Players who never transacted (the usual case for removing a
-- mistaken or test entry) delete cleanly.
--
-- Runs as the caller (loady_app) under withAccount, so every delete is RLS-scoped
-- to the current account — it can never reach across tenants.

create or replace function player_delete(p_player uuid)
returns void language plpgsql as $$
begin
  -- Receipts owned by the player, or attached to their fills.
  delete from receipts r
   where r.player_id = p_player
      or (r.ref_type = 'fill' and r.ref_id in (
            select f.id from fills f
              left join deposit_requests d on d.id = f.deposit_id
              left join withdraw_requests w on w.id = f.withdraw_id
             where d.player_id = p_player or w.player_id = p_player));

  -- Fills on the player's deposits or cash-outs.
  delete from fills f using deposit_requests d
   where f.deposit_id = d.id and d.player_id = p_player;
  delete from fills f using withdraw_requests w
   where f.withdraw_id = w.id and w.player_id = p_player;

  delete from deposit_requests  where player_id = p_player;
  delete from withdraw_requests where player_id = p_player;

  -- Ledger accounts the player opened but never used (no entries → safe to drop).
  delete from ledger_accounts la
   where la.player_id = p_player
     and not exists (select 1 from ledger_entries e where e.la_id = la.id);

  -- Cascades player_platforms, player_method_prefs, player_payout_prefs. Raises a
  -- foreign-key error (and rolls back) if any used ledger account remains.
  delete from players where id = p_player;
end $$;

grant execute on function player_delete(uuid) to loady_app;
