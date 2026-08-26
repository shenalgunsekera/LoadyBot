import { withAccount } from '@loady/core';
import { getCtx } from '@/lib/session';
import { redirect } from 'next/navigation';
import { updateConfig, updatePlatforms } from './actions';

export const dynamic = 'force-dynamic';
const d = (c: number) => (Number(c) / 100).toFixed(2);

interface Config {
  min_amount: number; max_amount: number; amount_step: number;
  reversible_allowed: boolean; in_development: boolean; currency: string;
}
interface Platform { id: string; name: string; enabled: boolean; }

export default async function Settings() {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');
  const { cfg, platforms } = await withAccount(ctx.accountId, async (sql) => {
    const [cfg] = await sql<Config[]>`
      select min_amount, max_amount, amount_step, reversible_allowed, in_development, currency
        from account_config where account_id = ${ctx.accountId}`;
    const platforms = await sql<Platform[]>`select id, name, enabled from platforms order by sort_order, name`;
    return { cfg, platforms };
  });
  if (!cfg) redirect('/dashboard');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>
      <header>
        <h1 style={{ fontSize: 28 }}>Settings</h1>
        <p className="dim" style={{ marginTop: 6 }}>Limits and rules for your club. These apply to every method unless a method overrides them.</p>
      </header>

      <form action={updatePlatforms} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 16 }}>Platforms you offer</h3>
          <p className="stat-note" style={{ marginTop: 2 }}>The bot only shows players the platforms you tick — pick ClubGG, Sportsbook, or both.</p>
        </div>
        {platforms.map((p) => (
          <label key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
            <input type="checkbox" name={`pf_${p.id}`} defaultChecked={p.enabled} style={{ width: 16, height: 16 }} />
            {p.name}
          </label>
        ))}
        <div><button className="btn btn-primary btn-sm" type="submit">Save platforms</button></div>
      </form>

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
