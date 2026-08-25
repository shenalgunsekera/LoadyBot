-- ═══════════════════════════════════════════════════════════════════════════
-- 0006 — Per-player tickets + identity, and how a message finds its club
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Same ticket model as the production bots, made multi-tenant:
--   • Discord: a ticket channel per player, inside the club's bound server. The
--     server binding (chat_bindings) already tells us the club; we record which
--     channel is whose ticket.
--   • Telegram: each player has their own chat — a DM or a private per-player
--     group. A bound group routes by its binding; a DM has NO club context, so
--     the player reaches their club through a per-club deep link
--     (t.me/TLoadyBot?start=<join_token>) that binds their Telegram id to the
--     club on first /start.
--
-- Everything below is looked up as (account_id, user/chat) — NEVER by user id
-- alone — so the same person in two clubs stays two separate players.

alter table players add column if not exists username      text;
alter table players add column if not exists tg_chat_id    text;   -- where to reach them on Telegram
alter table players add column if not exists dc_channel_id text;   -- their Discord ticket channel
create index if not exists players_tg_chat_idx on players (account_id, tg_chat_id) where tg_chat_id is not null;
create index if not exists players_dc_chan_idx on players (account_id, dc_channel_id) where dc_channel_id is not null;

-- A stable per-club token for the Telegram player deep link. Reusable (unlike a
-- one-time connect code): the club shares one link with all its players.
alter table accounts add column if not exists join_token text unique;
update accounts set join_token = encode(gen_random_bytes(9), 'base64')
  where join_token is null;
alter table accounts alter column join_token set not null;
alter table accounts alter column join_token set default encode(gen_random_bytes(9), 'base64');

-- ── Find-or-create the player in the CURRENT tenant context (inside withAccount)
create or replace function player_touch_tg(p_uid text, p_username text, p_chat_id text)
returns players language plpgsql as $$
declare v players; v_acct uuid := app.current_account();
begin
  select * into v from players where telegram_user_id = p_uid limit 1;   -- RLS scopes to this club
  if not found then
    insert into players (account_id, telegram_user_id, username, tg_chat_id, display_name)
    values (v_acct, p_uid, p_username, p_chat_id, p_username) returning * into v;
  else
    update players set tg_chat_id = coalesce(p_chat_id, tg_chat_id),
                       username   = coalesce(p_username, username) where id = v.id returning * into v;
  end if;
  return v;
end $$;

create or replace function player_touch_dc(p_uid text, p_username text, p_channel text)
returns players language plpgsql as $$
declare v players; v_acct uuid := app.current_account();
begin
  select * into v from players where discord_user_id = p_uid limit 1;
  if not found then
    insert into players (account_id, discord_user_id, username, dc_channel_id, display_name)
    values (v_acct, p_uid, p_username, p_channel, p_username) returning * into v;
  else
    update players set dc_channel_id = coalesce(p_channel, dc_channel_id),
                       username      = coalesce(p_username, username) where id = v.id returning * into v;
  end if;
  return v;
end $$;

grant execute on function player_touch_tg(text, text, text) to loady_app;
grant execute on function player_touch_dc(text, text, text) to loady_app;
