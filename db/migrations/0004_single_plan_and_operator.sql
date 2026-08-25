-- ═══════════════════════════════════════════════════════════════════════════
-- 0004 — One all-in plan, and the operator (super-admin) control room
-- ═══════════════════════════════════════════════════════════════════════════

-- ── One subscription tier, everything included ──────────────────────────────
update packages set active = false where code in ('starter', 'pro', 'scale');
insert into packages (code, name, price_cents, sort_order, active, features) values
  ('complete', 'Loady', 5900, 1, true,
   '{"max_admins":50,"max_methods":50,"p2p":true,"discord":true,"telegram":true,"priority_support":true,"holds":true,"ledger":true,"queue_controls":true}')
on conflict (code) do update set active = true, price_cents = excluded.price_cents, features = excluded.features;

-- ── Platform admins (us — the operators of Loady) ───────────────────────────
-- Separate from account_members: these people run the whole platform, not a club.
create table platform_admins (
  id          uuid primary key default gen_random_uuid(),
  email       citext unique not null,
  created_at  timestamptz not null default now()
);

create table platform_sessions (
  token       text primary key,
  admin_id    uuid not null references platform_admins (id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

-- Seed the first operator. Change/add via the DB as the team grows.
insert into platform_admins (email) values ('shenalgd@gmail.com')
on conflict (email) do nothing;

-- A quick reason field for why an account was switched off, shown in the ops panel.
alter table accounts add column if not exists status_note text;
