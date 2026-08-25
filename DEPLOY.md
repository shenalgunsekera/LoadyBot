# Deploying Loady — all on Vercel

Everything ships in **one Vercel project**: the dashboard plus both bots as
serverless routes (`/api/telegram`, `/api/discord`). No always-on host needed.
The database (Supabase) is already live and migrated.

Nothing here is destructive; the project just needs its environment variables.

---

## 1. Web dashboard → Vercel

1. **vercel.com → Add New → Project → Import** `shenalgunsekera/LoadyBot`.
2. **Root Directory:** click *Edit* and set it to **`apps/web`**.
3. Vercel auto-detects Next.js + pnpm. Leave build/install as defaults.
4. **Environment Variables** (Settings → Environment Variables) — add:
   - `DATABASE_URL` = your Supabase transaction-pooler URL (same as local `.env`)
   - `APP_URL` = `https://<your-vercel-domain>` (set after first deploy, then redeploy)
   - `SESSION_SECRET` = the long random string from `.env`
   - *(optional now)* `RESEND_API_KEY`, `EMAIL_FROM` — for real magic-link emails
   - `DISCORD_CLIENT_ID` — so the "Add to Discord" button works
5. **Deploy.** Then set `APP_URL` to the real domain and redeploy once.

> Magic links: without `RESEND_API_KEY`, the dashboard prints the login link on
> screen (dev mode). For real users you'll want Resend (or any SMTP) configured.

Add these env vars too (same Vercel project): `TELEGRAM_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`
(any random string), `DISCORD_TOKEN`, `DISCORD_APP_ID`, `DISCORD_PUBLIC_KEY`.

---

## 2. Point Telegram at the webhook

Once the site is live, run this once (replace the token, domain, and secret):

```bash
curl "https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook?url=https://<domain>/api/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

## 3. Point Discord at the interactions endpoint

1. Register the slash commands once (from your machine, with `.env` filled):
   `pnpm -C apps/discord-bot register`
2. **Discord Developer Portal → your app → General Information → Interactions
   Endpoint URL** = `https://<domain>/api/discord` → **Save**. Discord verifies it
   with a test ping; the route answers it.

> On Discord, players attach their screenshot with **`/receipt`** (serverless can't
> watch channel uploads). Everything else is identical.

---

## Applying future DB migrations

The prod DB is already migrated. When you add a migration later:

```bash
DATABASE_URL="<prod url>" node scripts/migrate.mjs
```

## Env var reference

| Var | Web | TG bot | DC bot |
|-----|-----|--------|--------|
| DATABASE_URL | ✅ | ✅ | ✅ |
| SESSION_SECRET | ✅ | | |
| APP_URL | ✅ | | |
| TELEGRAM_TOKEN | | ✅ | |
| DISCORD_TOKEN / DISCORD_APP_ID | | | ✅ |
| DISCORD_CLIENT_ID | ✅ (invite button) | | |
| RESEND_API_KEY / EMAIL_FROM | ✅ (real emails) | | |
