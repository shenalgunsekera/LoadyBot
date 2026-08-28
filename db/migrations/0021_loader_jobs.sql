-- ═══════════════════════════════════════════════════════════════════════════
-- 0021 — Loader jobs: track which verified deposits still need chips loaded
-- ═══════════════════════════════════════════════════════════════════════════
-- When a deposit is verified the money is credited in the ledger, but a human
-- still has to put those chips on the player's actual platform account. This is
-- that to-do list. Pure tracking — no ledger impact: a fill is a pending loader
-- job once it's released, and done once loaded_at is stamped.

alter table fills add column if not exists loaded_at timestamptz;
alter table fills add column if not exists loaded_by uuid references account_members (id);

create index if not exists fills_loader_todo_idx
  on fills (account_id) where status = 'released' and deposit_id is not null and loaded_at is null;
