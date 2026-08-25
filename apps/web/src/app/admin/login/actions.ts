'use server';

import { isPlatformAdmin, sendMagicLink } from '@/lib/auth';
import type { AuthState } from '@/lib/auth-types';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function opLoginAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (!(await isPlatformAdmin(email))) return { ok: false, error: 'That email isn’t a Loady operator.' };
  const { devLink } = await sendMagicLink(email);
  return { ok: true, sent: true, email, devLink };
}
