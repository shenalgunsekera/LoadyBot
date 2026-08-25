-- ═══════════════════════════════════════════════════════════════════════════
-- 0012 — Money engine: cancel a deposit / cancel a cash-out
-- ═══════════════════════════════════════════════════════════════════════════

-- Cancel the player's latest UNPAID deposit (no screenshot yet). If it had
-- matched a queued cash-out, un-reserve that cash-out (restore its remaining and
-- put it back in the queue). Returns null if there's nothing to cancel.
create or replace function deposit_cancel(p_player uuid)
returns deposit_requests language plpgsql as $$
declare d deposit_requests; f fills;
begin
  select * into d from deposit_requests
   where player_id = p_player and status = 'awaiting_payment'
   order by created_at desc limit 1 for update;
  if not found then return null; end if;

  for f in select * from fills where deposit_id = d.id and status = 'locked' loop
    if f.withdraw_id is not null then
      update withdraw_requests
         set amount_remaining = amount_remaining + f.amount,
             status = case when amount_remaining + f.amount >= amount then 'queued' else 'partially_filled' end
       where id = f.withdraw_id;
    end if;
    update fills set status = 'cancelled' where id = f.id;
  end loop;

  update deposit_requests set status = 'cancelled' where id = d.id returning * into d;
  return d;
end $$;

-- Cancel a queued cash-out and return the escrow to the platform. Refuses once a
-- depositor has reserved part of it (that slice is being paid).
create or replace function withdraw_cancel(p_withdraw uuid)
returns withdraw_requests language plpgsql as $$
declare w withdraw_requests;
begin
  select * into w from withdraw_requests where id = p_withdraw for update;
  if not found then raise exception 'that cash-out no longer exists'; end if;
  if w.status not in ('queued', 'partially_filled') then
    raise exception 'that cash-out is % — it can''t be cancelled', w.status using errcode = 'invalid_parameter_value';
  end if;
  if w.amount_remaining <> w.amount then
    raise exception 'part of this cash-out is already being paid — it can''t be cancelled now' using errcode = 'invalid_parameter_value';
  end if;

  perform ledger_post('withdraw.cancel', 'withdraw_request', w.id, null, 'cash-out cancelled',
    jsonb_build_array(
      jsonb_build_object('account_id', account_of('player_escrow', w.player_id, w.platform_id, w.currency), 'amount', -w.amount_remaining),
      jsonb_build_object('account_id', account_of('house_settlement', null, w.platform_id, w.currency), 'amount', w.amount_remaining)
    ));
  update withdraw_requests set status = 'cancelled', amount_remaining = 0 where id = w.id returning * into w;
  return w;
end $$;

grant execute on function deposit_cancel(uuid) to loady_app;
grant execute on function withdraw_cancel(uuid) to loady_app;
