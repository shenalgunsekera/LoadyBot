-- ═══════════════════════════════════════════════════════════════════════════
-- 0002 — Tenant tables + Row-Level Security (the isolation backbone)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Every table here carries account_id and is placed behind FORCE ROW LEVEL
-- SECURITY with one policy: a row is visible/writable only when its account_id
-- equals app.current_account() (set per request). FORCE means the policy applies
-- even to the table owner (Neon's default role), so there is no privileged path
-- that leaks. app.bypass='on' (set only by migrations/platform jobs) is the sole
-- escape hatch. Forget a WHERE clause and the database still refuses to cross
-- accounts — isolation is enforced by Postgres, not by hopeful app code.

-- ── Per-account settings (one row per account) ───────────────────────────────
create table account_config (
  account_id    uuid primary key references accounts (id) on delete cascade,
  currency      text not null default 'USD',
  min_amount    bigint not null default 2000,        -- cents; the global floor
  max_amount    bigint not null default 500000,
  amount_step   bigint not null default 500,
  hold_seconds  bigint not null default 259200,      -- reversible-payment hold
  escalate_seconds bigint not null default 86400,
  owner_approval_threshold bigint,                    -- null = none
  reversible_allowed boolean not null default true,
  auto_release  boolean not null default false,
  in_development boolean not null default true,
  updated_at    timestamptz not null default now()
);

-- ── Poker/sportsbook platforms a player can be on (per account) ──────────────
create table platforms (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts (id) on delete cascade,
  code        text not null,                          -- 'clubgg' | 'sportsbook'
  name        text not null,
  enabled     boolean not null default true,
  sort_order  int not null default 0,
  unique (account_id, code)
);
create index platforms_account_idx on platforms (account_id);

create table clubs (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);
create index clubs_account_idx on clubs (account_id);

-- ── Payment methods (per account) ────────────────────────────────────────────
create table payment_methods (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts (id) on delete cascade,
  code          text not null,
  name          text not null,
  enabled       boolean not null default true,
  payout_enabled boolean not null default true,
  settlement    text not null default 'p2p',          -- 'p2p' | 'company'
  min_amount    bigint,                                -- null → account floor
  max_amount    bigint,
  hold_seconds  bigint,
  processor_fee_bps  int not null default 0,
  processor_fee_flat bigint not null default 0,
  club_handle   text,
  handle_hint   text,
  handle_tiers  jsonb,
  sort_order    int not null default 0,
  unique (account_id, code)
);
create index methods_account_idx on payment_methods (account_id);

-- ── Players (per account) ────────────────────────────────────────────────────
create table players (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts (id) on delete cascade,
  display_name  text,
  telegram_user_id text,
  discord_user_id  text,
  status        text not null default 'active',
  flagged       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index players_account_idx on players (account_id);
create index players_tg_idx on players (account_id, telegram_user_id);
create index players_dc_idx on players (account_id, discord_user_id);

create table player_platforms (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts (id) on delete cascade,
  player_id     uuid not null references players (id) on delete cascade,
  platform_id   uuid not null references platforms (id) on delete cascade,
  club_id       uuid references clubs (id),
  platform_uid  text,
  platform_username text,
  created_at    timestamptz not null default now()
);
create index pp_account_idx on player_platforms (account_id, player_id);

-- ── Money: deposits, withdrawals, fills, receipts, audit (structure only; the
--    matching/ledger functions are ported in a later migration) ──────────────
create table deposit_requests (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts (id) on delete cascade,
  player_id     uuid not null references players (id),
  platform_id   uuid references platforms (id),
  method_id     uuid references payment_methods (id),
  currency      text not null default 'USD',
  amount        bigint not null,
  amount_remaining bigint not null default 0,
  status        text not null default 'pending',
  created_at    timestamptz not null default now()
);
create index deposits_account_idx on deposit_requests (account_id, created_at desc);

create table withdraw_requests (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts (id) on delete cascade,
  player_id     uuid not null references players (id),
  platform_id   uuid references platforms (id),
  method_id     uuid references payment_methods (id),
  currency      text not null default 'USD',
  amount        bigint not null,
  amount_remaining bigint not null,
  min_override  bigint,
  queue_priority bigint,
  payout_handle text,
  status        text not null default 'queued',
  created_at    timestamptz not null default now()
);
create index withdraws_account_idx on withdraw_requests (account_id, created_at);

create table fills (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts (id) on delete cascade,
  deposit_id    uuid references deposit_requests (id),
  withdraw_id   uuid references withdraw_requests (id),
  method_id     uuid references payment_methods (id),
  currency      text not null default 'USD',
  amount        bigint not null,
  status        text not null default 'locked',
  payout_handle text,
  payment_ref   text,
  released_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index fills_account_idx on fills (account_id, created_at);

create table receipts (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts (id) on delete cascade,
  reference     text not null,
  player_id     uuid references players (id),
  player_name   text,
  ref_type      text not null,
  ref_id        uuid not null,
  url           text not null,
  storage_path  text,
  content_type  text,
  created_at    timestamptz not null default now(),
  unique (account_id, reference)
);
create index receipts_account_idx on receipts (account_id, created_at desc);

create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts (id) on delete cascade,
  member_id     uuid references account_members (id),
  action        text not null,
  ref_type      text,
  ref_id        uuid,
  detail        jsonb,
  created_at    timestamptz not null default now()
);
create index audit_account_idx on audit_log (account_id, created_at desc);

-- ── Turn on RLS for every tenant table, uniformly ───────────────────────────
do $$
declare
  t text;
  tenant_tables text[] := array[
    'account_config','platforms','clubs','payment_methods','players','player_platforms',
    'deposit_requests','withdraw_requests','fills','receipts','audit_log'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force  row level security', t);
    execute format($p$
      create policy tenant_isolation on %I
        using  (coalesce(current_setting('app.bypass', true), 'off') = 'on'
                or account_id = app.current_account())
        with check (coalesce(current_setting('app.bypass', true), 'off') = 'on'
                or account_id = app.current_account())
    $p$, t);
  end loop;
end $$;
