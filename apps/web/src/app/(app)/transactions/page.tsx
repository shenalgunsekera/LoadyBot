import { withAccount } from '@loady/core';
import { getCtx } from '@/lib/session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
const money = (c: number) => `$${(Number(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Row {
  id: string; amount: number; status: string; created_at: Date; released_at: Date | null;
  method: string | null; depositor: string | null; payee: string | null; kind: string;
}

const KIND: Record<string, [string, string]> = {
  matched: ['ok', 'Matched'], club_received: ['muted', 'Money in'], club_payout: ['warn', 'Club paid'],
};
const STATUS: Record<string, string> = { released: 'ok', awaiting_confirmation: 'warn', locked: 'muted', discarded: 'red' };

export default async function Transactions() {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');

  const rows = await withAccount(ctx.accountId, (sql) => sql<Row[]>`
    select f.id, f.amount, f.status, f.created_at, f.released_at, pm.name as method,
           dp.display_name as depositor, wp.display_name as payee,
           case when f.deposit_id is null then 'club_payout'
                when f.withdraw_id is null then 'club_received' else 'matched' end as kind
      from fills f
      left join payment_methods pm on pm.id = f.method_id
      left join deposit_requests d on d.id = f.deposit_id
      left join players dp on dp.id = d.player_id
      left join withdraw_requests w on w.id = f.withdraw_id
      left join players wp on wp.id = w.player_id
     order by f.created_at desc limit 150`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 28 }}>Transactions</h1>
        <p className="dim" style={{ marginTop: 6 }}>Every payment that moved through your club — deposits matched to cash-outs, money in, and payouts.</p>
      </header>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>When</th><th>Type</th><th>From</th><th>To</th><th>Method</th><th className="num" style={{ textAlign: 'right' }}>Amount</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No transactions yet.</td></tr>
            ) : rows.map((r) => {
              const [kc, kl] = KIND[r.kind] ?? ['muted', r.kind];
              return (
                <tr key={r.id}>
                  <td className="dim" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                  <td><span className={`badge ${kc}`}>{kl}</span></td>
                  <td>{r.depositor ?? <span className="dim">—</span>}</td>
                  <td>{r.payee ?? <span className="dim">club</span>}</td>
                  <td><span className="badge muted">{r.method ?? '—'}</span></td>
                  <td className="num mono" style={{ textAlign: 'right', fontWeight: 600 }}>{money(Number(r.amount))}</td>
                  <td><span className={`badge ${STATUS[r.status] ?? 'muted'}`}>{r.status.replace(/_/g, ' ')}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
