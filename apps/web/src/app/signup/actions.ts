'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { signUp, createMemberSession, SESSION_COOKIE } from '@/lib/auth';
import type { AuthState } from '@/lib/auth-types';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function signUpAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirm') ?? '');
  if (name.length < 2) return { ok: false, error: 'Enter your club name.' };
  if (!EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };
  if (password !== confirm) return { ok: false, error: 'Passwords don’t match.' };

  const r = await signUp({ name, email, password });
  if (!r.ok) return { ok: false, error: r.error };
  const sid = await createMemberSession(r.memberId);
  (await cookies()).set('sid', sid, SESSION_COOKIE);
  redirect('/dashboard');
}
