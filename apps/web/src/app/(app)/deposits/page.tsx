import Link from 'next/link';
import { withAccount } from '@loady/core';
import { getCtx } from '@/lib/session';
import { redirect } from 'next/navigation';
import { verifyDeposit, discardDeposit } from './actions';

export const dynamic = 'force-dynamic';
const money = (c: number) => `$${(Number(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function ago(at: Date | string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(at).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

interface Row {
  id: string; amount: number; status: string; payment_ref: string | null; withdraw_id: string | null;
  method: string; name: string | null; payee: string | null; created_at: Date; receipt_id: string | null;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'awaiting', label: 'Being checked' },
  { key: 'locked', label: 'Not paid yet' },
  { key: 'released', label: 'Done' },
  { key: 'company', label: 'Through us' },
];
const BADGE: Record<string, string> = { released: 'ok', awaiting_confirmation: 'warn', locked: 'muted', discarded: 'red' };
const LABEL: Record<string, string> = { locked: 'not paid', awaiting_confirmation: 'checking', released: 'done' };

export default async function Deposits({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');
  const { filter = 'all', q } = await searchParams;
  const term = (q ?? '').trim();

  const rows = await withAccount(ctx.accountId, (sql) => {
    const where =
      filter === 'awaiting' ? sql`and f.status = 'awaiting_confirmation'`
      : filter === 'locked' ? sql`and f.status = 'locked'`
      : filter === 'released' ? sql`and f.status = 'released'`
      : filter === 'company' ? sql`and f.withdraw_id is null`
      : sql``;
    const search = term
      ? sql`and (f.payment_ref ilike ${'%' + term + '%'} or dp.display_name ilike ${'%' + term + '%'})`
      : sql``;
    return sql<Row[]>`
      select f.id, f.amount, f.status, f.payment_ref, f.withdraw_id, pm.name as method,
             dp.display_name as name, f.created_at,
             (select pl.display_name from withdraw_requests w join players pl on pl.id = w.player_id where w.id = f.withdraw_id) as payee,
             (select r.id from receipts r where r.ref_type = 'fill' and r.ref_id = f.id order by r.created_at desc limit 1) as receipt_id
        from fills f
        join deposit_requests d on d.id = f.deposit_id
        left join players dp on dp.id = d.player_id
        left join payment_methods pm on pm.id = f.method_id
       where true ${where} ${search}
       order by f.created_at desc limit 100`;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28 }}>Deposits</h1>
          <p className="dim" style={{ marginTop: 6 }}>Every payment in — who, how much, the reference, and the receipt. Verify once you’ve confirmed it landed.</p>
        </div>
        <form style={{ display: 'flex', gap: 8 }}>
          <input name="q" defaultValue={term} placeholder="Search ref or name…" style={{ width: 220, height: 38 }} />
          <input type="hidden" name="filter" value={filter} />
          <button className="btn btn-dark btn-sm" type="submit">Search</button>
        </form>
      </header>

      <div className="tabs" role="tablist">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/deposits?filter=${f.key}`} role="tab" aria-selected={filter === f.key} className={`tab ${filter === f.key ? 'active' : ''}`}>{f.label}</Link>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th style={{ width: 90 }}>Status</th><th className="num">Amount</th><th style={{ width: 90 }}>Type</th><th>From → To</th><th>Reference</th><th style={{ width: 70 }}>Receipt</th><th style={{ width: 60 }}>Age</th><th style={{ width: 180 }} /></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Nothing matches.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td><span className={`badge ${BADGE[r.status] ?? 'muted'}`}>{LABEL[r.status] ?? r.status.replace(/_/g, ' ')}</span></td>
                <td className="num mono" style={{ textAlign: 'right', fontWeight: 600 }}>{money(r.amount)}</td>
                <td><span className={`badge ${r.withdraw_id ? 'muted' : 'red'}`}>{r.withdraw_id ? 'player→player' : 'money in'}</span><div className="stat-note">{r.method}</div></td>
                <td style={{ fontSize: 12 }}><span style={{ fontWeight: 600 }}>{r.name ?? <em>us</em>}</span> → <span style={{ fontWeight: 600 }}>{r.payee ?? <em>us</em>}</span></td>
                <td className="mono" style={{ fontSize: 11 }}>{r.payment_ref ?? '—'}</td>
                <td>
                  {r.receipt_id
                    ? <a href={`/api/receipt/${r.receipt_id}`} target="_blank" rel="noreferrer"><img src={`/api/receipt/${r.receipt_id}`} alt="receipt" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} /></a>
                    : <span className="badge muted">none</span>}
                </td>
                <td className="mono" style={{ fontSize: 12 }}>{ago(r.created_at)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                    {r.status === 'awaiting_confirmation' && (
                      <>
                        <form action={verifyDeposit}><input type="hidden" name="id" value={r.id} /><button className="btn btn-primary btn-sm" type="submit">Verify</button></form>
                        <form action={discardDeposit}><input type="hidden" name="id" value={r.id} /><button className="btn btn-ghost btn-sm" type="submit">Discard</button></form>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
