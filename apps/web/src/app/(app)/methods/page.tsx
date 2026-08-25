import { withAccount } from '@loady/core';
import { getCtx } from '@/lib/session';
import { redirect } from 'next/navigation';
import { updateMethod, addMethod } from './actions';

export const dynamic = 'force-dynamic';
const d = (c: number | null) => (c == null ? '' : (c / 100).toFixed(2));

interface Method {
  id: string; code: string; name: string; enabled: boolean; payout_enabled: boolean;
  settlement: string; club_handle: string | null; min_amount: number | null; max_amount: number | null;
}

export default async function Methods() {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');
  const methods = await withAccount(ctx.accountId, (sql) => sql<Method[]>`
    select id, code, name, enabled, payout_enabled, settlement, club_handle, min_amount, max_amount
      from payment_methods order by sort_order, name`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>
      <header>
        <h1 style={{ fontSize: 28 }}>Payment methods</h1>
        <p className="dim" style={{ marginTop: 6 }}>How players pay in and cash out. <strong>Company</strong> means deposits go to your club account; <strong>Peer-to-peer</strong> matches a waiting cash-out.</p>
      </header>

      {methods.map((m) => (
        <form key={m.id} action={updateMethod} className="card">
          <input type="hidden" name="id" value={m.id} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>{m.name} <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{m.code}</span></div>
            <button className="btn btn-dark btn-sm" type="submit">Save</button>
          </div>
          <div className="grid cols-3" style={{ gap: 14 }}>
            <div className="field"><label>Settlement</label>
              <select name="settlement" defaultValue={m.settlement}><option value="p2p">Peer-to-peer</option><option value="company">Company</option></select>
            </div>
            <div className="field"><label>Min ($)</label><input name="min" defaultValue={d(m.min_amount)} placeholder="uses global" /></div>
            <div className="field"><label>Max ($)</label><input name="max" defaultValue={d(m.max_amount)} placeholder="uses global" /></div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Club account / handle (where company deposits are paid)</label>
            <input name="club_handle" defaultValue={m.club_handle ?? ''} placeholder="e.g. your Venmo @handle" />
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 14 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" name="enabled" defaultChecked={m.enabled} style={{ width: 16, height: 16 }} /> Enabled</label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" name="payout" defaultChecked={m.payout_enabled} style={{ width: 16, height: 16 }} /> Allow cash-outs</label>
          </div>
        </form>
      ))}

      <form action={addMethod} className="card">
        <div className="stat-label" style={{ marginBottom: 12 }}>Add a method</div>
        <div className="grid cols-3" style={{ alignItems: 'end' }}>
          <div className="field"><label>Name</label><input name="name" placeholder="Chime" required /></div>
          <div className="field"><label>Code</label><input name="code" placeholder="chime" required /></div>
          <button className="btn btn-primary" type="submit">Add</button>
        </div>
      </form>
    </div>
  );
}
