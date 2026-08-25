'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction } from './actions';
import type { AuthState } from '@/lib/auth-types';
import { SentNotice } from '@/components/sent-notice';

const INIT: AuthState = { ok: false };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, INIT);
  if (state.sent) return <SentNotice email={state.email!} devLink={state.devLink} />;

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="field">
        <label htmlFor="email">Your email</label>
        <input id="email" name="email" type="email" placeholder="you@club.com" autoComplete="email" required />
      </div>
      {state.error && <div className="badge red" style={{ padding: '8px 12px' }}>{state.error}</div>}
      <button className="btn btn-primary btn-shine" type="submit" disabled={pending} style={{ width: '100%' }}>
        {pending ? 'Sending…' : 'Send me a sign-in link'}
      </button>
      <p className="dim" style={{ fontSize: 13, textAlign: 'center' }}>
        New here? <Link href="/signup" style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>Create a club</Link>
      </p>
    </form>
  );
}
