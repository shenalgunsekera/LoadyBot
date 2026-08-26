import { withAccount, platformTotals } from '@loady/core';
import { getCtx } from '@/lib/session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const money = (c: number) => `$${(Number(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function Overview() {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');

  const data = await withAccount(ctx.accountId, async (sql) => {
    const [pos] = await sql<{ float: number; on_platform: number; escrow: number; fees: number }[]>`
      select coalesce((select sum(balance) from ledger_accounts where kind='owner_float'),0) as float,
             coalesce((select sum(balance) from ledger_accounts where kind='house_settlement'),0) as on_platform,
             coalesce((select sum(balance) from ledger_accounts where kind='player_escrow'),0) as escrow,
             coalesce((select sum(balance) from ledger_accounts where kind='house_rake'),0) as fees`;
    const toVerify = await sql<{ id: string; amount: number; name: string | null; created_at: Date }[]>`
      select f.id, f.amount, dp.display_name as name, f.submitted_at as created_at
        from fills f join deposit_requests d on d.id = f.deposit_id
        left join players dp on dp.id = d.player_id
       where f.status = 'awaiting_confirmation' and f.deposit_id is not null
       order by f.submitted_at limit 20`;
    const queue = await sql<{ id: string; amount_remaining: number; payout_handle: string | null; name: string | null; position: number }[]>`
      select q.id, q.amount_remaining, q.payout_handle, dp.display_name as name, q.queue_position as position
        from v_withdraw_queue q left join players dp on dp.id = q.player_id
       order by q.queue_position limit 20`;
    return { pos: pos!, toVerify, queue };
  });
  const totals = await platformTotals(ctx.accountId);
  const grand = totals.reduce((a, t) => ({ deposited: a.deposited + Number(t.deposited), withdrawn: a.withdrawn + Number(t.withdrawn) }), { deposited: 0, withdrawn: 0 });

  const held = -Number(data.pos.float);       // owner_float is negative while holding cash
  const owed = Number(data.pos.on_platform) + Number(data.pos.escrow);

  const stats = [
    { label: "Cash you're holding", value: money(held), note: 'from company-settled deposits', pos: held >= 0 },
    { label: 'Owed to players', value: money(owed), note: 'on the tables + queued cash-outs' },
    { label: 'In cash-out queue', value: money(Number(data.pos.escrow)), note: `${data.queue.length} waiting` },
    { label: 'Fees earned', value: money(Number(data.pos.fees)), note: 'rake', pos: true },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 28 }}>Overview</h1>
        <p className="dim" style={{ marginTop: 6 }}>Your money position, and everything waiting on you.</p>
      </header>

      <div className="grid cols-4">
        {stats.map((s) => (
          <div className="card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.pos ? 'pos' : ''}`}>{s.value}</div>
            <div className="stat-note">{s.note}</div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <h3>Deposits &amp; cash-outs by platform</h3>
          <span className="stat-note">All-time · settled deposits and paid cash-outs</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Platform</th><th className="num" style={{ textAlign: 'right' }}>Deposited in</th><th className="num" style={{ textAlign: 'right' }}>Cashed out</th><th className="num" style={{ textAlign: 'right' }}>Net</th></tr></thead>
            <tbody>
              {totals.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No platforms yet.</td></tr>
              ) : totals.map((t) => {
                const net = Number(t.deposited) - Number(t.withdrawn);
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td className="num mono" style={{ textAlign: 'right', color: 'var(--ok)' }}>{money(Number(t.deposited))}</td>
                    <td className="num mono" style={{ textAlign: 'right', color: 'var(--ink-dim)' }}>{money(Number(t.withdrawn))}</td>
                    <td className="num mono" style={{ textAlign: 'right', fontWeight: 600, color: net >= 0 ? 'var(--ok)' : 'var(--red)' }}>{money(net)}</td>
                  </tr>
                );
              })}
            </tbody>
            {totals.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border-strong)' }}>
                  <td style={{ fontWeight: 700 }}>All platforms</td>
                  <td className="num mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--ok)' }}>{money(grand.deposited)}</td>
                  <td className="num mono" style={{ textAlign: 'right', fontWeight: 700 }}>{money(grand.withdrawn)}</td>
                  <td className="num mono" style={{ textAlign: 'right', fontWeight: 700, color: grand.deposited - grand.withdrawn >= 0 ? 'var(--ok)' : 'var(--red)' }}>{money(grand.deposited - grand.withdrawn)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div>
          <h3 style={{ marginBottom: 12 }}>Deposits to verify ({data.toVerify.length})</h3>
          <div className="table-wrap">
            <table><thead><tr><th>Player</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {data.toVerify.length === 0 ? <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>All clear 🎉</td></tr>
                  : data.toVerify.map((d) => (
                    <tr key={d.id}><td>{d.name ?? '—'}</td><td className="num" style={{ textAlign: 'right' }}>{money(d.amount)}</td></tr>
                  ))}
              </tbody></table>
          </div>
        </div>
        <div>
          <h3 style={{ marginBottom: 12 }}>Cash-out queue ({data.queue.length})</h3>
          <div className="table-wrap">
            <table><thead><tr><th>#</th><th>Player</th><th className="num">Owed</th></tr></thead>
              <tbody>
                {data.queue.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Nobody waiting.</td></tr>
                  : data.queue.map((w) => (
                    <tr key={w.id}><td className="mono">{w.position}</td><td>{w.name ?? '—'}</td><td className="num" style={{ textAlign: 'right' }}>{money(w.amount_remaining)}</td></tr>
                  ))}
              </tbody></table>
          </div>
        </div>
      </div>
    </div>
  );
}
