'use server';

import { withAccount } from '@loady/core';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/session';

function refresh() { revalidatePath('/withdrawals'); revalidatePath('/dashboard'); }

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
  refresh();
}

/** Take a cash-out out of the queue so nobody fills or pays it. */
export async function pauseWithdraw(form: FormData) {
  const ctx = await getCtx();
  if (!ctx) return;
  const id = String(form.get('id') ?? '');
  if (!id) return;
  try { await withAccount(ctx.accountId, (sql) => sql`select withdraw_pause(${id})`); } catch { /* surfaced on refresh */ }
  refresh();
}

/** Put a paused cash-out back into the queue at its place. */
export async function resumeWithdraw(form: FormData) {
  const ctx = await getCtx();
  if (!ctx) return;
  const id = String(form.get('id') ?? '');
  if (!id) return;
  try { await withAccount(ctx.accountId, (sql) => sql`select withdraw_resume(${id})`); } catch { /* surfaced on refresh */ }
  refresh();
}
