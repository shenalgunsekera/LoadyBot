import Link from 'next/link';
import type { ReactNode } from 'react';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="auth-split" style={{ minHeight: '100vh' }}>
      {/* Brand panel */}
      <div className="auth-brand" style={{ position: 'relative', overflow: 'hidden', padding: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(150deg, #0a998c, #0fb6a6 45%, #2fb3e6)', color: '#fff' }}>
        <div className="hero-glow" style={{ width: 340, height: 340, background: 'radial-gradient(circle, rgba(255,255,255,.35), transparent 60%)', top: -100, right: -60 }} />
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, position: 'relative', color: '#fff' }}>
          <svg width="26" height="26" viewBox="0 0 26 26"><rect width="26" height="26" rx="8" fill="rgba(255,255,255,.2)" /><path d="M8 7v9.5A2.5 2.5 0 0 0 10.5 19H18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
          Loady
        </Link>
        <div style={{ position: 'relative' }}>
          <h2 style={{ color: '#fff', fontSize: 'clamp(1.6rem,2.4vw,2.2rem)' }}>Run your club’s payments the easy way.</h2>
          <p style={{ color: 'rgba(255,255,255,.85)', marginTop: 12, maxWidth: 380 }}>One bot, your own sealed-off space, live in minutes. Deposits matched, cash-outs queued, receipts filed.</p>
        </div>
        <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, position: 'relative' }}>Built on the engine we run in production.</div>
      </div>

      {/* Form panel */}
      <div style={{ display: 'grid', placeItems: 'center', padding: '32px' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h1 style={{ fontSize: 28 }}>{title}</h1>
          <p className="dim" style={{ marginTop: 8, marginBottom: 26 }}>{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
