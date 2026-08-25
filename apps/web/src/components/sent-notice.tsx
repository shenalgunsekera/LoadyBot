export function SentNotice({ email, devLink }: { email: string; devLink?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent-strong)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v12H4zM4 7l8 6 8-6" /></svg>
      </div>
      <h3 style={{ fontSize: 20 }}>Check your email</h3>
      <p className="dim" style={{ marginTop: 8 }}>We sent a sign-in link to <strong>{email}</strong>. It expires in 30 minutes.</p>

      {devLink && (
        <div style={{ marginTop: 20, padding: 14, borderRadius: 12, background: 'var(--warn-soft)', border: '1px solid #f0dcae', textAlign: 'left' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--warn)', marginBottom: 6 }}>DEV MODE · email not configured</div>
          <a href={devLink} style={{ color: 'var(--accent-strong)', fontWeight: 600, fontSize: 13, wordBreak: 'break-all' }}>{devLink}</a>
        </div>
      )}
    </div>
  );
}
