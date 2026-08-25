-- ═══════════════════════════════════════════════════════════════════════════
-- 0010 — Link a member's Telegram / Discord identity so they can act in the bots
-- ═══════════════════════════════════════════════════════════════════════════
--
-- An admin runs /link <code> in the bot; the code (minted on the dashboard Team
-- page for the logged-in member) stamps their Telegram/Discord user id onto their
-- account_member. That's what lets them tap Verify and run admin commands — always
-- checked per-club (isAccountAdmin).

create table member_link_codes (
  code        text primary key,
  account_id  uuid not null references accounts (id) on delete cascade,
  member_id   uuid not null references account_members (id) on delete cascade,
  platform    bot_platform not null,
  expires_at  timestamptz not null,
  used_at     timestamptz
);
