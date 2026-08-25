import {
  Client, GatewayIntentBits, Events, MessageFlags,
  ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  ButtonBuilder, ButtonStyle,
  type ChatInputCommandInteraction, type StringSelectMenuInteraction, type ModalSubmitInteraction,
  type ButtonInteraction, type Message,
} from 'discord.js';
import {
  loadRootEnv, accountForChat, redeemConnectCode, redeemLinkCode, isAccountAdmin,
  withAccount, isServiceable, type Account,
} from '@loady/core';
import { money, resolvePlayer, platformsFor, methodsFor } from './ui';
import { registerCommands } from './register-commands';

loadRootEnv();
const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error('DISCORD_TOKEN is not set');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const EPH = MessageFlags.Ephemeral;
const err = (e: unknown) => ((e as { message?: string })?.message ?? String(e)).replace(/^error:\s*/i, '');

// ── Slash commands ────────────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isChatInputCommand()) {
      if (i.commandName === 'connect') return void await cmdConnect(i);
      if (i.commandName === 'link') return void await cmdLink(i);
      const account = await club(i);
      if (!account) return;
      if (i.commandName === 'deposit') return void await startDeposit(i, account);
      if (i.commandName === 'withdraw') return void await startWithdraw(i, account);
    } else if (i.isStringSelectMenu()) {
      await onSelect(i);
    } else if (i.isModalSubmit()) {
      await onModal(i);
    } else if (i.isButton()) {
      await onButton(i);
    }
  } catch (e) {
    console.error('[discord] interaction error', e);
    if (i.isRepliable() && !i.replied && !i.deferred) i.reply({ content: `❌ ${err(e)}`, flags: EPH }).catch(() => {});
  }
});

async function club(i: ChatInputCommandInteraction): Promise<Account | null> {
  const account = i.guildId ? await accountForChat('discord', i.guildId) : null;
  if (!account) { await i.reply({ content: 'This server isn’t connected to a club yet. An admin can run `/connect`.', flags: EPH }); return null; }
  if (!isServiceable(account.status)) { await i.reply({ content: 'This club is paused right now.', flags: EPH }); return null; }
  return account;
}

async function cmdConnect(i: ChatInputCommandInteraction) {
  const code = i.options.getString('code', true).toUpperCase();
  const r = await redeemConnectCode(code, 'discord', i.guildId!, i.guild?.name ?? null);
  await i.reply({ content: r.ok ? '✅ Connected! This server is now linked to your club on Loady.' : `❌ ${r.error}`, flags: EPH });
}
async function cmdLink(i: ChatInputCommandInteraction) {
  const code = i.options.getString('code', true).toUpperCase();
  const r = await redeemLinkCode(code, 'discord', i.user.id);
  await i.reply({ content: r.ok ? `✅ Linked! You can verify payments for **${r.accountName}**.` : `❌ ${r.error}`, flags: EPH });
}

// ── Deposit: platform → method → amount modal ────────────────────────────────
async function startDeposit(i: ChatInputCommandInteraction, account: Account) {
  const platforms = await platformsFor(account.id);
  if (platforms.length === 0) return i.reply({ content: 'No platforms are set up yet — ask an admin.', flags: EPH });
  if (platforms.length === 1) return sendMethods(i, account, platforms[0]!.id, 'd', false);
  const menu = new StringSelectMenuBuilder().setCustomId('dp').setPlaceholder('Choose account').addOptions(platforms.map((p) => ({ label: p.name, value: p.id })));
  return i.reply({ content: 'Which account are you adding to?', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], flags: EPH });
}
async function startWithdraw(i: ChatInputCommandInteraction, account: Account) {
  const platforms = await platformsFor(account.id);
  if (platforms.length === 0) return i.reply({ content: 'No platforms are set up yet — ask an admin.', flags: EPH });
  if (platforms.length === 1) return sendMethods(i, account, platforms[0]!.id, 'w', false);
  const menu = new StringSelectMenuBuilder().setCustomId('wp').setPlaceholder('Choose account').addOptions(platforms.map((p) => ({ label: p.name, value: p.id })));
  return i.reply({ content: 'Which account are you cashing out from?', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], flags: EPH });
}

async function sendMethods(i: ChatInputCommandInteraction | StringSelectMenuInteraction, account: Account, platformId: string, kind: 'd' | 'w', isUpdate: boolean) {
  const methods = await methodsFor(account.id, kind === 'w');
  if (methods.length === 0) {
    const body = { content: 'No payment methods are set up yet — ask an admin.', components: [] as never[] };
    return isUpdate ? (i as StringSelectMenuInteraction).update(body) : i.reply({ ...body, flags: EPH });
  }
  const menu = new StringSelectMenuBuilder().setCustomId(`${kind}m|${platformId}`)
    .setPlaceholder(kind === 'd' ? 'How would you like to pay?' : 'How would you like to get paid?')
    .addOptions(methods.map((m) => ({ label: m.name, value: m.id })));
  const body = { content: kind === 'd' ? 'How would you like to pay?' : 'How would you like to get paid?', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] };
  return isUpdate ? (i as StringSelectMenuInteraction).update(body) : i.reply({ ...body, flags: EPH });
}

async function onSelect(i: StringSelectMenuInteraction) {
  const account = i.guildId ? await accountForChat('discord', i.guildId) : null;
  if (!account) return i.update({ content: 'This server isn’t connected.', components: [] });
  const value = i.values[0]!;

  if (i.customId === 'dp') return sendMethods(i, account, value, 'd', true);
  if (i.customId === 'wp') return sendMethods(i, account, value, 'w', true);

  const [kind, platformId] = i.customId.split('|');    // 'dm'|'wm'
  if (kind === 'dm') return i.showModal(amountModal(`da|${platformId}|${value}`, 'How much to add?'));
  if (kind === 'wm') return i.showModal(withdrawModal(`wa|${platformId}|${value}`));
}

function amountModal(id: string, title: string) {
  return new ModalBuilder().setCustomId(id).setTitle(title).addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('amount').setLabel('Amount (e.g. 50)').setStyle(TextInputStyle.Short).setRequired(true)));
}
function withdrawModal(id: string) {
  return new ModalBuilder().setCustomId(id).setTitle('Cash out').addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('amount').setLabel('Amount (e.g. 50)').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('handle').setLabel('Where to send it (your payout handle)').setStyle(TextInputStyle.Short).setRequired(true)));
}

async function onModal(i: ModalSubmitInteraction) {
  const account = i.guildId ? await accountForChat('discord', i.guildId) : null;
  if (!account) return i.reply({ content: 'This server isn’t connected.', flags: EPH });
  const [kind, platformId, methodId] = i.customId.split('|');
  const amount = Math.round(parseFloat(i.fields.getTextInputValue('amount').replace(/[$,\s]/g, '')) * 100);
  if (!Number.isFinite(amount) || amount <= 0) return i.reply({ content: 'That doesn’t look like an amount.', flags: EPH });
  const player = await resolvePlayer(account.id, i.user.id, i.user.username, i.channelId ?? '');

  try {
    if (kind === 'da') {
      const info = await withAccount(account.id, async (sql) => {
        const [d] = await sql<{ id: string }[]>`select id from deposit_create(${player.id}, ${platformId!}, ${methodId!}, ${amount})`;
        const [f] = await sql<{ id: string; payout_handle: string | null; club_handle: string | null }[]>`
          select f.id, f.payout_handle, pm.club_handle from fills f join payment_methods pm on pm.id = f.method_id
           where f.deposit_id = ${d!.id} order by seq limit 1`;
        return f!;
      });
      const handle = info.payout_handle ?? info.club_handle;
      return i.reply({ content: `💸 **Send ${money(amount)} now.**\n${handle ? `Pay to: \`${handle}\`\n` : 'An admin will send you where to pay shortly.\n'}\nThen **post a screenshot in this channel** so we can confirm it.`, flags: EPH });
    }
    if (kind === 'wa') {
      const handle = i.fields.getTextInputValue('handle').trim();
      const [w] = await withAccount(account.id, (sql) => sql<{ amount: number }[]>`select amount from withdraw_create(${player.id}, ${platformId!}, ${methodId!}, ${amount}, ${handle})`);
      return i.reply({ content: `✅ **Cash-out for ${money(w!.amount)} is in the queue.** We’ll pay \`${handle}\` and message you when it’s done.`, flags: EPH });
    }
  } catch (e) {
    return i.reply({ content: `❌ ${err(e)}`, flags: EPH });
  }
}

// ── Screenshot in a channel → submit proof + post admin Verify card ──────────
client.on(Events.MessageCreate, async (msg: Message) => {
  if (msg.author.bot || !msg.guildId) return;
  const m = msg.content.trim().match(/^\/?connect\s+([A-Za-z0-9-]+)/i);
  if (m) { const r = await redeemConnectCode(m[1]!.toUpperCase(), 'discord', msg.guildId, msg.guild?.name ?? null); await msg.reply(r.ok ? '✅ Connected!' : `❌ ${r.error}`); return; }

  const account = await accountForChat('discord', msg.guildId);
  if (!account || !isServiceable(account.status)) return;
  const hasImage = msg.attachments.some((a) => (a.contentType ?? '').startsWith('image') || /\.(png|jpe?g|webp)$/i.test(a.name ?? ''));
  if (!hasImage) return;

  const info = await withAccount(account.id, async (sql) => {
    const [f] = await sql<{ id: string; amount: number; name: string | null }[]>`
      select f.id, f.amount, dp.display_name as name from fills f
        join deposit_requests d on d.id = f.deposit_id join players dp on dp.id = d.player_id
       where dp.discord_user_id = ${msg.author.id} and f.status = 'locked' order by f.created_at desc limit 1`;
    if (!f) return null;
    await sql`select fill_submit_proof(${f.id}, null, null)`;
    return f;
  });
  if (!info) return;

  await msg.reply('✅ Got your screenshot! We’ll check it and add your money shortly.');
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`v|${info.id}`).setLabel('Verify & credit').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`x|${info.id}`).setLabel('Discard').setStyle(ButtonStyle.Secondary));
  if (msg.channel.isSendable()) {
    await msg.channel.send({ content: `🧾 **Deposit to verify** — ${money(info.amount)} from ${info.name ?? 'a player'}. Check it landed, then Verify.`, components: [row] }).catch(() => {});
  }
});

// ── Admin verify / discard ───────────────────────────────────────────────────
async function onButton(i: ButtonInteraction) {
  const account = i.guildId ? await accountForChat('discord', i.guildId) : null;
  if (!account || !(await isAccountAdmin(account.id, 'discord', i.user.id))) return i.reply({ content: 'Admins only.', flags: EPH });
  const [kind, fillId] = i.customId.split('|');
  if (kind === 'v') {
    try {
      await withAccount(account.id, (sql) => sql`select fill_release(${fillId!}, null, 'verified in discord')`);
      await i.update({ content: `✅ Verified & credited by ${i.user.username}.`, components: [] });
    } catch (e) { await i.reply({ content: `❌ ${err(e)}`, flags: EPH }); }
  } else if (kind === 'x') {
    await withAccount(account.id, (sql) => sql`update fills set status = 'discarded' where id = ${fillId!} and status = 'awaiting_confirmation'`);
    await i.update({ content: '🗑 Discarded.', components: [] });
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`[discord] Loady bot ready as ${c.user.tag}`);
  try { await registerCommands(); } catch (e) { console.error('[discord] command registration failed:', e); }
});
client.login(token);
