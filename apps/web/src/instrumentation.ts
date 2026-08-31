/**
 * Self-healing Telegram webhook — opt-in and non-blocking.
 * ════════════════════════════════════════════════════════
 * Set WEBHOOK_HOST in Vercel (Production) to your stable public domain, e.g.
 *   WEBHOOK_HOST=web-eta-eosin-u0h9aq2htn.vercel.app
 * and every deploy keeps the Telegram webhook pinned there. If WEBHOOK_HOST is
 * not set, this does NOTHING — it will never touch (or break) an existing
 * webhook. It only ever calls api.telegram.org, never this deployment's own
 * routes, and runs fire-and-forget so it can never block server startup.
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.VERCEL !== '1') return;
  const token = process.env.TELEGRAM_TOKEN;
  // Only act on an explicit host, so we can never re-point the webhook at a
  // protected per-deploy URL or a domain that isn't serving.
  const host = (process.env.WEBHOOK_HOST ?? '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
  if (!token || !host) return;
  const url = `https://${host}/api/telegram`;

  // Fire-and-forget: register() returns immediately; the webhook check runs in the
  // background and only hits api.telegram.org.
  void (async () => {
    try {
      const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json());
      if (info?.result?.url === url) return; // already correct
      const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url,
          allowed_updates: ['message', 'edited_message', 'callback_query', 'my_chat_member'],
        }),
      }).then((r) => r.json());
      console.log('[webhook] re-pointed to', url, '→', res?.ok ? 'ok' : res?.description);
    } catch (e) {
      console.error('[webhook] self-heal failed', e);
    }
  })();
}
