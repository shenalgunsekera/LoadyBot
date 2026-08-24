import { Client, GatewayIntentBits, Events } from 'discord.js';
import {
  accountForChat, redeemConnectCode, withAccount, isServiceable, db,
} from '@loady/core';

/**
 * The ONE shared Loady Discord bot. It lives in every account's server via the
 * dashboard's one-click "Add to Server" (OAuth2). A message is routed to its
 * account by the guild it came from; data access is sealed with withAccount().
 */
const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error('DISCORD_TOKEN is not set');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// ── Auto-bind on join. The OAuth "Add to Server" URL carries state=<code> tied
//    to the account; we stash the code as the guild's pending bind and confirm.
//    (For the code path, an admin runs /connect in the server instead.) ────────
client.on(Events.GuildCreate, async (guild) => {
  // TODO(oauth): look up the pending connect code for this install (set when the
  // owner clicked "Add to Server" in the dashboard) and redeem it here:
  //   await redeemConnectCode(pendingCode, 'discord', guild.id, guild.name);
  console.log(`[discord] joined guild ${guild.name} (${guild.id}) — awaiting bind`);
});

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot || !msg.guildId) return;

  // /connect fallback: "connect LOADY-XXXX" typed by an admin in the server.
  const m = msg.content.trim().match(/^\/?connect\s+([A-Za-z0-9-]+)/i);
  if (m) {
    const r = await redeemConnectCode(m[1]!.toUpperCase(), 'discord', msg.guildId, msg.guild?.name ?? null);
    await msg.reply(r.ok ? '✅ Connected! This server is now linked to your club on Loady.' : `❌ ${r.error}`);
    return;
  }

  const account = await accountForChat('discord', msg.guildId);
  if (!account) return;                       // server not connected yet
  if (!isServiceable(account.status)) {
    if (msg.content.startsWith('/')) await msg.reply('This club is paused — an owner needs to sort out billing on Loady.');
    return;
  }

  // Example tenant-scoped command, sealed to this account.
  if (msg.content.trim() === '/players') {
    const rows = await withAccount(account.id, (sql) =>
      sql<{ n: number }[]>`select count(*)::int as n from players`);
    await msg.reply(`👥 ${rows[0]!.n} players in ${account.name}.`);
  }
  // TODO(engine): port the deposit/withdraw/receipt flows, each via withAccount().
});

client.once(Events.ClientReady, (c) => console.log(`[discord] Loady bot ready as ${c.user.tag}`));
void db(); // fail fast if DATABASE_URL is missing
client.login(token);
