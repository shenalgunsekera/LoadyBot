'use client';

import { useActionState } from 'react';
import { opLoginAction } from './actions';
import type { AuthState } from '@/lib/auth-types';
import { SentNotice } from '@/components/sent-notice';

const INIT: AuthState = { ok: false };

export function OpLoginForm() {
  const [state, action, pending] = useActionState(opLoginAction, INIT);
  if (state.sent) return <SentNotice email={state.email!} devLink={state.devLink} />;

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="field">
        <label htmlFor="email">Operator email</label>
        <input id="email" name="email" type="email" placeholder="you@loady.app" autoComplete="email" required />
      </div>
      {state.error && <div className="badge red" style={{ padding: '8px 12px' }}>{state.error}</div>}
      <button className="btn btn-primary btn-shine" type="submit" disabled={pending} style={{ width: '100%' }}>
        {pending ? 'Sending…' : 'Send operator link'}
      </button>
    </form>
  );
}
