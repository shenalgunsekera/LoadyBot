import nacl from 'tweetnacl';
import { accountForChat, redeemConnectCode, redeemLinkCode, isAccountAdmin, withAccount, isServiceable, storageConfigured, uploadReceipt } from '@loady/core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const EPH = 64;
const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });
const reply = (content: string, opts: { ephemeral?: boolean; components?: unknown[] } = {}) =>
  json({ type: 4, data: { content, flags: opts.ephemeral ? EPH : 0, components: opts.components ?? [] } });
const update = (content: string, components: unknown[] = []) => json({ type: 7, data: { content, components } });
const row = (c: unknown) => ({ type: 1, components: [c] });
const select = (id: string, placeholder: string, options: { label: string; value: string }[]) => row({ type: 3, custom_id: id, placeholder, options });
const button = (id: string, label: string, style: number) => ({ type: 2, custom_id: id, label, style });
const textInput = (id: string, label: string) => row({ type: 4, custom_id: id, label, style: 1, required: true });
const modal = (id: string, title: string, inputs: unknown[]) => json({ type: 9, data: { custom_id: id, title, components: inputs } });

const acctFor = (guildId: string | undefined) => (guildId ? accountForChat('discord', guildId) : Promise.resolve(null));
const err = (e: unknown) => ((e as { message?: string })?.message ?? String(e)).replace(/^error:\s*/i, '');
const touchPlayer = (accountId: string, userId: string, username: string, channelId: string) =>
  withAccount(accountId, async (sql) => (await sql<{ id: string }[]>`select id from player_touch_dc(${userId}, ${username}, ${channelId})`)[0]!);

const GUIDE = [
  '**Loady — how it works**',
  '`/deposit` — add money · `/withdraw` — cash out',
  '`/receipt` — send your payment screenshot',
  '`/canceldeposit` · `/cancelwithdraw` — cancel unpaid ones',
  '`/pending` — your pending cash-outs',
  '`/deposithistory` · `/withdrawalhistory` — your activity',
  '`/support` — message the team',
].join('\n');
const SOON = ['support', 'pausewithdraw', 'resumewithdraw'];
const methodList = (accountId: string, payout: boolean) =>
  withAccount(accountId, (sql) => payout
    ? sql<{ name: string }[]>`select name from payment_methods where enabled and payout_enabled order by sort_order, name`
    : sql<{ name: string }[]>`select name from payment_methods where enabled order by sort_order, name`);

async function postChannel(channelId: string, payload: unknown) {
  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST', headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export async function POST(req: Request): Promise<Response> {
  const sig = req.headers.get('x-signature-ed25519');
  const ts = req.headers.get('x-signature-timestamp');
  const body = await req.text();
  const key = process.env.DISCORD_PUBLIC_KEY;
  if (!sig || !ts || !key || !nacl.sign.detached.verify(Buffer.from(ts + body), Buffer.from(sig, 'hex'), Buffer.from(key, 'hex'))) {
    return new Response('bad signature', { status: 401 });
  }
  const i = JSON.parse(body);
  if (i.type === 1) return json({ type: 1 });               // PING → PONG

  const guildId: string | undefined = i.guild_id;
  const userId: string = i.member?.user?.id ?? i.user?.id;
  const username: string = i.member?.user?.username ?? i.user?.username ?? 'player';

  try {
    // ── Slash commands ──
    if (i.type === 2) {
      const name: string = i.data.name;
      if (name === 'connect') {
        const code = String(i.data.options?.[0]?.value ?? '').toUpperCase();
        const r = await redeemConnectCode(code, 'discord', guildId!, null);
        return reply(r.ok ? '✅ Connected! This server is now linked to your club on Loady.' : `❌ ${r.error}`, { ephemeral: true });
      }
      if (name === 'link') {
        const code = String(i.data.options?.[0]?.value ?? '').toUpperCase();
        const r = await redeemLinkCode(code, 'discord', userId);
        return reply(r.ok ? `✅ Linked! You can verify payments for **${r.accountName}**.` : `❌ ${r.error}`, { ephemeral: true });
      }
      const account = await acctFor(guildId);
      if (!account) return reply('This server isn’t connected to a club yet. An admin can run `/connect`.', { ephemeral: true });
      if (!isServiceable(account.status)) return reply('This club is paused right now.', { ephemeral: true });

      if (name === 'deposit' || name === 'withdraw') {
        const payout = name === 'withdraw';
        const platforms = await withAccount(account.id, (sql) => sql<{ id: string; name: string }[]>`select id, name from platforms where enabled order by sort_order, name`);
        if (platforms.length === 0) return reply('No platforms are set up yet — ask an admin.', { ephemeral: true });
        const prefix = payout ? 'w' : 'd';
        if (platforms.length === 1) {
          const methods = await withAccount(account.id, (sql) => payout
            ? sql<{ id: string; name: string }[]>`select id, name from payment_methods where enabled and payout_enabled order by sort_order, name`
            : sql<{ id: string; name: string }[]>`select id, name from payment_methods where enabled order by sort_order, name`);
          if (methods.length === 0) return reply('No methods set up yet — ask an admin.', { ephemeral: true });
          return reply(payout ? 'How would you like to get paid?' : 'How would you like to pay?', {
            ephemeral: true, components: [select(`${prefix}m|${platforms[0]!.id}`, 'Choose a method', methods.map((m) => ({ label: m.name, value: m.id })))],
          });
        }
        return reply('Which account?', { ephemeral: true, components: [select(`${prefix}p`, 'Choose account', platforms.map((p) => ({ label: p.name, value: p.id })))] });
      }

      if (name === 'receipt') {
        const attId: string | undefined = i.data.options?.find((o: { name: string }) => o.name === 'screenshot')?.value;
        const att = attId ? i.data.resolved?.attachments?.[attId] : null;
        if (!att) return reply('Attach your payment screenshot: `/receipt screenshot:<image>`.', { ephemeral: true });
        const info = await withAccount(account.id, async (sql) => {
          const [f] = await sql<{ id: string; amount: number; name: string | null }[]>`
            select f.id, f.amount, dp.display_name as name from fills f
              join deposit_requests d on d.id = f.deposit_id join players dp on dp.id = d.player_id
             where dp.discord_user_id = ${userId} and f.status = 'locked' order by f.created_at desc limit 1`;
          if (!f) return null;
          await sql`select fill_submit_proof(${f.id}, null, null)`;
          return f;
        });
        if (!info) return reply('You don’t have a deposit waiting for a screenshot. Start one with `/deposit`.', { ephemeral: true });
        try {
          if (storageConfigured()) {
            const bytes = new Uint8Array(await (await fetch(att.url)).arrayBuffer());
            const ct = att.content_type ?? 'image/jpeg';
            const path = await uploadReceipt(account.id, info.id, bytes, ct);
            if (path) await withAccount(account.id, (sql) => sql`select receipt_add(${info.id}, ${path}, ${ct})`);
          }
        } catch (e) { console.error('[receipt store]', e); }
        await postChannel(i.channel_id, {
          content: `🧾 **Deposit to verify** — ${money(info.amount)} from ${info.name ?? username}. Check it landed, then Verify.\n${att.url}`,
          components: [row(button(`v|${info.id}`, 'Verify & credit', 3))],
        });
        return reply('✅ Got your screenshot! We’ll check it and add your money shortly.', { ephemeral: true });
      }

      if (name === 'ping') return reply('🏓 pong', { ephemeral: true });
      if (name === 'guide') return reply(GUIDE, { ephemeral: true });
      if (name === 'editplatform') {
        const platforms = await withAccount(account.id, (sql) => sql<{ id: string; name: string }[]>`select id, name from platforms where enabled order by sort_order, name`);
        if (platforms.length === 0) return reply('No platforms are set up yet — ask an admin.', { ephemeral: true });
        return reply('Which game account do you want to link?', { ephemeral: true, components: [select('ep', 'Choose platform', platforms.map((p) => ({ label: p.name, value: p.id })))] });
      }
      if (name === 'editclubs') {
        const p = await touchPlayer(account.id, userId, username, i.channel_id);
        const data = await withAccount(account.id, async (sql) => ({
          clubs: await sql<{ id: string; name: string }[]>`select id, name from clubs order by name`,
          linked: await sql<{ platform_id: string; name: string }[]>`select pp.platform_id, pf.name from player_platforms pp join platforms pf on pf.id = pp.platform_id where pp.player_id = ${p.id}`,
        }));
        if (data.clubs.length === 0) return reply('No clubs are set up yet — ask an admin.', { ephemeral: true });
        if (data.linked.length === 0) return reply('Link your game account first with `/editplatform`.', { ephemeral: true });
        if (data.linked.length === 1) return reply('Pick your club:', { ephemeral: true, components: [select(`ecc|${data.linked[0]!.platform_id}`, 'Choose club', data.clubs.map((c) => ({ label: c.name, value: c.id })))] });
        return reply('Which account?', { ephemeral: true, components: [select('ec', 'Choose platform', data.linked.map((l) => ({ label: l.name, value: l.platform_id })))] });
      }
      if (name === 'editdeposit') {
        const ms = await methodList(account.id, false);
        return reply(`💸 **You can deposit with:**\n${ms.map((m) => '• ' + m.name).join('\n') || '—'}\nStart anytime with \`/deposit\`.`, { ephemeral: true });
      }
      if (name === 'editwithdraw') {
        const ms = await methodList(account.id, true);
        return reply(`💵 **You can get paid with:**\n${ms.map((m) => '• ' + m.name).join('\n') || '—'}\nWe’ll ask where to send it when you \`/withdraw\`.`, { ephemeral: true });
      }
      if (name === 'addtowithdraw') {
        const p = await touchPlayer(account.id, userId, username, i.channel_id);
        const [w] = await withAccount(account.id, (sql) => sql<{ amount: number; payout_handle: string | null }[]>`
          select amount, payout_handle from withdraw_requests where player_id = ${p.id} and status in ('queued','partially_filled','paused') order by created_at desc limit 1`);
        if (!w) return reply('You have no cash-out in the queue to add to. Start one with /withdraw.', { ephemeral: true });
        return modal('atw', `Add to your ${money(w.amount)} cash-out`, [textInput('amount', 'How much to add (e.g. 25)')]);
      }
      if (SOON.includes(name)) return reply('That feature is coming soon.', { ephemeral: true });

      if (name === 'canceldeposit') {
        const p = await touchPlayer(account.id, userId, username, i.channel_id);
        const [d] = await withAccount(account.id, (sql) => sql<{ id: string }[]>`select id from deposit_cancel(${p.id})`);
        return reply(d ? '✅ Your deposit was cancelled.' : 'You don’t have an unpaid deposit to cancel.', { ephemeral: true });
      }
      if (name === 'cancelwithdraw') {
        const p = await touchPlayer(account.id, userId, username, i.channel_id);
        const done = await withAccount(account.id, async (sql) => {
          const [w] = await sql<{ id: string }[]>`select id from withdraw_requests where player_id = ${p.id} and status in ('queued','partially_filled') order by created_at desc limit 1`;
          if (!w) return false; await sql`select withdraw_cancel(${w.id})`; return true;
        });
        return reply(done ? '✅ Your cash-out was cancelled and the funds returned.' : 'You don’t have a cash-out waiting to cancel.', { ephemeral: true });
      }
      if (name === 'pending') {
        const p = await touchPlayer(account.id, userId, username, i.channel_id);
        const rows = await withAccount(account.id, (sql) => sql<{ amount: number; amount_remaining: number; payout_handle: string | null }[]>`
          select amount, amount_remaining, payout_handle from withdraw_requests where player_id = ${p.id} and status in ('queued','partially_filled') order by created_at`);
        return reply(rows.length === 0 ? 'You have no pending cash-outs.' : `⏳ **Your pending cash-outs:**\n${rows.map((r) => `• ${money(r.amount)} — ${money(r.amount_remaining)} owed → \`${r.payout_handle}\``).join('\n')}`, { ephemeral: true });
      }
      if (name === 'deposithistory' || name === 'withdrawalhistory') {
        const dep = name === 'deposithistory';
        const p = await touchPlayer(account.id, userId, username, i.channel_id);
        const rows = await withAccount(account.id, (sql) => dep
          ? sql<{ amount: number; status: string }[]>`select amount, status from deposit_requests where player_id = ${p.id} order by created_at desc limit 10`
          : sql<{ amount: number; status: string }[]>`select amount, status from withdraw_requests where player_id = ${p.id} order by created_at desc limit 10`);
        return reply(rows.length === 0 ? `No ${dep ? 'deposits' : 'cash-outs'} yet.` : `**Your ${dep ? 'deposits' : 'cash-outs'}:**\n${rows.map((r) => `• ${money(r.amount)} — ${r.status.replace(/_/g, ' ')}`).join('\n')}`, { ephemeral: true });
      }
    }

    // ── Select menus & buttons ──
    if (i.type === 3) {
      const account = await acctFor(guildId);
      if (!account) return update('This server isn’t connected.');
      const cid: string = i.data.custom_id;
      const value: string = i.data.values?.[0];

      if (cid === 'ep') return modal(`epm|${value}`, 'Link account', [textInput('uid', 'Your username / ID on that platform')]);
      if (cid === 'ec') {
        const clubs = await withAccount(account.id, (sql) => sql<{ id: string; name: string }[]>`select id, name from clubs order by name`);
        return update('Pick your club:', [select(`ecc|${value}`, 'Choose club', clubs.map((c) => ({ label: c.name, value: c.id })))]);
      }
      if (cid.startsWith('ecc|')) {
        const platformId = cid.split('|')[1]!;
        const p = await touchPlayer(account.id, userId, username, i.channel_id);
        await withAccount(account.id, (sql) => sql`select player_set_club(${p.id}, ${platformId}, ${value})`);
        return update('✅ Club saved.');
      }
      if (cid === 'dp' || cid === 'wp') {
        const payout = cid === 'wp';
        const methods = await withAccount(account.id, (sql) => payout
          ? sql<{ id: string; name: string }[]>`select id, name from payment_methods where enabled and payout_enabled order by sort_order, name`
          : sql<{ id: string; name: string }[]>`select id, name from payment_methods where enabled order by sort_order, name`);
        return update(payout ? 'How would you like to get paid?' : 'How would you like to pay?', [select(`${payout ? 'w' : 'd'}m|${value}`, 'Choose a method', methods.map((m) => ({ label: m.name, value: m.id })))]);
      }
      const [k, platformId] = cid.split('|');
      if (k === 'dm') return modal(`da|${platformId}|${value}`, 'Add funds', [textInput('amount', 'Amount (e.g. 50)')]);
      if (k === 'wm') return modal(`wa|${platformId}|${value}`, 'Cash out', [textInput('amount', 'Amount (e.g. 50)'), textInput('handle', 'Where to send it (payout handle)')]);

      if (k === 'v' || k === 'x') {
        if (!(await isAccountAdmin(account.id, 'discord', userId))) return reply('Admins only.', { ephemeral: true });
        const fillId = platformId!;
        if (k === 'v') {
          await withAccount(account.id, (sql) => sql`select fill_release(${fillId}, null, 'verified in discord')`);
          return update(`✅ Verified & credited by ${username}.`);
        }
        await withAccount(account.id, (sql) => sql`update fills set status = 'discarded' where id = ${fillId} and status = 'awaiting_confirmation'`);
        return update('🗑 Discarded.');
      }
    }

    // ── Modal submit ──
    if (i.type === 5) {
      const account = await acctFor(guildId);
      if (!account) return reply('This server isn’t connected.', { ephemeral: true });
      const [k, platformId, methodId] = i.data.custom_id.split('|');
      const fields: Record<string, string> = {};
      for (const r of i.data.components) for (const c of r.components) fields[c.custom_id] = c.value;
      const player = await touchPlayer(account.id, userId, username, i.channel_id);

      if (k === 'epm') {
        const uid = String(fields.uid ?? '').trim();
        if (!uid) return reply('Enter your username / ID.', { ephemeral: true });
        await withAccount(account.id, (sql) => sql`select player_set_platform(${player.id}, ${platformId!}, ${uid})`);
        return reply('✅ Saved. You can /deposit or /withdraw now.', { ephemeral: true });
      }

      const amount = Math.round(parseFloat(String(fields.amount).replace(/[$,\s]/g, '')) * 100);
      if (!Number.isFinite(amount) || amount <= 0) return reply('That doesn’t look like an amount.', { ephemeral: true });

      if (k === 'da') {
        const info = await withAccount(account.id, async (sql) => {
          const [d] = await sql<{ id: string }[]>`select id from deposit_create(${player.id}, ${platformId!}, ${methodId!}, ${amount})`;
          const [f] = await sql<{ payout_handle: string | null; club_handle: string | null }[]>`
            select f.payout_handle, pm.club_handle from fills f join payment_methods pm on pm.id = f.method_id where f.deposit_id = ${d!.id} order by seq limit 1`;
          return f!;
        });
        const handle = info.payout_handle ?? info.club_handle;
        return reply(`💸 **Send ${money(amount)} now.**\n${handle ? `Pay to: \`${handle}\`\n` : 'An admin will tell you where to pay.\n'}\nThen run **/receipt** and attach your screenshot.`, { ephemeral: true });
      }
      if (k === 'wa') {
        const handle = String(fields.handle ?? '').trim();
        if (!handle) return reply('We need to know where to send your money.', { ephemeral: true });
        const [w] = await withAccount(account.id, (sql) => sql<{ amount: number }[]>`select amount from withdraw_create(${player.id}, ${platformId!}, ${methodId!}, ${amount}, ${handle})`);
        return reply(`✅ **Cash-out for ${money(w!.amount)} is in the queue.** We’ll pay \`${handle}\` and message you when it’s done.`, { ephemeral: true });
      }
      if (k === 'atw') {
        const [w] = await withAccount(account.id, async (sql) => {
          const [cur] = await sql<{ id: string }[]>`select id from withdraw_requests where player_id = ${player.id} and status in ('queued','partially_filled','paused') order by created_at desc limit 1`;
          if (!cur) return [undefined];
          return sql<{ amount: number; payout_handle: string | null }[]>`select amount, payout_handle from withdraw_topup(${cur.id}, ${amount})`;
        });
        if (!w) return reply('You have no cash-out in the queue to add to.', { ephemeral: true });
        return reply(`✅ **Added ${money(amount)}.** Your cash-out is now **${money(w.amount)}**${w.payout_handle ? ` → \`${w.payout_handle}\`` : ''} and still in the queue.`, { ephemeral: true });
      }
    }
  } catch (e) {
    return reply(`❌ ${err(e)}`, { ephemeral: true });
  }
  return json({ type: 4, data: { content: 'Unsupported.', flags: EPH } });
}
