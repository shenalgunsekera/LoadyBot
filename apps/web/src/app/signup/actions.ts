'use server';

import { provisionAccount, memberExists, sendMagicLink } from '@/lib/auth';
import type { AuthState } from '@/lib/auth-types';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function signUpAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const plan = String(form.get('plan') ?? 'pro');
  if (name.length < 2) return { ok: false, error: 'Enter your club name.' };
  if (!EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  try {
    // Idempotent: an existing member just gets a fresh magic link (no duplicate account).
    if (!(await memberExists(email))) await provisionAccount({ name, email, plan });
    const { devLink } = await sendMagicLink(email);
    return { ok: true, sent: true, email, devLink };
  } catch (err) {
    console.error('[signup] failed', err);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}
