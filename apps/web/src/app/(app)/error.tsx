'use client';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 460, textAlign: 'center' }}>
        <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
        <p className="dim" style={{ marginBottom: 16 }}>
          This page hit an error while loading. Try again — if it keeps happening, refresh or sign back in.
        </p>
        {error.digest && <p className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>ref: {error.digest}</p>}
        <button className="btn btn-primary" onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
