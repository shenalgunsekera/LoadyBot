import { AuthShell } from '@/components/auth-shell';
import { OpLoginForm } from './form';

export const dynamic = 'force-dynamic';

export default function OpLoginPage() {
  return (
    <AuthShell title="Operator sign-in" subtitle="Loady operations — manage customers and bot access.">
      <OpLoginForm />
    </AuthShell>
  );
}
