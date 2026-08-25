import { withAccount } from '@loady/core';
import { getCtx } from '@/lib/session';
import { redirect } from 'next/navigation';
import { payFromFloat, pauseWithdraw, resumeWithdraw } from './actions';

export const dynamic = 'force-dynamic';
const money = (c: number) => `$${(Number(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Row {
  id: string; amount: number; amount_remaining: number; payout_handle: string | null;
  status: string; method: string | null; name: string | null; created_at: Date;
}

export default async function Withdrawals() {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');

  // Active first (oldest → newest, the pay order), paused last.
  const rows = await withAccount(ctx.accountId, (sql) => sql<Row[]>`
    select w.id, w.amount, w.amount_remaining, w.payout_handle, w.status,
           pm.name as method, dp.display_name as name, w.created_at
      from withdraw_requests w
      left join players dp on dp.id = w.player_id
      left join payment_methods pm on pm.id = w.method_id
     where w.status in ('queued','partially_filled','paused')
     order by (w.status = 'paused'), w.created_at`);

  let pos = 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 28 }}>Withdrawals</h1>
        <p className="dim" style={{ marginTop: 6 }}>Oldest first. Depositors fill these automatically — or pay one from your float. Pause a cash-out to hold it out of the queue.</p>
      </header>

      <div className="table-wrap">
        <table>
          <thead><tr><th style={{ width: 40 }}>#</th><th>Player</th><th>Method</th><th className="num">Owed</th><th>Payout handle</th><th style={{ width: 300 }} /></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Nobody is waiting to be paid.</td></tr>
            ) : rows.map((r) => {
              const paused = r.status === 'paused';
              if (!paused) pos += 1;
              return (
                <tr key={r.id} style={paused ? { opacity: 0.6 } : undefined}>
                  <td className="mono">{paused ? '—' : pos}</td>
                  <td style={{ fontWeight: 600 }}>{r.name ?? '—'}</td>
                  <td><span className="badge muted">{r.method ?? '—'}</span></td>
                  <td className="num" style={{ textAlign: 'right', fontWeight: 600 }}>{money(r.amount_remaining)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{r.payout_handle}</td>
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
                            <input name="amount" placeholder={`all (${(r.amount_remaining / 100).toFixed(2)})`} style={{ width: 100, height: 34, fontSize: 13 }} />
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
