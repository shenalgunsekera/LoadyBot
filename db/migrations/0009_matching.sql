-- ═══════════════════════════════════════════════════════════════════════════
-- 0009 — Money engine, layer 3: peer-to-peer matching
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A deposit is matched to the OLDEST queued cash-out it fully fits into: the
-- depositor pays that player directly, and the float never touches the money.
-- If no single cash-out can absorb the deposit, it settles to the company as
-- before. On release, a p2p fill clears the payee's escrow; a company fill books
-- against the float. (Un-reserving a matched cash-out when a deposit is cancelled
-- is a later layer.)

create or replace function deposit_create(p_player uuid, p_platform uuid, p_method uuid, p_amount bigint)
returns deposit_requests language plpgsql as $$
declare
  cfg account_config; pl players; m payment_methods; pf platforms;
  d deposit_requests; wq withdraw_requests; v_min bigint; v_max bigint; v_open int;
begin
  select * into cfg from account_config where account_id = app.current_account();

  select * into pl from players where id = p_player for update;
  if not found then raise exception 'player not found'; end if;
  if pl.status <> 'active' then
    raise exception 'account is % — deposits are not available', pl.status using errcode = 'insufficient_privilege';
  end if;

  select * into pf from platforms where id = p_platform;
  if not found or not pf.enabled then raise exception 'that platform is not available' using errcode = 'invalid_parameter_value'; end if;
  select * into m from payment_methods where id = p_method;
  if not found or not m.enabled then raise exception 'that payment method is not available' using errcode = 'invalid_parameter_value'; end if;

  if m.code <> 'stripe' then
    v_min := greatest(coalesce(m.min_amount, cfg.min_amount), cfg.min_amount);
    v_max := coalesce(m.max_amount, cfg.max_amount);
    if p_amount < v_min then raise exception 'the smallest amount is %', to_char(v_min / 100.0, 'FM999999990D00') using errcode = 'invalid_parameter_value'; end if;
    if p_amount > v_max then raise exception 'the largest amount is %', to_char(v_max / 100.0, 'FM999999990D00') using errcode = 'invalid_parameter_value'; end if;
    if cfg.amount_step is not null and (p_amount % cfg.amount_step) <> 0 then
      raise exception 'amounts must be in whole multiples of % — no cents', to_char(cfg.amount_step / 100.0, 'FM999999990') using errcode = 'invalid_parameter_value';
    end if;
  end if;

  select count(*) into v_open from deposit_requests
   where player_id = p_player and platform_id = p_platform and status in ('awaiting_payment', 'awaiting_confirmation');
  if v_open >= 1 then
    raise exception 'you already have a deposit in progress on % — finish or cancel it first', pf.name using errcode = 'invalid_parameter_value';
  end if;

  insert into deposit_requests (account_id, player_id, platform_id, method_id, currency, amount, amount_remaining, status)
  values (app.current_account(), p_player, p_platform, p_method, cfg.currency, p_amount, p_amount, 'awaiting_payment')
  returning * into d;

  -- Match the oldest queued cash-out that can absorb the whole deposit (skip
  -- locked so two deposits never grab the same one). Else settle to the company.
  select * into wq from withdraw_requests
   where status in ('queued', 'partially_filled') and currency = cfg.currency and amount_remaining >= p_amount
   order by coalesce(queue_priority, extract(epoch from created_at)::bigint), created_at, id
   limit 1 for update skip locked;

  if found then
    update withdraw_requests set amount_remaining = amount_remaining - p_amount,
       status = case when amount_remaining - p_amount = 0 then 'filled' else 'partially_filled' end
     where id = wq.id;
    insert into fills (account_id, deposit_id, withdraw_id, method_id, currency, amount, credit_amount, rake_amount, payout_handle, status, seq)
    values (app.current_account(), d.id, wq.id, p_method, cfg.currency, p_amount, p_amount, 0, wq.payout_handle, 'locked', 1);
  else
    insert into fills (account_id, deposit_id, method_id, currency, amount, credit_amount, rake_amount, status, seq)
    values (app.current_account(), d.id, p_method, cfg.currency, p_amount, p_amount, 0, 'locked', 1);
  end if;

  return d;
end $$;

create or replace function fill_release(p_fill uuid, p_admin uuid, p_reason text)
returns fills language plpgsql as $$
declare f fills; d deposit_requests; w withdraw_requests; v_entries jsonb;
begin
  select * into f from fills where id = p_fill for update;
  if not found then raise exception 'fill not found'; end if;
  if f.status <> 'awaiting_confirmation' then
    raise exception 'this payment is % — only one awaiting confirmation can be released', f.status using errcode = 'invalid_parameter_value';
  end if;
  select * into d from deposit_requests where id = f.deposit_id for update;

  if f.withdraw_id is null then
    -- Company-settled: value onto the platform, offset by float.
    v_entries := jsonb_build_array(
      jsonb_build_object('account_id', account_of('owner_float', null, null, f.currency), 'amount', -f.amount),
      jsonb_build_object('account_id', account_of('house_settlement', null, d.platform_id, f.currency), 'amount', f.credit_amount),
      jsonb_build_object('account_id', account_of('house_rake', null, null, f.currency), 'amount', f.rake_amount));
  else
    -- Peer-to-peer: the depositor paid the payee directly, so the payee's escrow
    -- clears and the depositor's platform gets the value.
    select * into w from withdraw_requests where id = f.withdraw_id for update;
    v_entries := jsonb_build_array(
      jsonb_build_object('account_id', account_of('player_escrow', w.player_id, w.platform_id, f.currency), 'amount', -f.amount),
      jsonb_build_object('account_id', account_of('house_settlement', null, d.platform_id, f.currency), 'amount', f.credit_amount),
      jsonb_build_object('account_id', account_of('house_rake', null, null, f.currency), 'amount', f.rake_amount));
  end if;

  perform ledger_post('fill.release', 'fill', f.id, p_admin,
    format('release %s as %s credit (fee %s)', f.amount, f.credit_amount, f.rake_amount), v_entries);

  update fills set status = 'released', released_at = now(), released_by = p_admin, release_reason = p_reason
   where id = f.id returning * into f;

  if not exists (select 1 from fills where deposit_id = d.id and status <> 'released') then
    update deposit_requests set status = 'settled' where id = d.id;
  end if;
  return f;
end $$;
