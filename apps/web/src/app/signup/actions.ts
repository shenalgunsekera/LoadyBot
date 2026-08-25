'use server';

import { provisionAccount, memberExists, sendMagicLink } from '@/lib/auth';
import type { AuthState } from '@/lib/auth-types';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function signUpAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (name.length < 2) return { ok: false, error: 'Enter your club name.' };
  if (!EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  try {
    // One all-in plan. Idempotent: an existing member just gets a fresh link.
    if (!(await memberExists(email))) await provisionAccount({ name, email, plan: 'complete' });
    const { devLink } = await sendMagicLink(email);
    return { ok: true, sent: true, email, devLink };
  } catch (err) {
    console.error('[signup] failed', err);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}
