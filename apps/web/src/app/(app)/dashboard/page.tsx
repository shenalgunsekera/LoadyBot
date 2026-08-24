const STATS = [
  { label: "Cash you're holding", value: '$—', note: 'in your accounts' },
  { label: 'Owed to players', value: '$—', note: 'in play + waiting to pay out' },
  { label: 'Received (7 days)', value: '$—', note: 'deposits', pos: true },
  { label: 'Paid out (7 days)', value: '$—', note: 'cash-outs' },
];

export default function Overview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 28 }}>Overview</h1>
        <p className="dim" style={{ marginTop: 6 }}>Your money position, and everything waiting on a person.</p>
      </header>

      <div className="grid cols-4">
        {STATS.map((s) => (
          <div className="card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.pos ? 'pos' : ''}`}>{s.value}</div>
            <div className="stat-note">{s.note}</div>
          </div>
        ))}
      </div>

      {/* Wiring point: this reuses the money engine (fills/ledger) once ported per
          account. For now, a friendly empty state guides new accounts to connect. */}
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-strong)" strokeWidth="1.9" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </div>
        <h3>Connect a chat to go live</h3>
        <p className="dim" style={{ marginTop: 8, maxWidth: 420, marginInline: 'auto' }}>
          Add Loady to your Telegram group or Discord server and your players can start depositing.
          Your numbers show up here the moment money moves.
        </p>
        <a className="btn btn-primary" href="/connect" style={{ marginTop: 20 }}>Connect chats →</a>
      </div>
    </div>
  );
}
