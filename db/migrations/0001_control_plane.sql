-- ═══════════════════════════════════════════════════════════════════════════
-- 0001 — Control plane: accounts (tenants), billing, members, chat bindings, auth
-- ═══════════════════════════════════════════════════════════════════════════
--
-- These tables are NOT tenant-scoped — they are the platform's own bookkeeping,
-- the map that turns "a message from this chat" into "this account". Every
-- MONEY table (players, deposits, fills, …) lives behind row-level security and
-- is added in 0002+. The rule that guarantees no cross-account contamination is
-- defined here: app.current_account().

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- case-insensitive email

-- The tenant context. Every request against a money table runs inside a
-- transaction that has stamped app.current_account with the caller's account.
-- RLS policies (0002) compare each row's account_id to this. An empty/absent
-- setting resolves to NULL, which matches no row — fail closed.
create schema if not exists app;
create or replace function app.current_account() returns uuid
  language sql stable as $$
    select nullif(current_setting('app.current_account', true), '')::uuid
$$;

-- ── Enums ────────────────────────────────────────────────────────────────────
do $$ begin
  create type account_status as enum ('trialing', 'active', 'past_due', 'suspended', 'canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_role as enum ('owner', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sub_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bot_platform as enum ('telegram', 'discord');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bind_kind as enum ('payments', 'admin', 'tickets', 'general');
exception when duplicate_object then null; end $$;

-- ── Packages (the subscription tiers you sell) ───────────────────────────────
create table packages (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,               -- 'starter' | 'pro' | 'scale'
  name          text not null,
  price_cents   bigint not null,
  interval      text not null default 'month',       -- 'month' | 'year'
  stripe_price_id text,
  -- What the tier unlocks. Enforced by the app; kept as data so pricing can flex
  -- without a deploy. e.g. {"max_admins":3,"max_methods":5,"p2p":true}
  features      jsonb not null default '{}'::jsonb,
  sort_order    int not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ── Accounts (the tenants — formerly "unions") ───────────────────────────────
create table accounts (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,                -- url-safe handle
  name          text not null,                       -- shown to that account's players
  status        account_status not null default 'trialing',
  package_id    uuid references packages (id),
  timezone      text not null default 'UTC',
  -- Stripe linkage for automated billing
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  trial_ends_at timestamptz,
  suspended_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index accounts_status_idx on accounts (status);

-- ── Members (the people who own/administer an account) ───────────────────────
-- One person = one dashboard login (email) that can also be recognised in the
-- bots by their Telegram/Discord user id. This is who may run admin commands and
-- who the automated chat-binding is attributed to.
create table account_members (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts (id) on delete cascade,
  email         citext not null,
  display_name  text,
  role          member_role not null default 'admin',
  telegram_user_id text,
  discord_user_id  text,
  invited_by    uuid references account_members (id),
  accepted_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (account_id, email)
);
create index members_account_idx  on account_members (account_id);
create index members_tg_idx       on account_members (telegram_user_id) where telegram_user_id is not null;
create index members_dc_idx       on account_members (discord_user_id)  where discord_user_id  is not null;

-- ── Subscriptions (mirror of Stripe, so the bots can gate instantly) ─────────
create table subscriptions (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts (id) on delete cascade,
  package_id    uuid references packages (id),
  stripe_subscription_id text unique,
  status        sub_status not null default 'incomplete',
  current_period_end timestamptz,
  cancel_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index subs_account_idx on subscriptions (account_id);

-- ── Chat bindings (the routing map: a chat → exactly one account) ────────────
-- The unique (platform, chat_id) is the anti-contamination guarantee at the
-- door: a Telegram group or Discord server can belong to one account, full stop.
create table chat_bindings (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts (id) on delete cascade,
  platform      bot_platform not null,
  chat_id       text not null,                       -- tg chat id / discord guild id
  kind          bind_kind not null default 'general',
  title         text,
  bound_by      uuid references account_members (id),
  created_at    timestamptz not null default now(),
  unique (platform, chat_id)
);
create index bindings_account_idx on chat_bindings (account_id);

-- ── Connect codes (one-time codes for the /connect linking flow) ─────────────
create table connect_codes (
  code          text primary key,                    -- short, human-typable
  account_id    uuid not null references accounts (id) on delete cascade,
  platform      bot_platform not null,
  created_by    uuid references account_members (id),
  expires_at    timestamptz not null,
  used_at       timestamptz,
  used_chat_id  text
);

-- ── Dashboard auth (passwordless magic-link + sessions) ──────────────────────
create table login_tokens (
  token       text primary key,
  email       citext not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table sessions (
  token       text primary key,
  member_id   uuid not null references account_members (id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index sessions_member_idx on sessions (member_id);

-- ── Seed the default packages ────────────────────────────────────────────────
insert into packages (code, name, price_cents, sort_order, features) values
  ('starter', 'Starter', 2900, 1, '{"max_admins":2,"max_methods":4,"p2p":false,"discord":true,"telegram":true}'),
  ('pro',     'Pro',     5900, 2, '{"max_admins":6,"max_methods":12,"p2p":true,"discord":true,"telegram":true}'),
  ('scale',   'Scale',   9900, 3, '{"max_admins":20,"max_methods":50,"p2p":true,"discord":true,"telegram":true,"priority_support":true}')
on conflict (code) do nothing;
