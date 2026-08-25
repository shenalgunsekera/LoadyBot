'use server';

import { withAccount } from '@loady/core';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/session';

/** Pay a queued cash-out from the owner's float (whole remaining, or a part). */
export async function payFromFloat(form: FormData) {
  const ctx = await getCtx();
  if (!ctx) return;
  const id = String(form.get('id') ?? '');
  const raw = String(form.get('amount') ?? '').trim();
  const cents = raw ? Math.round(parseFloat(raw) * 100) : null;
  if (!id || (raw && (!Number.isFinite(cents) || cents! <= 0))) return;
  try {
    await withAccount(ctx.accountId, (sql) => sql`select withdraw_club_payout(${id}, ${ctx.memberId}, ${cents}, 'paid from dashboard')`);
  } catch { /* surfaced on refresh */ }
  revalidatePath('/withdrawals');
  revalidatePath('/dashboard');
}
