import { db } from '@loady/core';
import { getCtx } from '@/lib/session';
import { redirect } from 'next/navigation';
import { ConnectPanel } from './panel';
import { disconnectChat } from './actions';

export const dynamic = 'force-dynamic';

interface Chat { id: string; platform: string; chat_id: string; title: string | null; kind: string; created_at: Date; }

export default async function Connect() {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');

  const chats = await db()<Chat[]>`
    select id, platform, chat_id, title, kind, created_at
      from chat_bindings where account_id = ${ctx.accountId} order by created_at desc`;

  const clientId = process.env.DISCORD_CLIENT_ID;
  const discordInvite = clientId
    ? `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands&permissions=277025770560`
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 860 }}>
      <header>
        <h1 style={{ fontSize: 28 }}>Connect chats</h1>
        <p className="dim" style={{ marginTop: 6 }}>Add Loady where your players are. Each chat binds to your club — nobody else can claim it.</p>
      </header>

      <ConnectPanel discordInvite={discordInvite} />

      <div>
        <h3 style={{ marginBottom: 12 }}>Connected chats</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Chat</th><th>Platform</th><th>Connected</th><th style={{ width: 110 }} /></tr></thead>
            <tbody>
              {chats.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No chats connected yet — add one above.</td></tr>
              ) : chats.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.title ?? 'Untitled chat'}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{c.chat_id}</div>
                  </td>
                  <td><span className="badge muted" style={{ textTransform: 'capitalize' }}>{c.platform}</span></td>
                  <td className="dim" style={{ fontSize: 13 }}>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td>
                    <form action={disconnectChat}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn btn-ghost btn-sm" type="submit">Disconnect</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
