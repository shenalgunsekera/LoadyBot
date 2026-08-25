-- ═══════════════════════════════════════════════════════════════════════════
-- 0008 — Money engine, layer 2: withdraw → escrow → queue → pay from float
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A cash-out escrows the player's value off the platform into their escrow, then
-- joins the FIFO queue. It's cleared either by a depositor (p2p match, layer 3)
-- or by an admin paying from the owner's float (withdraw_club_payout here). Ledger
-- postings mirror the production engine. The loader/unload confirmation (proving
-- the chips actually came off the table before escrow) is a later layer.

-- ── Create a cash-out: validate, escrow, queue ───────────────────────────────
create or replace function withdraw_create(p_player uuid, p_platform uuid, p_method uuid, p_amount bigint, p_handle text)
returns withdraw_requests language plpgsql as $$
declare
  cfg account_config; pl players; m payment_methods; pf platforms;
  w withdraw_requests; v_min bigint; v_max bigint; v_open int;
begin
  select * into cfg from account_config where account_id = app.current_account();

  select * into pl from players where id = p_player for update;
  if not found then raise exception 'player not found'; end if;
  if pl.status <> 'active' then
    raise exception 'account is % — cash-outs are not available', pl.status using errcode = 'insufficient_privilege';
  end if;

  select * into pf from platforms where id = p_platform;
  if not found or not pf.enabled then raise exception 'that platform is not available' using errcode = 'invalid_parameter_value'; end if;
  select * into m from payment_methods where id = p_method;
  if not found or not m.enabled or not m.payout_enabled then raise exception 'that payment method is not available' using errcode = 'invalid_parameter_value'; end if;
  if coalesce(trim(p_handle), '') = '' then raise exception 'we need to know where to send your money' using errcode = 'invalid_parameter_value'; end if;

  v_min := greatest(coalesce(m.min_amount, cfg.min_amount), cfg.min_amount);
  v_max := coalesce(m.max_amount, cfg.max_amount);
  if p_amount < v_min then raise exception 'the smallest cash-out is %', to_char(v_min / 100.0, 'FM999999990D00') using errcode = 'invalid_parameter_value'; end if;
  if p_amount > v_max then raise exception 'the largest cash-out is %', to_char(v_max / 100.0, 'FM999999990D00') using errcode = 'invalid_parameter_value'; end if;
  if cfg.amount_step is not null and (p_amount % cfg.amount_step) <> 0 then
    raise exception 'amounts must be in whole multiples of % — no cents', to_char(cfg.amount_step / 100.0, 'FM999999990') using errcode = 'invalid_parameter_value';
  end if;

  select count(*) into v_open from withdraw_requests
   where player_id = p_player and platform_id = p_platform and status in ('queued', 'partially_filled');
  if v_open >= 1 then
    raise exception 'you already have a cash-out in progress on % — finish or cancel it first', pf.name using errcode = 'invalid_parameter_value';
  end if;

  insert into withdraw_requests (account_id, player_id, platform_id, method_id, currency, amount, amount_remaining, payout_handle, status)
  values (app.current_account(), p_player, p_platform, p_method, cfg.currency, p_amount, p_amount, trim(p_handle), 'queued')
  returning * into w;

  -- Escrow: value leaves the platform and is held for this cash-out.
  perform ledger_post('withdraw.escrow', 'withdraw_request', w.id, null,
    format('escrow %s for cash-out', p_amount),
    jsonb_build_array(
      jsonb_build_object('account_id', account_of('house_settlement', null, p_platform, w.currency), 'amount', -p_amount),
      jsonb_build_object('account_id', account_of('player_escrow', p_player, p_platform, w.currency), 'amount', p_amount)
    ));
  return w;
end $$;

-- ── FIFO queue: oldest first ─────────────────────────────────────────────────
create or replace view v_withdraw_queue as
  select w.*, row_number() over (partition by w.account_id order by coalesce(w.queue_priority, extract(epoch from w.created_at)::bigint), w.created_at, w.id) as queue_position
    from withdraw_requests w
   where w.status in ('queued', 'partially_filled');
grant select on v_withdraw_queue to loady_app;
alter view v_withdraw_queue set (security_invoker = on);   -- RLS applies to the caller

-- ── Admin pays a cash-out from the owner's float ─────────────────────────────
create or replace function withdraw_club_payout(p_withdraw uuid, p_admin uuid, p_amount bigint, p_ref text)
returns fills language plpgsql as $$
declare w withdraw_requests; f fills; v_amt bigint;
begin
  select * into w from withdraw_requests where id = p_withdraw for update;
  if not found then raise exception 'that cash-out no longer exists'; end if;
  if w.status not in ('queued', 'partially_filled') then
    raise exception 'that cash-out is % — it is not waiting to be paid', w.status using errcode = 'invalid_parameter_value';
  end if;
  v_amt := coalesce(p_amount, w.amount_remaining);
  if v_amt <= 0 then raise exception 'amount must be positive' using errcode = 'invalid_parameter_value'; end if;
  if v_amt > w.amount_remaining then raise exception 'only % is still owed on that cash-out', to_char(w.amount_remaining / 100.0, 'FM999999990D00') using errcode = 'invalid_parameter_value'; end if;

  insert into fills (account_id, withdraw_id, method_id, currency, amount, credit_amount, rake_amount, payout_handle, status, payment_ref, released_at, released_by, release_reason)
  values (app.current_account(), w.id, w.method_id, w.currency, v_amt, v_amt, 0, w.payout_handle, 'released', p_ref, now(), p_admin, 'club_paid')
  returning * into f;

  -- Release the escrow against the owner's float (the owner paid the player).
  perform ledger_post('withdraw.club_payout', 'fill', f.id, p_admin,
    format('club paid %s directly', v_amt),
    jsonb_build_array(
      jsonb_build_object('account_id', account_of('player_escrow', w.player_id, w.platform_id, w.currency), 'amount', -v_amt),
      jsonb_build_object('account_id', account_of('owner_float', null, null, w.currency), 'amount', v_amt)
    ));

  update withdraw_requests
     set amount_remaining = amount_remaining - v_amt,
         status = case when amount_remaining - v_amt = 0 then 'filled' else 'partially_filled' end
   where id = w.id;
  return f;
end $$;

grant execute on function withdraw_create(uuid, uuid, uuid, bigint, text) to loady_app;
grant execute on function withdraw_club_payout(uuid, uuid, bigint, text) to loady_app;
