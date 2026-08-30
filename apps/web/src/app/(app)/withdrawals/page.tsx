import Link from 'next/link';
import { withAccount } from '@loady/core';
import { getCtx } from '@/lib/session';
import { redirect } from 'next/navigation';
import { payFromFloat, pauseWithdraw, resumeWithdraw } from './actions';

export const dynamic = 'force-dynamic';
const money = (c: number) => `$${(Number(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Short "how long ago" — server-rendered, no client JS. */
function ago(at: Date | string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(at).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

interface Row {
  id: string; amount: number; amount_remaining: number; payout_handle: string | null;
  status: string; method: string | null; name: string | null; created_at: Date;
  platform: string | null; code: string | null; account: string | null; club: string | null;
  paid: number; locked: number;
}

export default async function Withdrawals({ searchParams }: { searchParams: Promise<{ method?: string }> }) {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');
  const { method } = await searchParams;

  // Active first (oldest → newest, the pay order), paused last.
  const all = await withAccount(ctx.accountId, (sql) => sql<Row[]>`
    select w.id, w.amount, w.amount_remaining, w.payout_handle, w.status,
           pm.name as method, dp.display_name as name, w.created_at,
           pf.name as platform, pf.code as code, c.name as club,
           coalesce(case when pf.code = 'clubgg' then pp.platform_username else pp.platform_uid end, dp.display_name) as account,
           coalesce((select sum(f.amount) from fills f where f.withdraw_id = w.id and f.status = 'released'), 0)::bigint as paid,
           coalesce((select sum(f.amount) from fills f where f.withdraw_id = w.id and f.status in ('locked','awaiting_confirmation')), 0)::bigint as locked
      from withdraw_requests w
      left join players dp on dp.id = w.player_id
      left join payment_methods pm on pm.id = w.method_id
      left join platforms pf on pf.id = w.platform_id
      left join player_platforms pp on pp.player_id = w.player_id and pp.platform_id = w.platform_id
      left join clubs c on c.id = pp.club_id
     where w.status in ('queued','partially_filled','paused')
     order by (w.status = 'paused'), w.created_at`);

  // Method filter tabs — one clean list at a time. Counts come from the full queue.
  const counts = new Map<string, number>();
  for (const r of all) if (r.method) counts.set(r.method, (counts.get(r.method) ?? 0) + 1);
  const methodTabs = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const active = method && counts.has(method) ? method : 'all';
  const rows = active === 'all' ? all : all.filter((r) => r.method === active);

  let pos = 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 28 }}>Withdrawals</h1>
        <p className="dim" style={{ marginTop: 6 }}>Oldest first. Depositors fill these automatically — or pay one from your float. Pause a cash-out to hold it out of the queue.</p>
      </header>

      {methodTabs.length > 0 && (
        <div className="tabs" role="tablist" aria-label="Filter by payment method">
          <Link href="/withdrawals" role="tab" aria-selected={active === 'all'} className={`tab ${active === 'all' ? 'active' : ''}`}>
            All <span style={{ opacity: 0.55 }}>{all.length}</span>
          </Link>
          {methodTabs.map(([m, c]) => (
            <Link key={m} href={`/withdrawals?method=${encodeURIComponent(m)}`} role="tab" aria-selected={active === m}
                  className={`tab ${active === m ? 'active' : ''}`}>
              {m} <span style={{ opacity: 0.55 }}>{c}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr>
            <th style={{ width: 40 }}>#</th><th>Player</th><th style={{ width: 110 }}>Method</th>
            <th className="num" style={{ width: 90 }}>Asked</th><th className="num" style={{ width: 100 }}>Still owed</th>
            <th style={{ width: 120 }}>Progress</th><th>Payout handle</th><th style={{ width: 70 }}>Waiting</th><th style={{ width: 300 }} />
          </tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Nobody is waiting to be paid.</td></tr>
            ) : rows.map((r) => {
              const paused = r.status === 'paused';
              if (!paused) pos += 1;
              const paid = Number(r.paid), locked = Number(r.locked), amount = Number(r.amount);
              const owed = amount - paid;
              const pct = amount ? Math.round((paid / amount) * 100) : 0;
              const lockedPct = amount ? Math.round((locked / amount) * 100) : 0;
              const stale = !paused && (Date.now() - new Date(r.created_at).getTime()) > 6 * 3600 * 1000;
              return (
                <tr key={r.id} style={paused ? { opacity: 0.6 } : stale ? { background: 'var(--warn-soft, rgba(245,158,11,0.08))' } : undefined}>
                  <td className="mono">{paused ? '—' : pos}</td>
                  <td>
                    <strong>{r.account ?? r.name ?? '—'}</strong>
                    {[r.platform, r.club].filter(Boolean).length > 0 && (
                      <span className="badge muted" style={{ marginLeft: 6 }}>{[r.platform, r.club].filter(Boolean).join(' · ')}</span>
                    )}
                    {r.account && r.account !== r.name && r.name && (
                      <div className="stat-note">{r.name}</div>
                    )}
                  </td>
                  <td><span className="badge muted">{r.method ?? '—'}</span></td>
                  <td className="num mono" style={{ textAlign: 'right' }}>{money(amount)}</td>
                  <td className="num" style={{ textAlign: 'right' }}>
                    <strong className="mono">{money(owed)}</strong>
                    {locked > 0 && <div className="badge warn" style={{ marginTop: 2, fontSize: 10 }}>{money(locked)} being paid</div>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 100, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--ok)' }} />
                      <div style={{ width: `${lockedPct}%`, height: '100%', background: 'var(--warn)' }} title="in progress" />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>{pct}% paid{lockedPct > 0 ? ` · ${lockedPct}% in progress` : ''}</span>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{r.payout_handle}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{paused ? '—' : ago(r.created_at)}{stale && <div className="badge warn" style={{ marginTop: 2 }}>slow</div>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {paused ? (
                        <>
                          <span className="badge warn">Paused</span>
                          <form action={resumeWithdraw}><input type="hidden" name="id" value={r.id} /><button className="btn btn-sm" type="submit">Resume</button></form>
                        </>
                      ) : (
                        <>
                          <form action={payFromFloat} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input type="hidden" name="id" value={r.id} />
                            <input name="amount" placeholder={`all (${(owed / 100).toFixed(2)})`} style={{ width: 100, height: 34, fontSize: 13 }} />
                            <button className="btn btn-primary btn-sm" type="submit">Pay</button>
                          </form>
                          <form action={pauseWithdraw}><input type="hidden" name="id" value={r.id} /><button className="btn btn-sm" type="submit">Pause</button></form>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
