'use client';

// Catches errors anywhere — including the root and (app) layouts, which a
// segment error.tsx can't. Must render its own <html>/<body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f4f7fb', color: '#0d1b2e' }}>
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ maxWidth: 460, textAlign: 'center', background: '#fff', border: '1px solid #e5ebf2', borderRadius: 18, padding: 28 }}>
            <h2 style={{ margin: '0 0 8px' }}>Something went wrong</h2>
            <p style={{ color: '#52627a', margin: '0 0 16px' }}>The page hit an error while loading. Try again, or sign back in.</p>
            {error.digest && <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#8593a8', margin: '0 0 16px' }}>ref: {error.digest}</p>}
            <button onClick={reset} style={{ height: 44, padding: '0 20px', borderRadius: 999, border: 'none', background: '#3d9bf0', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Try again</button>
          </div>
        </div>
      </body>
    </html>
  );
}
