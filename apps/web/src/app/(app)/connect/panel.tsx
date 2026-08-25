'use client';

import { useState, useTransition } from 'react';
import { generateConnectCode } from './actions';

export function ConnectPanel({ discordInvite }: { discordInvite: string | null }) {
  return (
    <div className="grid cols-2">
      <PlatformCard platform="discord" invite={discordInvite} />
      <PlatformCard platform="telegram" invite={null} />
    </div>
  );
}

function PlatformCard({ platform, invite }: { platform: 'telegram' | 'discord'; invite: string | null }) {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const isTg = platform === 'telegram';
  const generate = () => start(async () => {
    const r = await generateConnectCode(platform);
    if (r.ok && r.code) { setCode(r.code); setCopied(false); }
  });
  const copy = () => { if (code) { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } };

  return (
    <div className="card">
      <Head platform={platform} />
      <p className="dim" style={{ marginTop: 10 }}>
        {isTg
          ? <>Add <strong>@LoadyBot</strong> to your group, then paste the code below in the chat.</>
          : <>Add Loady to your server, then paste the code in any channel to link it.</>}
      </p>

      {!isTg && (
        <a className={`btn ${invite ? 'btn-primary' : 'btn-ghost'}`} href={invite ?? '#'} target={invite ? '_blank' : undefined} rel="noreferrer"
           style={{ width: '100%', marginTop: 14, pointerEvents: invite ? undefined : 'none', opacity: invite ? 1 : 0.55 }}>
          {invite ? 'Add to Discord server' : 'Add to Discord (configure bot first)'}
        </a>
      )}

      {code ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="mono" style={{ flex: 1, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, border: '1px solid var(--accent)', background: 'var(--accent-soft)', letterSpacing: 2, fontWeight: 800, fontSize: 18, color: 'var(--accent-ink)' }}>{code}</div>
            <button className="btn btn-ghost" onClick={copy} type="button">{copied ? 'Copied ✓' : 'Copy'}</button>
          </div>
          <p className="stat-note" style={{ marginTop: 10 }}>
            In your {isTg ? 'group' : 'server'}, send <span className="mono">{isTg ? `/connect ${code}` : `connect ${code}`}</span>. Expires in 15 min.
          </p>
        </div>
      ) : (
        <button className="btn btn-dark" onClick={generate} disabled={pending} type="button" style={{ width: '100%', marginTop: 14 }}>
          {pending ? 'Generating…' : 'Generate connect code'}
        </button>
      )}
    </div>
  );
}

function Head({ platform }: { platform: 'telegram' | 'discord' }) {
  const color = platform === 'discord' ? '#5865F2' : '#229ED9';
  const title = platform === 'discord' ? 'Discord' : 'Telegram';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: color, display: 'grid', placeItems: 'center' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden>
          {platform === 'discord'
            ? <path d="M19.3 5.3A16 16 0 0 0 15.4 4l-.2.4a12 12 0 0 1 3.5 1.8 11 11 0 0 0-9.4 0A12 12 0 0 1 12.8 4.4L12.6 4a16 16 0 0 0-3.9 1.3C6 9 5.3 12.6 5.6 16.1A16 16 0 0 0 10.4 18l.4-.6a10 10 0 0 1-1.6-.8l.4-.3a8 8 0 0 0 6.8 0l.4.3a10 10 0 0 1-1.6.8l.4.6a16 16 0 0 0 4.8-1.9c.4-4.1-.6-7.6-2.5-10.7zM9.7 14c-.8 0-1.4-.7-1.4-1.6s.6-1.6 1.4-1.6 1.4.7 1.4 1.6-.6 1.6-1.4 1.6zm4.6 0c-.8 0-1.4-.7-1.4-1.6s.6-1.6 1.4-1.6 1.4.7 1.4 1.6-.6 1.6-1.4 1.6z" />
            : <path d="M21.9 4.3l-3.3 15.5c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-4.9L18 5.3c.4-.3-.1-.5-.6-.2L7.3 13 2.6 11.5c-1-.3-1-1 .2-1.5L20.6 3c.9-.3 1.6.2 1.3 1.3z" />}
        </svg>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>{title}</div>
    </div>
  );
}
