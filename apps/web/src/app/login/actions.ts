'use server';

import { memberExists, sendMagicLink } from '@/lib/auth';
import type { AuthState } from '@/lib/auth-types';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function loginAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (!(await memberExists(email))) return { ok: false, error: 'No club found for that email. Want to sign up instead?' };
  const { devLink } = await sendMagicLink(email);
  return { ok: true, sent: true, email, devLink };
}
