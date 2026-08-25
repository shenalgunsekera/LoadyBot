# Deploying Loady

Three things go live: the **web dashboard** (Vercel), the **Telegram bot**, and the
**Discord bot** (both long-running processes on Railway/Render/Fly). The database
(Supabase) is already live and migrated.

Nothing here is destructive; each service just needs its environment variables.

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

---

## 2. Telegram bot → Railway (persistent process)

1. **railway.app → New Project → Deploy from GitHub repo** → `LoadyBot`.
2. In the service **Settings**:
   - **Start Command:** `pnpm install --frozen-lockfile && pnpm -C apps/telegram-bot start`
3. **Variables** — add: `DATABASE_URL`, `TELEGRAM_TOKEN`.
4. Deploy. Logs should show `Loady bot starting`.

## 3. Discord bot → Railway (second service)

1. In the same Railway project → **New → GitHub Repo** (same repo) as a second service.
2. **Start Command:** `pnpm install --frozen-lockfile && pnpm -C apps/discord-bot start`
3. **Variables:** `DATABASE_URL`, `DISCORD_TOKEN`, `DISCORD_APP_ID`.
4. In the **Discord Developer Portal → your app → Bot**, ensure **Message Content
   Intent** is ON.
5. Deploy. On boot it registers its slash commands globally (may take up to ~1h to
   appear; set `DISCORD_GUILD_ID` to a test server for instant registration).

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
