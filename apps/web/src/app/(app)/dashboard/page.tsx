import { withAccount, platformTotals, clubTotals } from '@loady/core';
import { getCtx } from '@/lib/session';
import { redirect } from 'next/navigation';
import { ByPlatform, type PlatformRow } from '@/components/by-platform';

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
  // Sequential (not Promise.all) so two RLS transactions never share a pooled
  // connection concurrently; defensive so a reporting query can't white-screen.
  let totals: Awaited<ReturnType<typeof platformTotals>> = [];
  let clubs: Awaited<ReturnType<typeof clubTotals>> = [];
  try {
    totals = await platformTotals(ctx.accountId);
    clubs = await clubTotals(ctx.accountId);
  } catch (e) {
    console.error('[dashboard totals]', e);
  }
  const platformRows: PlatformRow[] = totals.map((t) => ({
    id: t.id, name: t.name, deposited: Number(t.deposited), withdrawn: Number(t.withdrawn),
    clubs: clubs.filter((c) => c.platformId === t.id).map((c) => ({ id: c.clubId, name: c.name, deposited: Number(c.deposited), withdrawn: Number(c.withdrawn) })),
  }));

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
          <span className="stat-note">All-time · a platform with several clubs expands into them</span>
        </div>
        <ByPlatform rows={platformRows} />
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
