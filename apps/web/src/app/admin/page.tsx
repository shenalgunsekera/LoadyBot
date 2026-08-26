import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@loady/core';
import { getOpCtx } from '@/lib/session';
import { toggleAction, togglePlatform } from './actions';

export const dynamic = 'force-dynamic';

interface Row {
  id: string; name: string; slug: string; status: string; created_at: Date; status_note: string | null;
  plan: string | null; members: number; chats: number; players: number;
  telegram_enabled: boolean; discord_enabled: boolean;
}

const BADGE: Record<string, string> = { active: 'ok', trialing: 'ok', past_due: 'warn', suspended: 'red', canceled: 'muted' };
const serviceable = (s: string) => s === 'active' || s === 'trialing';

export default async function AdminPage() {
  const op = await getOpCtx();
  if (!op) redirect('/admin/login');

  const rows = await db()<Row[]>`
    select a.id, a.name, a.slug, a.status, a.created_at, a.status_note, p.name as plan,
      a.telegram_enabled, a.discord_enabled,
      (select count(*) from account_members m where m.account_id = a.id)::int as members,
      (select count(*) from chat_bindings c where c.account_id = a.id)::int as chats,
      (select count(*) from players pl where pl.account_id = a.id)::int as players
    from accounts a
    left join packages p on p.id = a.package_id
    order by a.created_at desc`;

  const stats = {
    total: rows.length,
    live: rows.filter((r) => serviceable(r.status)).length,
    off: rows.filter((r) => r.status === 'suspended').length,
    players: rows.reduce((s, r) => s + r.players, 0),
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Ops top bar (dark, to distinguish from customer dashboards) */}
      <header style={{ background: 'var(--ink)', color: '#fff' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            <svg width="24" height="24" viewBox="0 0 26 26"><rect width="26" height="26" rx="8" fill="var(--accent)" /><path d="M8 7v9.5A2.5 2.5 0 0 0 10.5 19H18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
            Loady <span style={{ color: '#7d8ba0', fontWeight: 600 }}>Operations</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13.5 }}>
            <span style={{ color: '#aab6c8' }}>{op.email}</span>
            <Link href="/logout" style={{ color: '#fff', fontWeight: 600 }}>Sign out</Link>
          </div>
        </div>
      </header>

      <main className="container" style={{ padding: '28px 24px 64px' }}>
        <h1 style={{ fontSize: 26 }}>Customers</h1>
        <p className="dim" style={{ marginTop: 6, marginBottom: 22 }}>Every club on Loady. Switch bot access on or off in one click.</p>

        <div className="grid cols-4" style={{ marginBottom: 24 }}>
          {[['Clubs', stats.total], ['Live', stats.live], ['Switched off', stats.off], ['Players', stats.players]].map(([l, v]) => (
            <div className="card" key={l as string}><div className="stat-label">{l}</div><div className="stat-value">{v}</div></div>
          ))}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Club</th><th>Status</th><th>Plan</th><th style={{ textAlign: 'right' }}>Admins</th><th style={{ textAlign: 'right' }}>Chats</th><th style={{ textAlign: 'right' }}>Players</th><th>Bots</th><th>Joined</th><th style={{ width: 130 }} /></tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>No customers yet.</td></tr>
              ) : rows.map((r) => {
                const live = serviceable(r.status);
                return (
                  <tr key={r.id}>
                    <td><div style={{ fontWeight: 600 }}>{r.name}</div><div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{r.slug}</div></td>
                    <td><span className={`badge ${BADGE[r.status] ?? 'muted'}`}>{r.status}</span></td>
                    <td className="dim">{r.plan ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>{r.members}</td>
                    <td style={{ textAlign: 'right' }}>{r.chats}</td>
                    <td style={{ textAlign: 'right' }}>{r.players}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(['telegram', 'discord'] as const).map((pf) => {
                          const on = pf === 'telegram' ? r.telegram_enabled : r.discord_enabled;
                          return (
                            <form key={pf} action={togglePlatform} title={`${on ? 'Disable' : 'Enable'} ${pf} for ${r.name}`}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="platform" value={pf} />
                              <input type="hidden" name="enable" value={on ? '0' : '1'} />
                              <button type="submit" className={`badge ${on ? 'ok' : 'muted'}`} style={{ border: 'none', cursor: 'pointer' }}>
                                {pf === 'telegram' ? '📱 TG' : '💬 DC'} {on ? 'on' : 'off'}
                              </button>
                            </form>
                          );
                        })}
                      </div>
                    </td>
                    <td className="dim" style={{ fontSize: 13 }}>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td>
                      <form action={toggleAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="activate" value={live ? '0' : '1'} />
                        <button className={`btn btn-sm ${live ? 'btn-ghost' : 'btn-primary'}`} type="submit">
                          {live ? 'Deactivate' : 'Activate'}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
