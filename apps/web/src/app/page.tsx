import Link from 'next/link';
import { Reveal } from '@/components/reveal';

const METHODS = ['Venmo', 'Zelle', 'Cash App', 'PayPal', 'Apple Pay', 'Bitcoin', 'USDT', 'Ethereum', 'Solana', 'Litecoin'];

const STEPS = [
  { n: '1', t: 'Create your club', d: 'Sign up, pick a plan, and your space spins up in seconds — your methods, your limits, your admins.' },
  { n: '2', t: 'Connect a chat', d: 'One click adds Loady to your Telegram group or Discord server. It binds to your club automatically.' },
  { n: '3', t: 'Go live', d: 'Players deposit, cash-outs queue, receipts file themselves. You just watch it run.' },
];

const PLAN = {
  price: 59,
  features: [
    'Unlimited admins', 'Unlimited payment methods', 'Telegram + Discord',
    'Peer-to-peer matching', 'Reversible-payment holds', 'Full ledger, audit log & receipts',
    'Queue controls & overrides', 'Priority support',
  ],
};

export default function Landing() {
  return (
    <>
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header className="nav-dark" style={{ position: 'sticky', top: 0, zIndex: 20 }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 70 }}>
          <Link href="/" className="brand" style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20 }}><Logo /> Loady</Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a href="#how" style={{ fontWeight: 600, fontSize: 14.5 }}>How it works</a>
            <a href="#features" style={{ fontWeight: 600, fontSize: 14.5 }}>Features</a>
            <a href="#pricing" style={{ fontWeight: 600, fontSize: 14.5 }}>Pricing</a>
            <Link className="btn btn-sm" href="/login" style={{ background: 'transparent', color: '#eef3fb', border: '1px solid var(--night-line)' }}>Log in</Link>
            <Link className="btn btn-primary btn-sm btn-shine" href="/signup">Get started</Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-glow" style={{ width: 520, height: 520, background: 'radial-gradient(circle, rgba(15,182,166,.40), transparent 60%)', top: -140, right: -80 }} />
        <div className="hero-glow" style={{ width: 380, height: 380, background: 'radial-gradient(circle, rgba(232,179,74,.22), transparent 60%)', top: 140, left: -120, animationDelay: '1.5s' }} />

        <div className="container hero-cols" style={{ position: 'relative', zIndex: 1, padding: '74px 24px 60px' }}>
          {/* Left */}
          <div>
            <span className="pill on-dark" style={{ animation: 'fadeUp .6s both' }}>◆ Payments for clubs, on autopilot</span>
            <h1 style={{ marginTop: 20, fontSize: 'clamp(2.5rem, 5.2vw, 4.1rem)', lineHeight: 1.04, animation: 'fadeUp .6s .05s both' }}>
              Run your club’s <span className="grad-text">deposits&nbsp;&amp;&nbsp;cash-outs</span> on one bot.
            </h1>
            <p className="dim" style={{ fontSize: 19, marginTop: 22, maxWidth: 520, animation: 'fadeUp .6s .12s both' }}>
              Loady matches deposits straight to waiting cash-outs, holds risky payments, files every receipt and runs the
              queue — on Telegram &amp; Discord. Every club sealed in its own space. No servers, no spreadsheets.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 30, flexWrap: 'wrap', animation: 'fadeUp .6s .18s both' }}>
              <Link className="btn btn-primary btn-shine" href="/signup">Start your club →</Link>
              <a className="btn" href="#how" style={{ background: 'transparent', color: '#eef3fb', border: '1px solid var(--night-line)' }}>See how it works</a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 30, animation: 'fadeUp .6s .24s both' }}>
              {[['∞', 'clubs, isolated'], ['2', 'chat platforms'], ['0', 'servers to run']].map(([n, l]) => (
                <div key={l}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: '#fff' }}>{n}</div>
                  <div className="dim" style={{ fontSize: 12.5 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — live matching console */}
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center', minHeight: 440 }}>
            <div className="console">
              <div className="console-top">
                <span className="console-title">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="" width={22} height={22} style={{ display: 'block' }} />
                  Live queue
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#9fb0c6' }}><span className="live-dot" /> matching</span>
              </div>
              <div className="led-row" style={{ animationDelay: '.15s' }}>
                <span className="led-ic in">↓</span>
                <div><div className="led-name">Deposit · Marcus</div><div className="led-sub">Venmo · just now</div></div>
                <span className="led-amt pos">+$300</span>
              </div>
              <div className="led-row" style={{ animationDelay: '.5s' }}>
                <span className="led-ic out">↑</span>
                <div><div className="led-name">Cash-out · Priya</div><div className="led-sub">waiting 4m · ClubGG</div></div>
                <span className="led-amt neg">−$300</span>
              </div>
              <div className="console-match">✓ Matched — paid directly, float untouched</div>
              <div className="led-row" style={{ animationDelay: '1.9s', marginTop: 8, marginBottom: 0 }}>
                <span className="led-ic in">🧾</span>
                <div><div className="led-name">Receipt filed</div><div className="led-sub">auto-attached to both sides</div></div>
                <span className="led-amt" style={{ color: '#9fb0c6' }}>#4821</span>
              </div>
            </div>
          </div>
        </div>
        <div className="hero-hem" />
      </section>

      {/* ── Methods marquee ─────────────────────────────────────────────────── */}
      <section style={{ padding: '20px 0 8px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container" style={{ textAlign: 'center', marginBottom: 16 }}><span className="dim" style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>Works with the methods your players already use</span></div>
        <div className="marquee">
          <div className="marquee-track">
            <span>{METHODS.join('   ')}</span>
            <span>{METHODS.join('   ')}</span>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section id="how" className="container" style={{ padding: '76px 24px' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 48 }}>
          <span className="pill">Live in minutes</span>
          <h2 style={{ marginTop: 16 }}>Three steps, then it runs itself</h2>
        </Reveal>
        <div className="steps grid cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 120}>
              <div style={{ textAlign: 'center', padding: '0 8px' }}>
                <div className="step-num" style={{ margin: '0 auto 18px' }}>{s.n}</div>
                <h3>{s.t}</h3>
                <p className="dim" style={{ marginTop: 8 }}>{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Bento features ──────────────────────────────────────────────────── */}
      <section id="features" className="container" style={{ padding: '20px 24px 76px' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 44 }}>
          <span className="pill">The engine</span>
          <h2 style={{ marginTop: 16 }}>Everything a club needs, nothing it doesn’t</h2>
          <p className="dim" style={{ marginTop: 12 }}>The money machine we run in production — now yours in a few clicks.</p>
        </Reveal>
        <div className="bento">
          <Reveal className="wide">
            <div className="card card-hover" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, alignItems: 'center', background: 'linear-gradient(120deg, #ffffff, #f2fbfa)' }}>
              <div>
                <div className="feature-ico"><Ico d="M4 12h6l2-4 4 8 2-4h2" /></div>
                <h3 style={{ fontSize: 22 }}>Peer-to-peer matching</h3>
                <p className="dim" style={{ marginTop: 8, maxWidth: 460 }}>Deposits pay waiting cash-outs directly, oldest first — your float never touches most of the money. When nobody’s queued, it falls back to your club account automatically.</p>
              </div>
              <FlowArt />
            </div>
          </Reveal>
          {[
            ['Reversible holds', 'Card, PayPal & bank sit on a chargeback hold; crypto and cash clear instantly. Your call, per method.', 'M12 3l7 4v5c0 4-3 7-7 9-4-2-7-5-7-9V7z'],
            ['Every cent on a ledger', 'Double-entry books that always balance, a permanent audit log, and a receipt for every payment.', 'M4 4h16v16H4zM4 9h16M9 9v11'],
            ['Your admins, your rules', 'Invite your team, set per-cash-out minimums, reorder the queue, pay from float — tracked to a name.', 'M17 20v-2a4 4 0 0 0-8 0v2M13 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
            ['Sealed per club', 'The same bot serves everyone, but the database itself refuses to show another club your books.', 'M6 10V7a4 4 0 0 1 8 0v3M5 10h10v9H5z'],
          ].map(([t, d, icon], i) => (
            <Reveal key={t} delay={i * 80}>
              <div className="card card-hover" style={{ height: '100%' }}>
                <div className="feature-ico"><Ico d={icon!} /></div>
                <h3>{t}</h3>
                <p className="dim" style={{ marginTop: 8 }}>{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Value band ──────────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--ink)', color: '#fff', padding: '56px 0' }}>
        <div className="container grid cols-4" style={{ textAlign: 'center' }}>
          {[['1', 'shared bot, your space'], ['2', 'platforms — TG & Discord'], ['∞', 'clubs, fully isolated'], ['0', 'servers to run']].map(([n, l], i) => (
            <Reveal key={l} delay={i * 90}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 46, color: '#3dd3c3', letterSpacing: '-0.03em' }}>{n}</div>
              <div style={{ color: '#aab6c8', fontSize: 14, marginTop: 4 }}>{l}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="container" style={{ padding: '76px 24px 40px' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 44 }}>
          <span className="pill">Simple pricing</span>
          <h2 style={{ marginTop: 16 }}>One plan. Everything included.</h2>
          <p className="dim" style={{ marginTop: 12 }}>No tiers, no upsells, no cut of your volume. Cancel anytime.</p>
        </Reveal>
        <Reveal style={{ maxWidth: 460, margin: '0 auto' }}>
          <div className="card" style={{ borderColor: 'var(--accent)', boxShadow: 'var(--shadow)', position: 'relative', padding: 30 }}>
            <span className="pill" style={{ position: 'absolute', top: -13, left: 30 }}>Everything, one price</span>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20 }}>Loady</div>
            <div style={{ margin: '16px 0 20px', display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 52, letterSpacing: '-0.03em' }}>${PLAN.price}</span>
              <span className="muted">/ month per club</span>
            </div>
            <Link className="btn btn-primary btn-shine" href="/signup" style={{ width: '100%' }}>Start your club →</Link>
            <ul style={{ listStyle: 'none', padding: 0, margin: '22px 0 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {PLAN.features.map((f) => <li key={f} style={{ display: 'flex', gap: 9, fontSize: 13.5, color: 'var(--ink-dim)' }}><Check /> {f}</li>)}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="container" style={{ padding: '40px 24px 84px' }}>
        <Reveal>
          <div style={{ position: 'relative', overflow: 'hidden', textAlign: 'center', padding: '60px 24px', borderRadius: 26, background: 'linear-gradient(120deg, #0a998c, #0fb6a6 45%, #2fb3e6)', color: '#fff', boxShadow: 'var(--shadow-lg)' }}>
            <div className="hero-glow" style={{ width: 300, height: 300, background: 'radial-gradient(circle, rgba(255,255,255,.35), transparent 60%)', top: -80, left: '30%' }} />
            <h2 style={{ color: '#fff', position: 'relative', fontSize: 'clamp(1.8rem,3.5vw,2.6rem)' }}>Run your club the easy way.</h2>
            <p style={{ color: 'rgba(255,255,255,.9)', marginTop: 12, position: 'relative' }}>Spin up your space in minutes. Connect a chat and you’re live.</p>
            <Link className="btn btn-shine" href="/signup" style={{ marginTop: 26, background: '#fff', color: 'var(--accent-strong)', position: 'relative', fontWeight: 700 }}>Get started free →</Link>
          </div>
        </Reveal>
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
  // Local robot mascot (transparent PNG). Plain <img> — no next/image config needed.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.png" alt="Loady" width={30} height={30} style={{ display: 'block', objectFit: 'contain' }} />;
}
function Ico({ d }: { d: string }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
}
function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden>
      <circle cx="10" cy="10" r="10" fill="var(--accent-soft)" />
      <path d="M6 10.5l2.5 2.5L14 7.5" stroke="var(--accent-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
/** A tiny deposit → cash-out flow illustration for the bento hero cell. */
function FlowArt() {
  return (
    <svg viewBox="0 0 220 140" width="100%" style={{ maxWidth: 240 }} aria-hidden>
      <defs><linearGradient id="fl" x1="0" x2="1"><stop offset="0" stopColor="#0fb6a6" /><stop offset="1" stopColor="#2fb3e6" /></linearGradient></defs>
      <rect x="6" y="20" width="80" height="34" rx="9" fill="#fff" stroke="var(--border)" />
      <text x="46" y="41" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink)">Deposit</text>
      <rect x="134" y="20" width="80" height="34" rx="9" fill="#fff" stroke="var(--border)" />
      <text x="174" y="41" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink)">Cash-out</text>
      <path d="M86 37 H134" stroke="url(#fl)" strokeWidth="2.5" strokeDasharray="5 5" />
      <circle r="4" fill="var(--accent)"><animateMotion dur="2.2s" repeatCount="indefinite" path="M86 37 H134" /></circle>
      <rect x="70" y="92" width="80" height="34" rx="9" fill="var(--accent-soft)" stroke="var(--accent)" />
      <text x="110" y="113" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--accent-strong)">Matched ✓</text>
      <path d="M46 54 Q46 92 70 105" stroke="var(--border-strong)" strokeWidth="2" fill="none" />
      <path d="M174 54 Q174 92 150 105" stroke="var(--border-strong)" strokeWidth="2" fill="none" />
    </svg>
  );
}
