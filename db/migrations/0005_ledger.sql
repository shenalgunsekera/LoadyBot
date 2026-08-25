-- ═══════════════════════════════════════════════════════════════════════════
-- 0005 — The double-entry ledger (per account, RLS-isolated)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Ported from the production engine intact. Two changes for Loady:
--   • its ledger `accounts` table is renamed `ledger_accounts` (our `accounts`
--     table is the TENANT now), and
--   • every ledger table carries account_id and sits behind RLS, so each club's
--     books are sealed off. The invariant is unchanged and holds PER CLUB:
--       for every (account, currency):  SUM(ledger_entries.amount) = 0.  Always.

do $$ begin
  create type account_kind as enum
    ('player_wallet', 'player_escrow', 'house_settlement', 'house_rake', 'house_loss', 'owner_float');
exception when duplicate_object then null; end $$;

-- ── Ledger accounts (wallets / escrow / house buckets) ──────────────────────
create table ledger_accounts (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts (id) on delete cascade,   -- TENANT
  kind        account_kind not null,
  player_id   uuid references players (id),
  platform_id uuid references platforms (id),
  currency    char(3) not null,
  balance     bigint not null default 0,     -- cache; ledger_verify re-derives truth
  created_at  timestamptz not null default now(),
  constraint ledger_accounts_shape check (
    (kind in ('player_wallet', 'player_escrow') and player_id is not null and platform_id is not null)
    or (kind = 'house_settlement' and player_id is null and platform_id is not null)
    or (kind in ('house_rake', 'house_loss', 'owner_float') and player_id is null and platform_id is null)
  )
);
create unique index la_player_uniq     on ledger_accounts (account_id, kind, player_id, platform_id, currency) where player_id is not null;
create unique index la_settlement_uniq on ledger_accounts (account_id, kind, platform_id, currency) where player_id is null and platform_id is not null;
create unique index la_house_uniq      on ledger_accounts (account_id, kind, currency) where player_id is null and platform_id is null;
create index la_player_lookup_idx on ledger_accounts (account_id, player_id) where player_id is not null;

create table ledger_transactions (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts (id) on delete cascade,
  kind        text not null,
  ref_type    text,
  ref_id      uuid,
  memo        text,
  member_id   uuid references account_members (id),   -- null = system
  created_at  timestamptz not null default now()
);
create index lt_ref_idx  on ledger_transactions (account_id, ref_type, ref_id);
create index lt_kind_idx on ledger_transactions (account_id, kind, created_at desc);

create table ledger_entries (
  id         bigserial primary key,
  account_id uuid not null references accounts (id) on delete cascade,
  tx_id      uuid not null references ledger_transactions (id),
  la_id      uuid not null references ledger_accounts (id),
  amount     bigint not null check (amount <> 0),
  created_at timestamptz not null default now()
);
create index le_la_idx on ledger_entries (la_id, id);
create index le_tx_idx on ledger_entries (tx_id);

-- ── (1) Append-only ──────────────────────────────────────────────────────────
create or replace function reject_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only: % is not permitted. Post a reversing entry instead.',
    tg_table_name, tg_op using errcode = 'restrict_violation';
end $$;
create trigger ledger_entries_immutable       before update or delete on ledger_entries       for each row execute function reject_mutation();
create trigger ledger_transactions_immutable   before update or delete on ledger_transactions   for each row execute function reject_mutation();
create trigger audit_log_immutable             before update or delete on audit_log             for each row execute function reject_mutation();

-- ── Balance cache ────────────────────────────────────────────────────────────
create or replace function ledger_apply_balance() returns trigger
language plpgsql as $$
begin
  update ledger_accounts set balance = balance + new.amount where id = new.la_id;
  return null;
end $$;
create trigger ledger_entries_apply_balance after insert on ledger_entries for each row execute function ledger_apply_balance();

-- ── (2) Every transaction nets to zero, per currency (deferred to commit) ────
create or replace function assert_tx_balanced() returns trigger
language plpgsql as $$
declare v_currency char(3); v_sum bigint;
begin
  for v_currency, v_sum in
    select a.currency, sum(e.amount) from ledger_entries e join ledger_accounts a on a.id = e.la_id
     where e.tx_id = new.tx_id group by a.currency
  loop
    if v_sum <> 0 then
      raise exception 'ledger transaction % does not balance in %: sum = % (money was created or destroyed)',
        new.tx_id, v_currency, v_sum using errcode = 'check_violation';
    end if;
  end loop;
  return null;
end $$;
create constraint trigger ledger_entries_balanced after insert on ledger_entries
  deferrable initially deferred for each row execute function assert_tx_balanced();

-- ── (3) Player accounts never go negative ───────────────────────────────────
create or replace function assert_account_nonnegative() returns trigger
language plpgsql as $$
declare a ledger_accounts;
begin
  select * into a from ledger_accounts where id = new.la_id;
  if a.kind in ('player_wallet', 'player_escrow') and a.balance < 0 then
    raise exception 'account %/% would go negative: balance = % (insufficient funds)',
      a.kind, coalesce(a.player_id::text, 'house'), a.balance using errcode = 'check_violation';
  end if;
  return null;
end $$;
create constraint trigger ledger_entries_nonnegative after insert on ledger_entries
  deferrable initially deferred for each row execute function assert_account_nonnegative();

-- ═══════════════════════════════════════════════════════════════════════════
-- Helpers — the only sanctioned way to touch the ledger. All run inside a tenant
-- context (withAccount), so app.current_account() is the club they belong to.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function account_of(p_kind account_kind, p_player uuid, p_platform uuid, p_currency char(3))
returns uuid language plpgsql as $$
declare v_id uuid; v_acct uuid := app.current_account();
begin
  if p_kind in ('player_wallet', 'player_escrow') then
    if p_player is null or p_platform is null then raise exception 'account_of: % needs a player AND a platform', p_kind; end if;
  elsif p_kind = 'house_settlement' then
    if p_player is not null or p_platform is null then raise exception 'account_of: house_settlement takes a platform, no player'; end if;
  else
    if p_player is not null or p_platform is not null then raise exception 'account_of: % is a global house account', p_kind; end if;
  end if;

  select id into v_id from ledger_accounts
   where kind = p_kind and player_id is not distinct from p_player
     and platform_id is not distinct from p_platform and currency = p_currency;
  if v_id is not null then return v_id; end if;
  begin
    insert into ledger_accounts (account_id, kind, player_id, platform_id, currency)
    values (v_acct, p_kind, p_player, p_platform, p_currency) returning id into v_id;
  exception when unique_violation then
    select id into v_id from ledger_accounts
     where kind = p_kind and player_id is not distinct from p_player
       and platform_id is not distinct from p_platform and currency = p_currency;
  end;
  return v_id;
end $$;

create or replace function balance_of(p_kind account_kind, p_player uuid, p_platform uuid, p_currency char(3))
returns bigint language sql stable as $$
  select coalesce((select balance from ledger_accounts
    where kind = p_kind and player_id is not distinct from p_player
      and platform_id is not distinct from p_platform and currency = p_currency), 0);
$$;

-- Post one balanced transaction. Zero-amount legs dropped; ≥2 real legs required.
create or replace function ledger_post(p_kind text, p_ref_type text, p_ref_id uuid, p_actor uuid, p_memo text, p_entries jsonb)
returns uuid language plpgsql as $$
declare v_tx uuid; v_rows int; v_acct uuid := app.current_account();
begin
  insert into ledger_transactions (account_id, kind, ref_type, ref_id, member_id, memo)
  values (v_acct, p_kind, p_ref_type, p_ref_id, p_actor, p_memo) returning id into v_tx;
  insert into ledger_entries (account_id, tx_id, la_id, amount)
  select v_acct, v_tx, (e->>'account_id')::uuid, (e->>'amount')::bigint
    from jsonb_array_elements(p_entries) e where (e->>'amount')::bigint <> 0;
  get diagnostics v_rows = row_count;
  if v_rows < 2 then
    raise exception 'ledger_post(%): needs at least two non-zero legs, got % — refusing a one-sided entry',
      p_kind, v_rows using errcode = 'check_violation';
  end if;
  return v_tx;
end $$;

-- Zero rows iff this club's ledger is healthy.
create or replace function ledger_verify()
returns table (problem text, detail jsonb) language plpgsql stable as $$
begin
  return query select 'global sum is not zero',
      jsonb_build_object('currency', a.currency, 'sum', sum(e.amount))
    from ledger_entries e join ledger_accounts a on a.id = e.la_id
    group by a.currency having sum(e.amount) <> 0;
  return query select 'transaction does not balance',
      jsonb_build_object('tx_id', e.tx_id, 'currency', a.currency, 'sum', sum(e.amount))
    from ledger_entries e join ledger_accounts a on a.id = e.la_id
    group by e.tx_id, a.currency having sum(e.amount) <> 0;
  return query select 'cached balance disagrees with entries',
      jsonb_build_object('la_id', a.id, 'kind', a.kind, 'cached', a.balance, 'derived', coalesce(s.total, 0))
    from ledger_accounts a
    left join (select la_id, sum(amount) total from ledger_entries group by la_id) s on s.la_id = a.id
    where a.balance <> coalesce(s.total, 0);
  return query select 'player account is negative',
      jsonb_build_object('la_id', a.id, 'kind', a.kind, 'player_id', a.player_id, 'balance', a.balance)
    from ledger_accounts a where a.kind in ('player_wallet', 'player_escrow') and a.balance < 0;
end $$;

-- ── RLS for the ledger tables ────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['ledger_accounts', 'ledger_transactions', 'ledger_entries'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force  row level security', t);
    execute format($p$create policy tenant_isolation on %I
      using  (coalesce(current_setting('app.bypass', true), 'off') = 'on' or account_id = app.current_account())
      with check (coalesce(current_setting('app.bypass', true), 'off') = 'on' or account_id = app.current_account())$p$, t);
  end loop;
end $$;

grant execute on function account_of(account_kind, uuid, uuid, char) to loady_app;
grant execute on function balance_of(account_kind, uuid, uuid, char) to loady_app;
grant execute on function ledger_post(text, text, uuid, uuid, text, jsonb) to loady_app;
grant execute on function ledger_verify() to loady_app;
