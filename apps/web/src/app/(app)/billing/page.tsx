const INCLUDED = [
  'Unlimited admins', 'Unlimited payment methods', 'Telegram + Discord',
  'Peer-to-peer matching', 'Reversible-payment holds', 'Full ledger & receipts',
  'Queue controls & overrides', 'Priority support',
];

export default function Billing() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>
      <header>
        <h1 style={{ fontSize: 28 }}>Billing</h1>
        <p className="dim" style={{ marginTop: 6 }}>Your plan and payment. It’s all automatic — a failed payment pauses the bots, a successful one turns them back on.</p>
      </header>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="stat-label">Your plan</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26 }}>Loady · $59/mo</span>
            <span className="badge ok">Active</span>
          </div>
          <div className="stat-note">Everything included · renews monthly</div>
        </div>
        {/* TODO(stripe): opens the Stripe billing portal session */}
        <button className="btn btn-ghost">Manage payment</button>
      </div>

      <div className="card">
        <div className="stat-label" style={{ marginBottom: 14 }}>What’s included</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {INCLUDED.map((f) => (
            <li key={f} style={{ display: 'flex', gap: 9, fontSize: 14, color: 'var(--ink-dim)' }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="10" cy="10" r="10" fill="var(--accent-soft)" /><path d="M6 10.5l2.5 2.5L14 7.5" stroke="var(--accent-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
