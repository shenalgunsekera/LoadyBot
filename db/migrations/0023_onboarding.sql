-- ═══════════════════════════════════════════════════════════════════════════
-- 0023 — Guided onboarding: completion flag + remembered deposit / cash-out prefs
-- ═══════════════════════════════════════════════════════════════════════════
-- The poker bot collects everything up front in one guided sequence (name →
-- platforms → account IDs → club → deposit methods → cash-out method + handle)
-- and remembers it so nothing is re-typed later. Loady now does the same. This
-- adds the three things that flow needs to persist:
--   • players.onboarded_at   — has this player finished setup?
--   • player_method_prefs    — which methods they like to deposit with
--   • player_payout_prefs    — how they get paid (method + handle), one default

alter table players add column if not exists onboarded_at timestamptz;

-- Preferred deposit methods (multi-select at setup; /deposit offers these first).
create table if not exists player_method_prefs (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts (id) on delete cascade,
  player_id   uuid not null references players (id) on delete cascade,
  method_id   uuid not null references payment_methods (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (player_id, method_id)
);
create index if not exists pmp_player_idx on player_method_prefs (account_id, player_id);

-- Remembered cash-out destinations: method + where to send it, saved once so the
-- player never re-types their handle. One row per (player, method); is_default
-- marks the one /withdraw reaches for first.
create table if not exists player_payout_prefs (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts (id) on delete cascade,
  player_id   uuid not null references players (id) on delete cascade,
  method_id   uuid not null references payment_methods (id) on delete cascade,
  handle      text not null,
  holder_name text,
  is_default  boolean not null default false,
  updated_at  timestamptz not null default now(),
  unique (player_id, method_id)
);
create index if not exists ppp_player_idx on player_payout_prefs (account_id, player_id);

-- Same RLS shape as every tenant table (see 0002): tenant_isolation on account_id.
do $$
declare t text;
begin
  foreach t in array array['player_method_prefs','player_payout_prefs'] loop
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

-- ── Helpers (run as the app role under withAccount; account_id is stamped from
--    app.current_account() so RLS is satisfied) ─────────────────────────────────

-- Store the player's ClubGG-style ID + separate username on a platform link.
create or replace function player_set_platform_full(
  p_player uuid, p_platform uuid, p_uid text, p_username text)
returns void language plpgsql as $$
begin
  insert into player_platforms (account_id, player_id, platform_id, platform_uid, platform_username)
  values (app.current_account(), p_player, p_platform, trim(p_uid), trim(p_username))
  on conflict (account_id, player_id, platform_id)
    do update set platform_uid = trim(p_uid), platform_username = trim(p_username);
end $$;
grant execute on function player_set_platform_full(uuid, uuid, text, text) to loady_app;

-- Replace the player's preferred deposit methods with exactly this set.
create or replace function player_set_method_prefs(p_player uuid, p_methods uuid[])
returns void language plpgsql as $$
begin
  delete from player_method_prefs where player_id = p_player;
  insert into player_method_prefs (account_id, player_id, method_id)
  select app.current_account(), p_player, m
    from unnest(p_methods) m
  on conflict (player_id, method_id) do nothing;
end $$;
grant execute on function player_set_method_prefs(uuid, uuid[]) to loady_app;

-- Remember (or update) a cash-out destination. First one saved becomes default.
create or replace function player_remember_payout(
  p_player uuid, p_method uuid, p_handle text, p_name text)
returns void language plpgsql as $$
declare has_default boolean;
begin
  select exists(select 1 from player_payout_prefs where player_id = p_player and is_default)
    into has_default;
  insert into player_payout_prefs (account_id, player_id, method_id, handle, holder_name, is_default)
  values (app.current_account(), p_player, p_method, trim(p_handle), nullif(trim(coalesce(p_name,'')),''), not has_default)
  on conflict (player_id, method_id)
    do update set handle = trim(p_handle),
                  holder_name = nullif(trim(coalesce(p_name,'')),''),
                  updated_at = now();
end $$;
grant execute on function player_remember_payout(uuid, uuid, text, text) to loady_app;

-- Mark setup finished.
create or replace function player_mark_onboarded(p_player uuid)
returns void language plpgsql as $$
begin
  update players set onboarded_at = now() where id = p_player;
end $$;
grant execute on function player_mark_onboarded(uuid) to loady_app;
