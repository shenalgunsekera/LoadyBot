import { AuthShell } from '@/components/auth-shell';
import { SignupForm } from './form';

export const dynamic = 'force-dynamic';

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  const chosen = ['starter', 'pro', 'scale'].includes(plan ?? '') ? plan! : 'pro';
  return (
    <AuthShell title="Create your club" subtitle="Your space spins up instantly — methods, limits and admins, all yours.">
      <SignupForm plan={chosen} />
    </AuthShell>
  );
}
