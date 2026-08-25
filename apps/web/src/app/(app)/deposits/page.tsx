import { withAccount } from '@loady/core';
import { getCtx } from '@/lib/session';
import { redirect } from 'next/navigation';
import { verifyDeposit, discardDeposit } from './actions';

export const dynamic = 'force-dynamic';
const money = (c: number) => `$${(Number(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Row {
  id: string; amount: number; status: string; payment_ref: string | null; withdraw_id: string | null;
  method: string; name: string | null; created_at: Date;
}

const BADGE: Record<string, string> = { released: 'ok', awaiting_confirmation: 'warn', locked: 'muted', discarded: 'red' };

export default async function Deposits() {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');

  const rows = await withAccount(ctx.accountId, (sql) => sql<Row[]>`
    select f.id, f.amount, f.status, f.payment_ref, f.withdraw_id, pm.name as method,
           dp.display_name as name, f.created_at
      from fills f
      join deposit_requests d on d.id = f.deposit_id
      left join players dp on dp.id = d.player_id
      left join payment_methods pm on pm.id = f.method_id
     order by f.created_at desc limit 100`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 28 }}>Deposits</h1>
        <p className="dim" style={{ marginTop: 6 }}>Money coming in. Verify a payment once you’ve confirmed the screenshot landed.</p>
      </header>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Player</th><th>Method</th><th className="num">Amount</th><th>Type</th><th>Status</th><th>Ref</th><th style={{ width: 180 }} /></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No deposits yet.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.name ?? '—'}</td>
                <td><span className="badge muted">{r.method}</span></td>
                <td className="num" style={{ textAlign: 'right', fontWeight: 600 }}>{money(r.amount)}</td>
                <td className="dim" style={{ fontSize: 13 }}>{r.withdraw_id ? 'p2p match' : 'company'}</td>
                <td><span className={`badge ${BADGE[r.status] ?? 'muted'}`}>{r.status.replace(/_/g, ' ')}</span></td>
                <td className="mono" style={{ fontSize: 11 }}>{r.payment_ref ?? '—'}</td>
                <td>
                  {r.status === 'awaiting_confirmation' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <form action={verifyDeposit}><input type="hidden" name="id" value={r.id} /><button className="btn btn-primary btn-sm" type="submit">Verify</button></form>
                      <form action={discardDeposit}><input type="hidden" name="id" value={r.id} /><button className="btn btn-ghost btn-sm" type="submit">Discard</button></form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
