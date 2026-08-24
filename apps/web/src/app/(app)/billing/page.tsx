const PLANS = [
  { code: 'starter', name: 'Starter', price: 29 },
  { code: 'pro', name: 'Pro', price: 59, current: true },
  { code: 'scale', name: 'Scale', price: 99 },
];

export default function Billing() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 860 }}>
      <header>
        <h1 style={{ fontSize: 28 }}>Billing</h1>
        <p className="dim" style={{ marginTop: 6 }}>Your plan and payment. Everything is automatic — a failed payment pauses the bots, a successful one turns them back on.</p>
      </header>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="stat-label">Current plan</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26 }}>Pro</span>
            <span className="badge ok">Active</span>
          </div>
          <div className="stat-note">Renews Sep 24 · $59/month</div>
        </div>
        {/* TODO(stripe): opens the Stripe billing portal session */}
        <button className="btn btn-ghost">Manage payment</button>
      </div>

      <div>
        <h3 style={{ marginBottom: 12 }}>Change plan</h3>
        <div className="grid cols-3">
          {PLANS.map((p) => (
            <div className="card" key={p.code} style={p.current ? { borderColor: 'var(--accent)' } : undefined}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>{p.name}</div>
              <div style={{ margin: '10px 0 16px', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30 }}>${p.price}</span>
                <span className="muted">/mo</span>
              </div>
              <button className={`btn ${p.current ? 'btn-ghost' : 'btn-primary'}`} style={{ width: '100%' }} disabled={p.current}>
                {p.current ? 'Current plan' : `Switch to ${p.name}`}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
