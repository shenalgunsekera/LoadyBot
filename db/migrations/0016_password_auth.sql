-- ═══════════════════════════════════════════════════════════════════════════
-- 0016 — Password auth for club members (they go in and out constantly)
-- ═══════════════════════════════════════════════════════════════════════════
-- Members now sign in with email + password instead of a magic link. The hash is
-- salt:hash (scrypt), set at signup or when an invited admin first joins.
alter table account_members add column if not exists password_hash text;
