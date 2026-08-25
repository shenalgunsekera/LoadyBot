import { withAccount } from '@loady/core';
import { getCtx } from '@/lib/session';
import { redirect } from 'next/navigation';
import { payFromFloat } from './actions';

export const dynamic = 'force-dynamic';
const money = (c: number) => `$${(Number(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Row {
  id: string; amount: number; amount_remaining: number; payout_handle: string | null;
  method: string; name: string | null; position: number; created_at: Date;
}

export default async function Withdrawals() {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');

  const rows = await withAccount(ctx.accountId, (sql) => sql<Row[]>`
    select q.id, q.amount, q.amount_remaining, q.payout_handle, pm.name as method,
           dp.display_name as name, q.queue_position as position, q.created_at
      from v_withdraw_queue q
      left join players dp on dp.id = q.player_id
      left join payment_methods pm on pm.id = q.method_id
     order by q.queue_position`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 28 }}>Withdrawals</h1>
        <p className="dim" style={{ marginTop: 6 }}>Oldest first. Depositors fill these automatically — or pay one directly from your float.</p>
      </header>

      <div className="table-wrap">
        <table>
          <thead><tr><th style={{ width: 40 }}>#</th><th>Player</th><th>Method</th><th className="num">Owed</th><th>Payout handle</th><th style={{ width: 220 }} /></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Nobody is waiting to be paid.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.position}</td>
                <td style={{ fontWeight: 600 }}>{r.name ?? '—'}</td>
                <td><span className="badge muted">{r.method}</span></td>
                <td className="num" style={{ textAlign: 'right', fontWeight: 600 }}>{money(r.amount_remaining)}</td>
                <td className="mono" style={{ fontSize: 12 }}>{r.payout_handle}</td>
                <td>
                  <form action={payFromFloat} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="hidden" name="id" value={r.id} />
                    <input name="amount" placeholder={`all (${(r.amount_remaining / 100).toFixed(2)})`} style={{ width: 110, height: 34, fontSize: 13 }} />
                    <button className="btn btn-primary btn-sm" type="submit">Pay from float</button>
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
