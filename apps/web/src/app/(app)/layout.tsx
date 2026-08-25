import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { getCtx } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar accountName={ctx.accountName} />
      <main style={{ flex: 1, minWidth: 0, padding: '28px 32px 64px', maxWidth: 1080 }}>{children}</main>
    </div>
  );
}
