-- ═══════════════════════════════════════════════════════════════════════════
-- 0017 — Top up / pause / resume a cash-out
-- ═══════════════════════════════════════════════════════════════════════════

-- Add more to a queued cash-out (escrows the extra).
create or replace function withdraw_topup(p_withdraw uuid, p_amount bigint)
returns withdraw_requests language plpgsql as $$
declare w withdraw_requests;
begin
  select * into w from withdraw_requests where id = p_withdraw for update;
  if not found then raise exception 'that cash-out no longer exists'; end if;
  if w.status not in ('queued', 'partially_filled', 'paused') then
    raise exception 'that cash-out is % — you can''t add to it', w.status using errcode = 'invalid_parameter_value';
  end if;
  if p_amount <= 0 then raise exception 'amount must be positive' using errcode = 'invalid_parameter_value'; end if;

  perform ledger_post('withdraw.topup', 'withdraw_request', w.id, null, format('added %s to cash-out', p_amount),
    jsonb_build_array(
      jsonb_build_object('account_id', account_of('house_settlement', null, w.platform_id, w.currency), 'amount', -p_amount),
      jsonb_build_object('account_id', account_of('player_escrow', w.player_id, w.platform_id, w.currency), 'amount', p_amount)
    ));
  update withdraw_requests set amount = amount + p_amount, amount_remaining = amount_remaining + p_amount
   where id = w.id returning * into w;
  return w;
end $$;

-- Pause / resume — a paused cash-out leaves the queue (v_withdraw_queue filters on
-- queued/partially_filled) so nobody pays it, then resumes at its place.
create or replace function withdraw_pause(p_withdraw uuid) returns void language plpgsql as $$
begin update withdraw_requests set status = 'paused' where id = p_withdraw and status in ('queued', 'partially_filled'); end $$;

create or replace function withdraw_resume(p_withdraw uuid) returns void language plpgsql as $$
begin update withdraw_requests set status = case when amount_remaining < amount then 'partially_filled' else 'queued' end
        where id = p_withdraw and status = 'paused'; end $$;

grant execute on function withdraw_topup(uuid, bigint) to loady_app;
grant execute on function withdraw_pause(uuid) to loady_app;
grant execute on function withdraw_resume(uuid) to loady_app;
