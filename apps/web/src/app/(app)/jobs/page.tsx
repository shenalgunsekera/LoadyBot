import { withAccount } from '@loady/core';
import { getCtx } from '@/lib/session';
import { redirect } from 'next/navigation';
import { markLoaded, markUnloaded } from './actions';

export const dynamic = 'force-dynamic';
const money = (c: number) => `$${(Number(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Load { id: string; credit: number; amount: number; name: string | null; platform: string | null; uid: string | null; }
interface Unload { id: string; amount: number; name: string | null; platform: string | null; uid: string | null; }

export default async function Jobs() {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');

  const { loads, unloads } = await withAccount(ctx.accountId, async (sql) => {
    const loads = await sql<Load[]>`
      select f.id, f.credit_amount as credit, f.amount, dp.display_name as name,
             pf.name as platform, pp.platform_uid as uid
        from fills f
        join deposit_requests d on d.id = f.deposit_id
        left join players dp on dp.id = d.player_id
        left join platforms pf on pf.id = d.platform_id
        left join player_platforms pp on pp.player_id = d.player_id and pp.platform_id = d.platform_id
       where f.status = 'released' and f.deposit_id is not null and f.loaded_at is null
       order by f.released_at limit 200`;
    const unloads = await sql<Unload[]>`
      select w.id, w.amount, dp.display_name as name, pf.name as platform, pp.platform_uid as uid
        from withdraw_requests w
        left join players dp on dp.id = w.player_id
        left join platforms pf on pf.id = w.platform_id
        left join player_platforms pp on pp.player_id = w.player_id and pp.platform_id = w.platform_id
       where w.status in ('queued','partially_filled','paused') and w.unloaded_at is null
       order by w.created_at limit 200`;
    return { loads, unloads };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <header>
        <h1 style={{ fontSize: 28 }}>Load / take off</h1>
        <p className="dim" style={{ marginTop: 6 }}>Chips to move on players' platform accounts — add for verified deposits, take off for cash-outs.</p>
      </header>

      <section>
        <h3 style={{ marginBottom: 12 }}>⬇︎ Load chips ({loads.length})</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th className="num" style={{ width: 90 }}>Add</th><th>Player</th><th>Where</th><th className="mono">Account ID</th><th style={{ width: 130 }} /></tr></thead>
            <tbody>
              {loads.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>Nothing to load. 🎉</td></tr>
              ) : loads.map((j) => (
                <tr key={j.id}>
                  <td className="num mono" style={{ fontWeight: 600, color: 'var(--ok)' }}>+{money(Number(j.credit ?? j.amount))}</td>
                  <td style={{ fontWeight: 600 }}>{j.name ?? '—'}</td>
                  <td><span className="badge muted">{j.platform ?? '—'}</span></td>
                  <td className="mono" style={{ fontSize: 12 }}>{j.uid ?? <span className="dim">not linked</span>}</td>
                  <td><form action={markLoaded}><input type="hidden" name="id" value={j.id} /><button className="btn btn-primary btn-sm" type="submit">✅ Loaded</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 style={{ marginBottom: 12 }}>⬆︎ Take off chips ({unloads.length})</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th className="num" style={{ width: 90 }}>Remove</th><th>Player</th><th>Where</th><th className="mono">Account ID</th><th style={{ width: 130 }} /></tr></thead>
            <tbody>
              {unloads.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>Nothing to take off. 🎉</td></tr>
              ) : unloads.map((j) => (
                <tr key={j.id}>
                  <td className="num mono" style={{ fontWeight: 600, color: 'var(--warn)' }}>−{money(Number(j.amount))}</td>
                  <td style={{ fontWeight: 600 }}>{j.name ?? '—'}</td>
                  <td><span className="badge muted">{j.platform ?? '—'}</span></td>
                  <td className="mono" style={{ fontSize: 12 }}>{j.uid ?? <span className="dim">not linked</span>}</td>
                  <td><form action={markUnloaded}><input type="hidden" name="id" value={j.id} /><button className="btn btn-dark btn-sm" type="submit">✅ Taken off</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
