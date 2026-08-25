'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { login, createMemberSession, SESSION_COOKIE } from '@/lib/auth';
import type { AuthState } from '@/lib/auth-types';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function loginAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  const memberId = await login(email, password);
  if (!memberId) return { ok: false, error: 'Wrong email or password.' };
  const sid = await createMemberSession(memberId);
  (await cookies()).set('sid', sid, SESSION_COOKIE);
  redirect('/dashboard');
}
