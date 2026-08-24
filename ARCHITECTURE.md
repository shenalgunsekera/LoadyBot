# Loady — architecture & roadmap

## The model

**Tenancy:** shared database, shared schema, an `account_id` on every tenant
table, **Postgres Row-Level Security** for hard isolation. Not schema-per-tenant
(migration pain), not database-per-tenant (cost). RLS enforced *in the engine*
is stronger than app-code `WHERE` filters and is what guarantees "no data
contamination."

**Two planes:**

| Plane | Tables | RLS? | Accessed via |
|-------|--------|------|--------------|
| Control | `accounts`, `packages`, `subscriptions`, `account_members`, `chat_bindings`, `connect_codes`, `sessions`, `login_tokens` | no | `db()` directly |
| Tenant  | `account_config`, `players`, `payment_methods`, `deposit_requests`, `withdraw_requests`, `fills`, `receipts`, `audit_log`, … | **yes (FORCE)** | `withAccount(id, …)` only |

`app.current_account()` is the pivot: RLS policies compare each row's `account_id`
to it. `withAccount()` sets it per-transaction; `asPlatform()` sets `app.bypass`
for the rare cross-account platform job (provisioning, billing, cleanup).

## The one-bot routing (no per-tenant bots)

```
message → chat_id ──(chat_bindings, UNIQUE per chat)──▶ account
        → billing gate (isServiceable)
        → withAccount(account.id, handler)  ──▶ RLS-sealed data
```

- **Discord:** dashboard "Add to Server" (OAuth2, `state`=connect code) → bot
  `GuildCreate` redeems it → guild bound. Zero manual steps.
- **Telegram:** hands-free (owner adds bot while signed in → `my_chat_member`
  attributes it) *or* `/connect LOADY-XXXX`.
- **DMs:** resolved from the player↔account link; ask only if a user is in >1 account.

## Automated lifecycle

`signup → Stripe Checkout → webhook provisions account (seed config/methods/owner)
→ ACTIVE → connect chats → serve players → Stripe status drives suspend/reactivate/offboard`

No manual operator step at any point.

## Roadmap

- [x] **Phase 0 — foundation:** monorepo, control-plane schema, RLS backbone,
      `withAccount`/`asPlatform`, chat routing, dashboard shell + marketing, bot
      skeletons with routing. *(this commit)*
- [ ] **Phase 1 — auth & onboarding:** magic-link login, signup, Stripe Checkout
      + webhooks, account provisioning, connect-code API, Discord OAuth add flow.
- [ ] **Phase 2 — money engine port:** bring the deposit-match / withdraw-queue /
      fills / ledger / receipts functions over, each `account_id`-scoped, with a
      cross-account isolation test suite.
- [ ] **Phase 3 — dashboard depth:** methods editor, team, queue, receipts,
      audit, cash-flow — the panel we already built, now per-account.
- [ ] **Phase 4 — polish:** per-package feature gating, white-label options,
      abuse kill-switch, usage metering.

## Guardrails

- A tenant-scoping bug in a money app is catastrophic → **RLS + isolation tests**
  are non-negotiable before Phase 2 ships.
- One Telegram bot = one rate-limit budget; fine at 10s of accounts, watch at scale.
- Receipts (images) live in object storage, never Postgres.
