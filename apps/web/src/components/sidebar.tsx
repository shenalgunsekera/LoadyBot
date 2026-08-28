'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV: { href: string; label: string; icon: string }[] = [
  { href: '/dashboard', label: 'Overview', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
  { href: '/deposits', label: 'Deposits', icon: 'M12 3v12M7 10l5 5 5-5M4 21h16' },
  { href: '/withdrawals', label: 'Withdrawals', icon: 'M12 21V9M7 14l5-5 5 5M4 3h16' },
  { href: '/jobs', label: 'Load chips', icon: 'M20 7L9 18l-5-5' },
  { href: '/players', label: 'Players', icon: 'M17 20v-2a4 4 0 0 0-8 0v2M13 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0M21 20v-2a4 4 0 0 0-3-3.8' },
  { href: '/transactions', label: 'Transactions', icon: 'M4 7h16M4 12h16M4 17h10' },
  { href: '/connect', label: 'Connect chats', icon: 'M8 12h8M12 8v8M4 4h16v16H4z' },
  { href: '/methods', label: 'Payment methods', icon: 'M3 7h18v10H3zM3 11h18' },
  { href: '/team', label: 'Team', icon: 'M17 20v-2a4 4 0 0 0-8 0v2M13 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0M21 20v-2a4 4 0 0 0-3-3.8' },
  { href: '/billing', label: 'Billing', icon: 'M3 6h18v12H3zM3 10h18' },
  { href: '/settings', label: 'Settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.3 1a7 7 0 0 0-1.7-1l-.3-2.5H9.4l-.3 2.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.4L5 11a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.3 2.5h4.2l.3-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.6a7 7 0 0 0 .1-1z' },
];

export function Sidebar({ accountName }: { accountName: string }) {
  const path = usePathname();
  return (
    <aside style={{ width: 244, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
      <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Loady" width={28} height={28} style={{ display: 'block', objectFit: 'contain' }} />
        Loady
      </div>
      <nav style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {NAV.map((n) => {
          const active = path === n.href || path.startsWith(n.href + '/');
          return (
            <Link key={n.href} href={n.href}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 10, fontSize: 14.5, fontWeight: 600,
                color: active ? 'var(--accent-ink)' : 'var(--ink-dim)', background: active ? 'var(--accent-soft)' : 'transparent' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={n.icon} /></svg>
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, background: 'var(--surface-2)' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--ink)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{accountName.slice(0, 1).toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{accountName}</div>
            <form action="/logout" method="post" style={{ margin: 0 }}>
              <button type="submit" style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}>Sign out</button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}
