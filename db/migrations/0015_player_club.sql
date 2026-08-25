-- ═══════════════════════════════════════════════════════════════════════════
-- 0015 — Assign a club to a player's linked platform (/editclubs)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function player_set_club(p_player uuid, p_platform uuid, p_club uuid)
returns void language plpgsql as $$
begin
  update player_platforms set club_id = p_club
   where player_id = p_player and platform_id = p_platform;
end $$;

grant execute on function player_set_club(uuid, uuid, uuid) to loady_app;
