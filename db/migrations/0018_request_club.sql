-- ═══════════════════════════════════════════════════════════════════════════
-- 0018 — Snapshot the club on each deposit / cash-out
-- ═══════════════════════════════════════════════════════════════════════════
-- So per-club reporting is historically exact instead of following the player's
-- current club. A BEFORE INSERT trigger stamps the player's active club for that
-- platform; existing rows are backfilled the same way.

alter table deposit_requests  add column if not exists club_id uuid references clubs (id);
alter table withdraw_requests add column if not exists club_id uuid references clubs (id);

create or replace function stamp_request_club() returns trigger language plpgsql as $$
begin
  if new.club_id is null then
    new.club_id := (select pp.club_id from player_platforms pp
                     where pp.player_id = new.player_id and pp.platform_id = new.platform_id
                     limit 1);
  end if;
  return new;
end $$;

drop trigger if exists deposit_stamp_club on deposit_requests;
create trigger deposit_stamp_club before insert on deposit_requests
  for each row execute function stamp_request_club();

drop trigger if exists withdraw_stamp_club on withdraw_requests;
create trigger withdraw_stamp_club before insert on withdraw_requests
  for each row execute function stamp_request_club();

update deposit_requests d set club_id = (
  select pp.club_id from player_platforms pp
   where pp.player_id = d.player_id and pp.platform_id = d.platform_id limit 1)
 where d.club_id is null;

update withdraw_requests w set club_id = (
  select pp.club_id from player_platforms pp
   where pp.player_id = w.player_id and pp.platform_id = w.platform_id limit 1)
 where w.club_id is null;
