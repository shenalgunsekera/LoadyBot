-- ═══════════════════════════════════════════════════════════════════════════
-- 0014 — A player links their game account (ClubGG / Sportsbook)
-- ═══════════════════════════════════════════════════════════════════════════
-- One row per (player, platform); /editplatform sets the username/id the club
-- pays to and loads from on that platform.
create unique index if not exists pp_uniq on player_platforms (account_id, player_id, platform_id);

create or replace function player_set_platform(p_player uuid, p_platform uuid, p_uid text)
returns player_platforms language plpgsql as $$
declare pp player_platforms;
begin
  insert into player_platforms (account_id, player_id, platform_id, platform_uid, platform_username)
  values (app.current_account(), p_player, p_platform, trim(p_uid), trim(p_uid))
  on conflict (account_id, player_id, platform_id)
    do update set platform_uid = trim(p_uid), platform_username = trim(p_uid)
  returning * into pp;
  return pp;
end $$;

create or replace function player_remove_platform(p_player uuid, p_platform uuid)
returns void language plpgsql as $$
begin
  delete from player_platforms where player_id = p_player and platform_id = p_platform;
end $$;

grant execute on function player_set_platform(uuid, uuid, text) to loady_app;
grant execute on function player_remove_platform(uuid, uuid) to loady_app;
