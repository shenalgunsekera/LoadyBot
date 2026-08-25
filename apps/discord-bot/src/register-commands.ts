import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { pathToFileURL } from 'node:url';
import { loadRootEnv } from '@loady/core';

export const COMMANDS = [
  new SlashCommandBuilder().setName('deposit').setDescription('Add funds to your account'),
  new SlashCommandBuilder().setName('withdraw').setDescription('Cash out'),
  new SlashCommandBuilder().setName('link').setDescription('Link yourself as an admin (code from your dashboard)')
    .addStringOption((o) => o.setName('code').setDescription('The link code from your Team page').setRequired(true)),
  new SlashCommandBuilder().setName('connect').setDescription('(admin) Connect this server to your club')
    .addStringOption((o) => o.setName('code').setDescription('The connect code from your dashboard').setRequired(true)),
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
