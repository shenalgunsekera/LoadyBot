import Link from 'next/link';
import { withAccount, platformTotals, clubTotals } from '@loady/core';
import { getCtx } from '@/lib/session';
import { redirect } from 'next/navigation';
import { ByPlatform, type PlatformRow } from '@/components/by-platform';
import { FlowChart, FlowStats, type Bucket } from '@/components/flow-chart';

export const dynamic = 'force-dynamic';

const money = (c: number) => {
  const dollars = Number(c) / 100;
  // Kill "-0.00": negative zero (and any sub-cent negative) formats with a minus.
  const safe = Math.abs(dollars) < 0.005 ? 0 : dollars;
  return `$${safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default async function Overview({ searchParams }: { searchParams: Promise<{ flow?: string }> }) {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');

  // ── Cash-flow range (24h / 7d / 30d), UTC buckets like the Poker panel ──
  const { flow } = await searchParams;
  const preset: '24h' | '7d' | '30d' = flow === '24h' ? '24h' : flow === '30d' ? '30d' : '7d';
  const now = new Date();
  const DAY = 86400000, HOUR = 3600000;
  const today0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const unit: 'hour' | 'day' = preset === '24h' ? 'hour' : 'day';
  const step = unit === 'hour' ? '1 hour' : '1 day';
  const end = now;
  let start: Date, seriesEnd: Date;
  if (preset === '24h') { const th = Math.floor(now.getTime() / HOUR) * HOUR; start = new Date(th - 23 * HOUR); seriesEnd = new Date(th); }
  else { const days = preset === '30d' ? 29 : 6; start = new Date(today0 - days * DAY); seriesEnd = new Date(today0); }

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
    const buckets = await sql<Bucket[]>`
      with b as (select generate_series(${start}::timestamptz, ${seriesEnd}::timestamptz, ${step}::interval) as t),
      fl as (select date_trunc(${unit}, released_at) as t,
               coalesce(sum(amount) filter (where deposit_id is not null), 0) as received,
               coalesce(sum(amount) filter (where withdraw_id is not null), 0) as paid
               from fills where status = 'released' and released_at >= ${start} and released_at < ${end} group by 1)
      select b.t, coalesce(fl.received, 0)::bigint as received, coalesce(fl.paid, 0)::bigint as paid
        from b left join fl on fl.t = b.t order by b.t`;
    return { pos: pos!, toVerify, queue, buckets };
  });
  const flowReceived = data.buckets.reduce((s, b) => s + Number(b.received), 0);
  const flowPaid = data.buckets.reduce((s, b) => s + Number(b.paid), 0);
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

      {/* Cash flow */}
      <section>
        <div className="flow-head">
          <div>
            <h3>Cash flow</h3>
            <p className="dim" style={{ marginTop: 4 }}>Money received (deposits) vs paid out (cash-outs).</p>
          </div>
          <div className="tabs" role="tablist">
            {(['24h', '7d', '30d'] as const).map((k) => (
              <Link key={k} href={`/dashboard?flow=${k}`} role="tab" aria-selected={preset === k} className={`tab ${preset === k ? 'active' : ''}`}>
                {k === '24h' ? '24 hours' : k === '7d' ? '7 days' : '30 days'}
              </Link>
            ))}
          </div>
        </div>
        <div className="grid cols-2" style={{ marginBottom: 16 }}>
          <FlowStats received={flowReceived} paid={flowPaid} />
        </div>
        <div className="card">
          {flowReceived === 0 && flowPaid === 0
            ? <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No money moved in this range.</div>
            : <FlowChart buckets={data.buckets} unit={unit} />}
        </div>
      </section>

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
