-- ═══════════════════════════════════════════════════════════════════════════
-- 0025 — Partial cancel: take some of a queued cash-out back onto the table
-- ═══════════════════════════════════════════════════════════════════════════
-- The poker bot's /cancelwithdraw offers "cancel it all" OR "cancel part of it".
-- withdraw_cancel (0012) already does the full case; this adds the partial one:
-- lower the request by p_amount, returning that escrow, while keeping the player's
-- place in the queue. Only the part that isn't already being paid can be pulled
-- back, and it can't drop below the account minimum (cancel it all for that).

create or replace function withdraw_reduce(p_withdraw uuid, p_amount bigint)
returns withdraw_requests language plpgsql as $$
declare w withdraw_requests; v_min bigint;
begin
  select * into w from withdraw_requests where id = p_withdraw for update;
  if not found then raise exception 'that cash-out no longer exists'; end if;
  if w.status not in ('queued', 'partially_filled') then
    raise exception 'that cash-out is % — it can''t be changed', w.status using errcode = 'invalid_parameter_value';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'send an amount to take back' using errcode = 'invalid_parameter_value';
  end if;
  -- Only what isn't already being paid (amount_remaining) can be pulled back.
  if p_amount > w.amount_remaining then
    raise exception 'only % is still available to take back'
      , to_char(w.amount_remaining / 100.0, 'FM999999990D00') using errcode = 'invalid_parameter_value';
  end if;
  if p_amount >= w.amount then
    raise exception 'to take it all back, cancel the whole cash-out instead' using errcode = 'invalid_parameter_value';
  end if;
  select min_amount into v_min from account_config where account_id = app.current_account();
  if (w.amount - p_amount) < v_min then
    raise exception 'that would leave less than the % minimum — cancel it all instead'
      , to_char(v_min / 100.0, 'FM999999990D00') using errcode = 'invalid_parameter_value';
  end if;

  perform ledger_post('withdraw.reduce', 'withdraw_request', w.id, null, 'cash-out reduced by player',
    jsonb_build_array(
      jsonb_build_object('account_id', account_of('player_escrow', w.player_id, w.platform_id, w.currency), 'amount', -p_amount),
      jsonb_build_object('account_id', account_of('house_settlement', null, w.platform_id, w.currency), 'amount', p_amount)
    ));
  -- Reduce both equally, so the paid/assigned portion (amount - remaining) and the
  -- queue status are unchanged — the player keeps their place in line.
  update withdraw_requests
     set amount = amount - p_amount,
         amount_remaining = amount_remaining - p_amount
   where id = w.id returning * into w;
  return w;
end $$;

grant execute on function withdraw_reduce(uuid, bigint) to loady_app;
