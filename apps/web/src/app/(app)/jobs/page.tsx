import { withAccount } from '@loady/core';
import { getCtx } from '@/lib/session';
import { redirect } from 'next/navigation';
import { markLoaded } from './actions';

export const dynamic = 'force-dynamic';
const money = (c: number) => `$${(Number(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Job {
  id: string; credit: number; amount: number; name: string | null;
  platform: string | null; uid: string | null; released_at: Date;
}

export default async function Jobs() {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');

  const jobs = await withAccount(ctx.accountId, (sql) => sql<Job[]>`
    select f.id, f.credit_amount as credit, f.amount, dp.display_name as name,
           pf.name as platform, pp.platform_uid as uid, f.released_at
      from fills f
      join deposit_requests d on d.id = f.deposit_id
      left join players dp on dp.id = d.player_id
      left join platforms pf on pf.id = d.platform_id
      left join player_platforms pp on pp.player_id = d.player_id and pp.platform_id = d.platform_id
     where f.status = 'released' and f.deposit_id is not null and f.loaded_at is null
     order by f.released_at limit 200`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 28 }}>Jobs</h1>
        <p className="dim" style={{ marginTop: 6 }}>Verified deposits waiting to be loaded onto the player's account. Add the chips, then mark it loaded.</p>
      </header>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th className="num" style={{ width: 90 }}>Add</th><th>Player</th><th>Where</th><th className="mono">Account ID</th><th style={{ width: 140 }} /></tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Nothing to load right now. 🎉</td></tr>
            ) : jobs.map((j) => (
              <tr key={j.id}>
                <td className="num mono" style={{ fontWeight: 600, color: 'var(--ok)' }}>+{money(Number(j.credit ?? j.amount))}</td>
                <td style={{ fontWeight: 600 }}>{j.name ?? '—'}</td>
                <td><span className="badge muted">{j.platform ?? '—'}</span></td>
                <td className="mono" style={{ fontSize: 12 }}>{j.uid ?? <span className="dim">not linked</span>}</td>
                <td>
                  <form action={markLoaded}>
                    <input type="hidden" name="id" value={j.id} />
                    <button className="btn btn-primary btn-sm" type="submit">✅ Loaded</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
