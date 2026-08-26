import { withAccount } from '@loady/core';
import { getCtx } from '@/lib/session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Account { platform: string; uid: string; club: string | null; }
interface Row {
  id: string; display_name: string | null; username: string | null; status: string;
  flagged: boolean; created_at: Date; accounts: Account[];
  owed: number; deposited: number;
}

export default async function Players({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');
  const { q } = await searchParams;
  const term = (q ?? '').trim();

  const rows = await withAccount(ctx.accountId, (sql) => {
    const search = term
      ? sql`and (p.display_name ilike ${'%' + term + '%'} or p.username ilike ${'%' + term + '%'}
              or exists (select 1 from player_platforms x where x.player_id = p.id and x.platform_uid ilike ${'%' + term + '%'}))`
      : sql``;
    return sql<Row[]>`
      select p.id, p.display_name, p.username, p.status, p.flagged, p.created_at,
             coalesce((select jsonb_agg(jsonb_build_object('platform', pf.name, 'uid', pp.platform_uid, 'club', c.name) order by pf.sort_order)
                         from player_platforms pp join platforms pf on pf.id = pp.platform_id
                         left join clubs c on c.id = pp.club_id
                        where pp.player_id = p.id and pp.platform_uid is not null), '[]') as accounts,
             coalesce((select sum(w.amount_remaining) from withdraw_requests w where w.player_id = p.id and w.status in ('queued','partially_filled')), 0)::bigint as owed,
             coalesce((select sum(d.amount) from deposit_requests d where d.player_id = p.id and d.status = 'settled'), 0)::bigint as deposited
        from players p
       where true ${search}
       order by p.created_at desc limit 200`;
  });

  const money = (c: number) => `$${(Number(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28 }}>Players</h1>
          <p className="dim" style={{ marginTop: 6 }}>Everyone in your club, their game accounts, and what they're owed.</p>
        </div>
        <form style={{ display: 'flex', gap: 8 }}>
          <input name="q" defaultValue={term} placeholder="Search name or ID…" style={{ width: 220, height: 38 }} />
          <button className="btn btn-dark btn-sm" type="submit">Search</button>
        </form>
      </header>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Player</th><th>Game accounts</th><th className="num" style={{ textAlign: 'right' }}>Deposited</th><th className="num" style={{ textAlign: 'right' }}>Owed</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>{term ? 'No players match that search.' : 'No players yet.'}</td></tr>
            ) : rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.display_name ?? p.username ?? '—'}</div>
                  {p.username && p.display_name && <div className="stat-note">@{p.username}</div>}
                </td>
                <td>
                  {p.accounts.length === 0 ? <span className="dim" style={{ fontSize: 13 }}>not linked</span> : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {p.accounts.map((a, i) => (
                        <span key={i} className="badge muted" style={{ fontWeight: 500 }}>
                          {a.platform}: <span className="mono" style={{ marginLeft: 3 }}>{a.uid}</span>{a.club ? ` · ${a.club}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="num mono" style={{ textAlign: 'right' }}>{money(Number(p.deposited))}</td>
                <td className="num mono" style={{ textAlign: 'right', color: Number(p.owed) > 0 ? 'var(--warn)' : undefined }}>{money(Number(p.owed))}</td>
                <td>
                  {p.flagged ? <span className="badge red">flagged</span>
                    : p.status === 'active' ? <span className="badge ok">active</span>
                    : <span className="badge muted">{p.status}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
