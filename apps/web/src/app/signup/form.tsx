'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signUpAction } from './actions';
import type { AuthState } from '@/lib/auth-types';

const INIT: AuthState = { ok: false };

export function SignupForm() {
  const [state, action, pending] = useActionState(signUpAction, INIT);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="field"><label htmlFor="name">Club name</label><input id="name" name="name" placeholder="e.g. APT" autoComplete="organization" required /></div>
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" placeholder="you@club.com" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" placeholder="at least 8 characters" autoComplete="new-password" required /></div>
      <div className="field"><label htmlFor="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></div>
      {state.error && <div className="badge red" style={{ padding: '8px 12px' }}>{state.error}</div>}
      <button className="btn btn-primary btn-shine" type="submit" disabled={pending} style={{ width: '100%' }}>{pending ? 'Creating…' : 'Create my club →'}</button>
      <p className="dim" style={{ fontSize: 13, textAlign: 'center' }}>Every feature included · free while you set up.</p>
      <p className="dim" style={{ fontSize: 13, textAlign: 'center' }}>Already have a club? <Link href="/login" style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>Log in</Link></p>
    </form>
  );
}
