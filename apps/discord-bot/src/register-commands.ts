import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { pathToFileURL } from 'node:url';
import { loadRootEnv } from '@loady/core';

const plain = (name: string, desc: string) => new SlashCommandBuilder().setName(name).setDescription(desc);

// Player + admin commands to match the poker Discord bot, plus Loady's onboarding
// commands (connect/link/receipt) that its multi-tenant / serverless model needs.
export const COMMANDS = [
  plain('deposit', 'Add money to your account'),
  plain('canceldeposit', 'Cancel your latest unpaid deposit'),
  plain('withdraw', 'Cash out'),
  plain('cancelwithdraw', 'Cancel a cash-out that has not been paid'),
  plain('addtowithdraw', 'Add more to a cash-out already in the queue'),
  plain('pending', 'Your pending cash-outs'),
  plain('withdrawalhistory', 'Cash-outs paid to you'),
  plain('deposithistory', 'Deposits you made'),
  plain('editplatform', 'Add or remove ClubGG / Sportsbook'),
  plain('editclubs', 'Change which clubs you play in'),
  plain('editdeposit', 'Change how you deposit'),
  plain('editwithdraw', 'Change how you get paid'),
  plain('support', 'Message our team'),
  plain('guide', 'What each command does'),
  plain('ping', 'Health check'),
  new SlashCommandBuilder().setName('receipt').setDescription('Send the screenshot for your pending deposit')
    .addAttachmentOption((o) => o.setName('screenshot').setDescription('Your payment screenshot').setRequired(true)),
  new SlashCommandBuilder().setName('link').setDescription('Link yourself as an admin (code from your dashboard)')
    .addStringOption((o) => o.setName('code').setDescription('The link code from your Team page').setRequired(true)),
  new SlashCommandBuilder().setName('connect').setDescription('(admin) Connect this server to your club')
    .addStringOption((o) => o.setName('code').setDescription('The connect code from your dashboard').setRequired(true)),
  plain('pausewithdraw', "(admin) Pause a player's cash-out"),
  plain('resumewithdraw', "(admin) Resume a player's cash-out"),
  plain('totals', '(admin) Deposited & cashed-out totals per platform'),
  new SlashCommandBuilder().setName('adjust').setDescription('(admin) +amount grows a cash-out; -amount records a payment you made')
    .addNumberOption((o) => o.setName('amount').setDescription('Dollars — e.g. 50 to grow, -50 to record a payment').setRequired(true)),
].map((c) => c.toJSON());

/** The one shared bot serves every club, so commands are GLOBAL. Set
 *  DISCORD_GUILD_ID for instant registration on a single test server. */
export async function registerCommands(): Promise<void> {
  const token = process.env.DISCORD_TOKEN, appId = process.env.DISCORD_APP_ID;
  if (!token || !appId) throw new Error('DISCORD_TOKEN / DISCORD_APP_ID not set');
  const rest = new REST({ version: '10' }).setToken(token);
  const guildId = process.env.DISCORD_GUILD_ID;
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: COMMANDS });
    await rest.put(Routes.applicationCommands(appId), { body: [] }).catch(() => {});
    console.log(`[discord] registered ${COMMANDS.length} guild commands`);
  } else {
    await rest.put(Routes.applicationCommands(appId), { body: COMMANDS });
    console.log(`[discord] registered ${COMMANDS.length} global commands`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadRootEnv();
  registerCommands().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
