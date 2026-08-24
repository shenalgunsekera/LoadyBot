export default function Connect() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 860 }}>
      <header>
        <h1 style={{ fontSize: 28 }}>Connect chats</h1>
        <p className="dim" style={{ marginTop: 6 }}>Add Loady where your players are. Each chat binds to your club automatically — nobody else can claim it.</p>
      </header>

      <div className="grid cols-2">
        {/* Discord — one-click OAuth */}
        <div className="card">
          <Head icon="discord" title="Discord" />
          <p className="dim" style={{ marginTop: 10 }}>One click adds Loady to your server. When it joins, the server binds to your club automatically.</p>
          {/* TODO(oauth): href = Discord authorize URL with client_id + state=<signed account id>.
              The bot's GUILD_CREATE handler reads the state and calls redeemConnectCode/bind. */}
          <a className="btn btn-primary" href="#" style={{ marginTop: 16, width: '100%' }}>Add to Discord server</a>
          <p className="stat-note" style={{ marginTop: 10 }}>You’ll pick which channels are the payments &amp; admin feeds after it joins.</p>
        </div>

        {/* Telegram — hands-free or code */}
        <div className="card">
          <Head icon="telegram" title="Telegram" />
          <p className="dim" style={{ marginTop: 10 }}>Add <strong>@LoadyBot</strong> to your group, then either add it while signed in here (hands-free) or paste the code below.</p>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            {/* TODO(api): POST /api/connect-code → one-time code (connect_codes table) */}
            <div className="mono" style={{ flex: 1, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, border: '1px dashed var(--border-strong)', background: 'var(--surface-2)', letterSpacing: 2, fontWeight: 700, fontSize: 18 }}>LOADY-7F3K</div>
            <button className="btn btn-ghost">Copy</button>
          </div>
          <p className="stat-note" style={{ marginTop: 10 }}>In your group, send <span className="mono">/connect LOADY-7F3K</span>. Expires in 15 minutes.</p>
        </div>
      </div>

      {/* Connected chats */}
      <div>
        <h3 style={{ marginBottom: 12 }}>Connected chats</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Chat</th><th>Platform</th><th>Role</th><th style={{ width: 90 }} /></tr></thead>
            <tbody>
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>No chats connected yet — add one above.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Head({ icon, title }: { icon: 'discord' | 'telegram'; title: string }) {
  const color = icon === 'discord' ? '#5865F2' : '#229ED9';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: color, display: 'grid', placeItems: 'center' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden>
          {icon === 'discord'
            ? <path d="M19.3 5.3A16 16 0 0 0 15.4 4l-.2.4a12 12 0 0 1 3.5 1.8 11 11 0 0 0-9.4 0A12 12 0 0 1 12.8 4.4L12.6 4a16 16 0 0 0-3.9 1.3C6 9 5.3 12.6 5.6 16.1A16 16 0 0 0 10.4 18l.4-.6a10 10 0 0 1-1.6-.8l.4-.3a8 8 0 0 0 6.8 0l.4.3a10 10 0 0 1-1.6.8l.4.6a16 16 0 0 0 4.8-1.9c.4-4.1-.6-7.6-2.5-10.7zM9.7 14c-.8 0-1.4-.7-1.4-1.6s.6-1.6 1.4-1.6 1.4.7 1.4 1.6-.6 1.6-1.4 1.6zm4.6 0c-.8 0-1.4-.7-1.4-1.6s.6-1.6 1.4-1.6 1.4.7 1.4 1.6-.6 1.6-1.4 1.6z" />
            : <path d="M21.9 4.3l-3.3 15.5c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-4.9L18 5.3c.4-.3-.1-.5-.6-.2L7.3 13 2.6 11.5c-1-.3-1-1 .2-1.5L20.6 3c.9-.3 1.6.2 1.3 1.3z" />}
        </svg>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>{title}</div>
    </div>
  );
}
