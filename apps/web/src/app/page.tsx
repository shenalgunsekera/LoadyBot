import Link from 'next/link';

const PACKAGES = [
  { code: 'starter', name: 'Starter', price: 29, tagline: 'A new club finding its feet.',
    features: ['2 admins', '4 payment methods', 'Telegram + Discord', 'Company-settled cash-outs'] },
  { code: 'pro', name: 'Pro', price: 59, featured: true, tagline: 'Most clubs land here.',
    features: ['6 admins', '12 payment methods', 'Peer-to-peer matching', 'Reversible-payment holds', 'Audit log & receipts'] },
  { code: 'scale', name: 'Scale', price: 99, tagline: 'High volume, many hands.',
    features: ['20 admins', 'Unlimited methods', 'Everything in Pro', 'Priority support', 'Queue controls & overrides'] },
];

const STEPS = [
  { n: '1', t: 'Create your account', d: 'Sign up, pick a package, and your space spins up instantly — your own methods, limits and admins.' },
  { n: '2', t: 'Connect your chats', d: 'Add Loady to your Telegram group or Discord server in one click. It binds to your account automatically.' },
  { n: '3', t: 'Players start paying', d: 'Deposits get matched, cash-outs queue up, receipts are filed. You just watch it run from the dashboard.' },
];

const FEATURES = [
  ['Peer-to-peer matching', 'Deposits pay waiting cash-outs directly, oldest first — the float never touches most of the money.'],
  ['Reversible-payment holds', 'Card/PayPal/bank sit on a chargeback hold; crypto and cash clear instantly. Your call, per method.'],
  ['Every cent on a ledger', 'Double-entry books that always balance, a permanent audit log, and a receipt for every payment.'],
  ['Your admins, your rules', 'Invite your team, set per-cash-out minimums, reorder the queue, pay from float — all tracked to a name.'],
  ['One bot, your space', 'The same Loady bot serves everyone, but your data is sealed off in the database. Nobody sees your books.'],
  ['Set up in minutes', 'No servers, no code. Connect a chat and go. Billing, provisioning and suspension are all automatic.'],
];

export default function Landing() {
  return (
    <>
      {/* Nav */}
      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(244,247,251,.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 70 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20 }}>
            <Logo /> Loady
          </Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link className="btn btn-ghost btn-sm" href="/login">Log in</Link>
            <Link className="btn btn-primary btn-sm" href="/signup">Get started</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container" style={{ padding: '72px 24px 40px', textAlign: 'center' }}>
        <span className="pill">Payments for clubs, done right</span>
        <h1 style={{ marginTop: 20, maxWidth: 820, marginInline: 'auto' }}>
          One bot to run your club’s <span style={{ color: 'var(--accent)' }}>deposits & cash-outs</span>.
        </h1>
        <p className="dim" style={{ fontSize: 19, marginTop: 18, maxWidth: 620, marginInline: 'auto' }}>
          Loady handles matching, holds, receipts and the queue on Telegram & Discord — while every club keeps its own
          sealed-off space. No servers. No spreadsheets. Set up in minutes.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 30, flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" href="/signup">Start your club →</Link>
          <Link className="btn btn-ghost" href="#pricing">See pricing</Link>
        </div>
        <div className="dim" style={{ fontSize: 13, marginTop: 14 }}>Free while you set up · cancel anytime</div>
      </section>

      {/* How it works */}
      <section className="container" style={{ padding: '40px 24px' }}>
        <div className="grid cols-3">
          {STEPS.map((s) => (
            <div className="card" key={s.n}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--accent-strong)', display: 'grid', placeItems: 'center', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{s.n}</div>
              <h3 style={{ marginTop: 16 }}>{s.t}</h3>
              <p className="dim" style={{ marginTop: 8 }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="container" style={{ padding: '48px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h2>Everything a club needs, nothing it doesn’t</h2>
          <p className="dim" style={{ marginTop: 10 }}>The money engine we run in production — now yours in a few clicks.</p>
        </div>
        <div className="grid cols-3">
          {FEATURES.map(([t, d]) => (
            <div className="card card-hover" key={t}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--accent)', marginBottom: 14 }} />
              <h3>{t}</h3>
              <p className="dim" style={{ marginTop: 8 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container" style={{ padding: '48px 24px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h2>Simple, flat pricing</h2>
          <p className="dim" style={{ marginTop: 10 }}>One monthly price per club. No cut of your volume, ever.</p>
        </div>
        <div className="grid cols-3">
          {PACKAGES.map((p) => (
            <div className="card" key={p.code} style={p.featured ? { borderColor: 'var(--accent)', boxShadow: 'var(--shadow)', position: 'relative' } : undefined}>
              {p.featured && <span className="pill" style={{ position: 'absolute', top: -13, left: 22 }}>Most popular</span>}
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>{p.name}</div>
              <p className="dim" style={{ fontSize: 13.5, marginTop: 4 }}>{p.tagline}</p>
              <div style={{ margin: '18px 0', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 40, letterSpacing: '-0.03em' }}>${p.price}</span>
                <span className="muted">/ month</span>
              </div>
              <Link className={`btn ${p.featured ? 'btn-primary' : 'btn-ghost'}`} href={`/signup?plan=${p.code}`} style={{ width: '100%' }}>Choose {p.name}</Link>
              <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {p.features.map((f) => (
                  <li key={f} style={{ display: 'flex', gap: 10, fontSize: 14, color: 'var(--ink-dim)' }}>
                    <Check /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container" style={{ padding: '48px 24px 80px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--ink)', border: 'none' }}>
          <h2 style={{ color: '#fff' }}>Ready to run your club the easy way?</h2>
          <p style={{ color: '#aab6c8', marginTop: 12 }}>Spin up your space in minutes. Connect a chat and you’re live.</p>
          <Link className="btn btn-primary" href="/signup" style={{ marginTop: 24 }}>Get started free →</Link>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '28px 0' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, color: 'var(--muted)', fontSize: 13 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Logo /> Loady © {new Date().getFullYear()}</span>
          <span>Built for club operators.</span>
        </div>
      </footer>
    </>
  );
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <rect width="26" height="26" rx="8" fill="var(--accent)" />
      <path d="M8 7v9.5A2.5 2.5 0 0 0 10.5 19H18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden>
      <circle cx="10" cy="10" r="10" fill="var(--accent-soft)" />
      <path d="M6 10.5l2.5 2.5L14 7.5" stroke="var(--accent-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
