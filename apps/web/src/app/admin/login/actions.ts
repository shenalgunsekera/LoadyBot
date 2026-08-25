'use server';

import { isPlatformAdmin, sendOperatorLink } from '@/lib/auth';
import type { AuthState } from '@/lib/auth-types';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function opLoginAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (!(await isPlatformAdmin(email))) return { ok: false, error: 'That email isn’t a Loady operator.' };
  const { devLink } = await sendOperatorLink(email);
  return { ok: true, sent: true, email, devLink };
}
