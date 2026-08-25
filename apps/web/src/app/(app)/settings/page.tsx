import { withAccount } from '@loady/core';
import { getCtx } from '@/lib/session';
import { redirect } from 'next/navigation';
import { updateConfig } from './actions';

export const dynamic = 'force-dynamic';
const d = (c: number) => (Number(c) / 100).toFixed(2);

interface Config {
  min_amount: number; max_amount: number; amount_step: number;
  reversible_allowed: boolean; in_development: boolean; currency: string;
}

export default async function Settings() {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');
  const [cfg] = await withAccount(ctx.accountId, (sql) => sql<Config[]>`
    select min_amount, max_amount, amount_step, reversible_allowed, in_development, currency
      from account_config where account_id = ${ctx.accountId}`);
  if (!cfg) redirect('/dashboard');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>
      <header>
        <h1 style={{ fontSize: 28 }}>Settings</h1>
        <p className="dim" style={{ marginTop: 6 }}>Limits and rules for your club. These apply to every method unless a method overrides them.</p>
      </header>

      <form action={updateConfig} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="grid cols-3">
          <div className="field"><label>Minimum ($)</label><input name="min" defaultValue={d(cfg.min_amount)} /></div>
          <div className="field"><label>Maximum ($)</label><input name="max" defaultValue={d(cfg.max_amount)} /></div>
          <div className="field"><label>Step ($)</label><input name="step" defaultValue={d(cfg.amount_step)} /></div>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" name="reversible" defaultChecked={cfg.reversible_allowed} style={{ width: 16, height: 16 }} />
          Allow reversible methods (card, PayPal, bank)
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" name="in_development" defaultChecked={cfg.in_development} style={{ width: 16, height: 16 }} />
          Show players the “still setting up” notice
        </label>
        <div><button className="btn btn-primary" type="submit">Save settings</button></div>
      </form>
    </div>
  );
}
