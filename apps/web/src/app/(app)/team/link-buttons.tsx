'use client';

import { useState, useTransition } from 'react';
import { generateLinkCode } from './actions';

export function LinkButtons({ memberId, tgLinked, dcLinked }: { memberId: string; tgLinked: boolean; dcLinked: boolean }) {
  const [code, setCode] = useState<{ platform: string; value: string } | null>(null);
  const [pending, start] = useTransition();
  const make = (platform: 'telegram' | 'discord') => start(async () => {
    const r = await generateLinkCode(memberId, platform);
    if (r.ok && r.code) setCode({ platform, value: r.code });
  });

  if (code) {
    const cmd = code.platform === 'telegram' ? `/link ${code.value}` : `link ${code.value}`;
    const where = code.platform === 'telegram' ? '@TLoadyBot' : 'your Discord server';
    return (
      <div style={{ fontSize: 12.5 }}>
        <span className="dim">Send </span><span className="mono" style={{ fontWeight: 700, color: 'var(--accent-strong)' }}>{cmd}</span><span className="dim"> to {where}</span>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8, height: 26, padding: '0 8px' }} onClick={() => setCode(null)}>done</button>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
      <button className="btn btn-ghost btn-sm" style={{ height: 28 }} disabled={pending} onClick={() => make('telegram')}>{tgLinked ? 'Telegram ✓' : 'Link Telegram'}</button>
      <button className="btn btn-ghost btn-sm" style={{ height: 28 }} disabled={pending} onClick={() => make('discord')}>{dcLinked ? 'Discord ✓' : 'Link Discord'}</button>
    </div>
  );
}
