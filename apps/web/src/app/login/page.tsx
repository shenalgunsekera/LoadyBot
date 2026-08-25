import { AuthShell } from '@/components/auth-shell';
import { LoginForm } from './form';

export const dynamic = 'force-dynamic';

const MSG: Record<string, string> = {
  expired: 'That link expired or was already used. Enter your email for a fresh one.',
  invalid: 'That link wasn’t valid. Enter your email to try again.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <AuthShell title="Welcome back" subtitle="We’ll email you a secure link — no password to remember.">
      {e && MSG[e] && <div className="badge warn" style={{ padding: '10px 12px', marginBottom: 16, width: '100%' }}>{MSG[e]}</div>}
      <LoginForm />
    </AuthShell>
  );
}
