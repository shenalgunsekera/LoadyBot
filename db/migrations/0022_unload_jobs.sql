-- ═══════════════════════════════════════════════════════════════════════════
-- 0022 — Take-off (unload) jobs: chips to remove when a player cashes out
-- ═══════════════════════════════════════════════════════════════════════════
-- The mirror of loader jobs (0021). When a player requests a cash-out, a human
-- takes those chips off their platform account before the money is paid. This
-- tracks that to-do. Pure tracking — no ledger impact.

alter table withdraw_requests add column if not exists unloaded_at timestamptz;
alter table withdraw_requests add column if not exists unloaded_by uuid references account_members (id);

create index if not exists withdraws_unload_todo_idx
  on withdraw_requests (account_id)
  where status in ('queued', 'partially_filled', 'paused') and unloaded_at is null;
