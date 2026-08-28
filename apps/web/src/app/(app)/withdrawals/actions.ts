'use server';

import { withAccount, notifyPlayer } from '@loady/core';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/session';

const money = (c: number) => `$${(Number(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    const info = await withAccount(ctx.accountId, async (sql) => {
      const [before] = await sql<{ remaining: number }[]>`select amount_remaining as remaining from withdraw_requests where id = ${id}`;
      await sql`select withdraw_club_payout(${id}, ${ctx.memberId}, ${cents}, 'paid from dashboard')`;
      const [w] = await sql<{ player_id: string; amount: number; amount_remaining: number }[]>`
        select player_id, amount, amount_remaining from withdraw_requests where id = ${id}`;
      return w ? { ...w, paid: (before?.remaining ?? w.amount_remaining) - w.amount_remaining } : undefined;
    });
    if (info) await notifyPlayer(ctx.accountId, info.player_id,
      info.amount_remaining > 0
        ? `✅ *${money(info.paid)} has been sent* for your cash-out. ${money(info.amount_remaining)}/${money(info.amount)} still to be sent.`
        : `✅ *${money(info.paid)} has been sent — your cash-out is complete.* 🎉`);
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
