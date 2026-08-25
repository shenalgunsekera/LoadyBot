'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction } from './actions';
import type { AuthState } from '@/lib/auth-types';

const INIT: AuthState = { ok: false };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, INIT);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" placeholder="you@club.com" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
      {state.error && <div className="badge red" style={{ padding: '8px 12px' }}>{state.error}</div>}
      <button className="btn btn-primary btn-shine" type="submit" disabled={pending} style={{ width: '100%' }}>{pending ? 'Signing in…' : 'Log in'}</button>
      <p className="dim" style={{ fontSize: 13, textAlign: 'center' }}>New here? <Link href="/signup" style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>Create a club</Link></p>
    </form>
  );
}
