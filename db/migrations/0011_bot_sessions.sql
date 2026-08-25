-- ═══════════════════════════════════════════════════════════════════════════
-- 0011 — Persistent bot session state (so the Telegram webhook is serverless)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- On Vercel each webhook call is a fresh process, so the multi-step deposit flow
-- can't keep state in memory. This table holds a player's in-flight step, keyed
-- by chat:user. It's bot plumbing, not tenant data — no RLS.
create table bot_sessions (
  key        text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
