import { Sidebar } from '@/components/sidebar';
import { getCtx } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // TODO(auth): when getCtx() returns null, redirect('/login'). During early dev
  // we fall back to a demo label so the shell is browsable without auth wired.
  const ctx = await getCtx();
  const accountName = ctx?.accountName ?? 'Your club';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar accountName={accountName} />
      <main style={{ flex: 1, minWidth: 0, padding: '28px 32px 64px', maxWidth: 1080 }}>{children}</main>
    </div>
  );
}
