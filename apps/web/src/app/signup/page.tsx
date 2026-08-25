import { AuthShell } from '@/components/auth-shell';
import { SignupForm } from './form';

export const dynamic = 'force-dynamic';

export default function SignupPage() {
  return (
    <AuthShell title="Create your club" subtitle="Your space spins up instantly — methods, limits and admins, all yours.">
      <SignupForm />
    </AuthShell>
  );
}
