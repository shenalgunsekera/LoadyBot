# Loady

**One bot, every club.** A multi-tenant SaaS that turns our payment/cash-out bot
into a subscription product: any club ("account") signs up, picks a package,
connects the shared Telegram & Discord bots to their own chats, and runs deposits
and cash-outs in a space that's sealed off from every other account.

One Neon database. One Telegram bot. One Discord bot. One dashboard.

## Layout

```
loady/
├─ db/migrations/        SQL schema — control plane + tenant tables behind RLS
├─ packages/core/        DB client, tenant context (withAccount), chat routing
├─ apps/web/             Next.js dashboard + marketing site (account owners)
├─ apps/telegram-bot/    the one shared Telegram bot (grammY)
├─ apps/discord-bot/     the one shared Discord bot (discord.js)
└─ scripts/              migrate.mjs
```

## How isolation works (the important part)

- Every money table has an `account_id` and is under **`FORCE ROW LEVEL SECURITY`**.
- All tenant data access goes through **`withAccount(accountId, fn)`** — it opens a
  transaction, stamps `app.current_account`, and Postgres then refuses to return
  or write any other account's rows. Forget a `WHERE` clause and it still can't leak.
- The bots resolve *which* account a message belongs to from the chat it arrived
  in (`chat_bindings`, unique per chat), then do everything inside `withAccount`.

See `ARCHITECTURE.md` for the full design and roadmap.

## Getting started

```bash
cp .env.example .env      # fill in DATABASE_URL etc.
pnpm install
pnpm migrate              # apply db/migrations
pnpm web                  # dashboard at http://localhost:3000
pnpm tg                   # telegram bot
pnpm dc                   # discord bot
```

> Nothing here touches the existing Poker/Union bots — Loady is a standalone repo.
