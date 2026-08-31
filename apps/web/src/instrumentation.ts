/**
 * Self-healing Telegram webhook.
 * ══════════════════════════════
 * Vercel deployment URLs are immutable — a webhook pinned to one keeps hitting
 * that exact (soon-old) build forever, so bot fixes never go live until someone
 * re-points it by hand. Next runs register() when a server instance boots, so we
 * use it to make production keep its own webhook pointed at itself: on boot, if
 * the Telegram webhook isn't already this deployment's URL, set it. Any deploy
 * then heals the moment its server first runs (a dashboard page load is enough).
 *
 * Prefers the stable production domain (VERCEL_PROJECT_PRODUCTION_URL) so it stops
 * drifting once set; falls back to this deployment's own URL (VERCEL_URL) if the
 * stable one isn't serving. Only runs on Vercel's Node runtime, never locally.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.VERCEL !== '1') return;
  const token = process.env.TELEGRAM_TOKEN;
  if (!token) return;

  // A host "serves" if /api/telegram isn't a 404 — a GET returns 405 (POST-only),
  // which proves the route (and thus the app) is deployed there.
  const serves = async (host?: string): Promise<boolean> => {
    if (!host) return false;
    try {
      const r = await fetch(`https://${host}/api/telegram`, { method: 'GET' });
      return r.status !== 404;
    } catch { return false; }
  };

  let host: string | undefined;
  for (const cand of [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]) {
    if (await serves(cand)) { host = cand; break; }
  }
  if (!host) return;
  const url = `https://${host}/api/telegram`;

  try {
    const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json());
    if (info?.result?.url === url) return; // already correct — don't spam setWebhook
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url,
        // my_chat_member is needed for auto-connect; the rest are the flows.
        allowed_updates: ['message', 'edited_message', 'callback_query', 'my_chat_member'],
      }),
    }).then((r) => r.json());
    console.log('[webhook] re-pointed to', url, '→', res?.ok ? 'ok' : res?.description);
  } catch (e) {
    console.error('[webhook] self-heal failed', e);
  }
}
