-- ═══════════════════════════════════════════════════════════════════════════
-- 0020 — Reverse a released (already-sent) cash-out payment
-- ═══════════════════════════════════════════════════════════════════════════
-- For when a payment was verified and turns out fake. Unlike /adjust + (grows the
-- total) this changes the amount already SENT: it goes back onto what the player
-- is owed, the total is untouched. Club absorbs it (restore the payee's escrow,
-- book the loss to house_loss); the depositor keeps their credit. Re-opening is
-- automatic — the cash-out queue is just "amount_remaining > 0". RLS-scoped:
-- called via withAccount, so it only ever touches the caller's own account.

create or replace function fill_reverse(
  p_fill_id uuid,
  p_actor   uuid default null,
  p_reason  text default null
) returns fills
language plpgsql as $$
declare
  f fills;
  w withdraw_requests;
begin
  select * into f from fills where id = p_fill_id for update;
  if not found then raise exception 'that payment no longer exists'; end if;
  if f.status <> 'released' then
    raise exception 'only a completed payment can be reversed — this one is %', f.status
      using errcode = 'invalid_parameter_value';
  end if;
  if f.withdraw_id is null then
    raise exception 'that payment is not part of a cash-out' using errcode = 'invalid_parameter_value';
  end if;

  select * into w from withdraw_requests where id = f.withdraw_id for update;

  -- Restore the payee's escrow (owed again); the house books the loss. The
  -- depositor keeps their credit — chargebacks land on the club, by design.
  perform ledger_post('fill.reverse', 'fill', f.id, p_actor,
    coalesce(p_reason, format('reversed payment of %s', f.amount)),
    jsonb_build_array(
      jsonb_build_object('account_id',
        account_of('player_escrow', w.player_id, w.platform_id, f.currency), 'amount', f.amount),
      jsonb_build_object('account_id',
        account_of('house_loss', null, null, f.currency), 'amount', -f.amount)
    ));

  -- Put the slice back on what the payee is owed → it re-enters the queue.
  update withdraw_requests
     set amount_remaining = amount_remaining + f.amount,
         status = case when amount_remaining + f.amount >= amount then 'queued' else 'partially_filled' end
   where id = w.id;

  update fills set status = 'reversed' where id = f.id returning * into f;
  return f;
end $$;

grant execute on function fill_reverse(uuid, uuid, text) to loady_app;
