import { withAccount } from './tenant';

/**
 * Send a player a message from a server action (deposit verified, cash-out paid…).
 * Loady's bots are serverless webhooks — they can't push on their own — so we call
 * the platform APIs directly with the player's saved chat. Best-effort: a failed
 * send never breaks the money action that triggered it.
 */
export async function notifyPlayer(accountId: string, playerId: string, text: string): Promise<void> {
  const [p] = await withAccount(accountId, (sql) => sql<{ tg_chat_id: string | null; dc_channel_id: string | null }[]>`
    select tg_chat_id, dc_channel_id from players where id = ${playerId}`);
  if (!p) return;
  const tgToken = process.env.TELEGRAM_TOKEN;
  const dcToken = process.env.DISCORD_TOKEN;
  try {
    if (p.tg_chat_id && tgToken) {
      await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: p.tg_chat_id, text, parse_mode: 'Markdown' }),
      }).catch(() => {});
    }
    if (p.dc_channel_id && dcToken) {
      await fetch(`https://discord.com/api/v10/channels/${p.dc_channel_id}/messages`, {
        method: 'POST', headers: { authorization: `Bot ${dcToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ content: text.replace(/\*/g, '**') }),
      }).catch(() => {});
    }
  } catch (e) { console.error('[notifyPlayer]', e); }
}
