-- ═══════════════════════════════════════════════════════════════════════════
-- 0007 — Money engine, layer 1: deposit → submit proof → release (credit)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The first real money movement, per club, on the ledger from 0005. Financial
-- model mirrors the production engine: a company-settled deposit lands value on
-- the platform (house_settlement) and books the fee (house_rake), offset by the
-- owner's float. Peer-to-peer matching, the loader/unload step, rake config and
-- tiers layer on in later migrations. Runs entirely in tenant context.

-- Fills gain the fields the lifecycle needs.
alter table fills add column if not exists credit_amount bigint not null default 0;
alter table fills add column if not exists rake_amount   bigint not null default 0;
alter table fills add column if not exists seq           int    not null default 1;
alter table fills add column if not exists payment_ref   text;
alter table fills add column if not exists proof_note    text;
alter table fills add column if not exists submitted_at  timestamptz;
alter table fills add column if not exists released_by   uuid references account_members (id);
alter table fills add column if not exists release_reason text;

-- ── Create a deposit + its (company) fill ────────────────────────────────────
create or replace function deposit_create(p_player uuid, p_platform uuid, p_method uuid, p_amount bigint)
returns deposit_requests language plpgsql as $$
declare
  cfg account_config; pl players; m payment_methods; pf platforms;
  d deposit_requests; v_min bigint; v_max bigint; v_open int;
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

  -- Amount rules. Card/Apple Pay (stripe) is exempt (its amount is whatever
  -- arrived on Stripe). The global minimum is a hard floor a method can only raise.
  if m.code <> 'stripe' then
    v_min := greatest(coalesce(m.min_amount, cfg.min_amount), cfg.min_amount);
    v_max := coalesce(m.max_amount, cfg.max_amount);
    if p_amount < v_min then
      raise exception 'the smallest amount is %', to_char(v_min / 100.0, 'FM999999990D00') using errcode = 'invalid_parameter_value';
    end if;
    if p_amount > v_max then
      raise exception 'the largest amount is %', to_char(v_max / 100.0, 'FM999999990D00') using errcode = 'invalid_parameter_value';
    end if;
    if cfg.amount_step is not null and (p_amount % cfg.amount_step) <> 0 then
      raise exception 'amounts must be in whole multiples of % — no cents', to_char(cfg.amount_step / 100.0, 'FM999999990') using errcode = 'invalid_parameter_value';
    end if;
  end if;

  -- One open deposit per platform.
  select count(*) into v_open from deposit_requests
   where player_id = p_player and platform_id = p_platform
     and status in ('awaiting_payment', 'awaiting_confirmation');
  if v_open >= 1 then
    raise exception 'you already have a deposit in progress on % — finish or cancel it first', pf.name using errcode = 'invalid_parameter_value';
  end if;

  insert into deposit_requests (account_id, player_id, platform_id, method_id, currency, amount, amount_remaining, status)
  values (app.current_account(), p_player, p_platform, p_method, cfg.currency, p_amount, p_amount, 'awaiting_payment')
  returning * into d;

  -- One company fill for the whole amount (v1: no p2p split, rake 0).
  insert into fills (account_id, deposit_id, method_id, currency, amount, credit_amount, rake_amount, status, seq)
  values (app.current_account(), d.id, p_method, cfg.currency, p_amount, p_amount, 0, 'locked', 1);

  return d;
end $$;

-- ── Player has paid: attach a reference and move to awaiting confirmation ────
create or replace function fill_submit_proof(p_fill uuid, p_ref text, p_note text)
returns fills language plpgsql as $$
declare f fills;
begin
  select * into f from fills where id = p_fill for update;
  if not found then raise exception 'fill not found'; end if;
  if f.status <> 'locked' then return f; end if;   -- idempotent
  update fills set status = 'awaiting_confirmation', submitted_at = now(),
                   payment_ref = coalesce(p_ref, payment_ref), proof_note = coalesce(p_note, proof_note)
   where id = f.id returning * into f;
  update deposit_requests set status = 'awaiting_confirmation' where id = f.deposit_id and status = 'awaiting_payment';
  return f;
end $$;

-- ── Admin verifies: release the fill and book it on the ledger ───────────────
create or replace function fill_release(p_fill uuid, p_admin uuid, p_reason text)
returns fills language plpgsql as $$
declare f fills; d deposit_requests;
begin
  select * into f from fills where id = p_fill for update;
  if not found then raise exception 'fill not found'; end if;
  if f.status <> 'awaiting_confirmation' then
    raise exception 'this payment is % — only one awaiting confirmation can be released', f.status using errcode = 'invalid_parameter_value';
  end if;
  select * into d from deposit_requests where id = f.deposit_id for update;

  -- Company-settled: value lands on the platform, fee booked, offset by float.
  perform ledger_post('fill.release', 'fill', f.id, p_admin,
    format('release %s as %s credit (fee %s)', f.amount, f.credit_amount, f.rake_amount),
    jsonb_build_array(
      jsonb_build_object('account_id', account_of('owner_float', null, null, f.currency), 'amount', -f.amount),
      jsonb_build_object('account_id', account_of('house_settlement', null, d.platform_id, f.currency), 'amount', f.credit_amount),
      jsonb_build_object('account_id', account_of('house_rake', null, null, f.currency), 'amount', f.rake_amount)
    ));

  update fills set status = 'released', released_at = now(), released_by = p_admin, release_reason = p_reason
   where id = f.id returning * into f;

  -- Settle the deposit when every fill is released.
  if not exists (select 1 from fills where deposit_id = d.id and status <> 'released') then
    update deposit_requests set status = 'settled' where id = d.id;
  end if;
  return f;
end $$;

grant execute on function deposit_create(uuid, uuid, uuid, bigint) to loady_app;
grant execute on function fill_submit_proof(uuid, text, text) to loady_app;
grant execute on function fill_release(uuid, uuid, text) to loady_app;
