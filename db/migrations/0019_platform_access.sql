-- ═══════════════════════════════════════════════════════════════════════════
-- 0019 — Per-account Telegram / Discord access (operator-controlled, billable)
-- ═══════════════════════════════════════════════════════════════════════════
-- The operator switches each club's Telegram and Discord bots on or off from the
-- ops panel. When off, that bot stands down for the club (like a paused account,
-- but per-platform). Default on so nothing existing changes.

alter table accounts add column if not exists telegram_enabled boolean not null default true;
alter table accounts add column if not exists discord_enabled  boolean not null default true;
