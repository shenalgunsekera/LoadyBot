'use server';

import { withAccount, notifyPlayer } from '@loady/core';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/session';

const money = (c: number) => `$${(Number(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function verifyDeposit(form: FormData) {
  const ctx = await getCtx();
  if (!ctx) return;
  const id = String(form.get('id') ?? '');
  if (!id) return;
  try {
    const [info] = await withAccount(ctx.accountId, async (sql) => {
      await sql`select fill_release(${id}, ${ctx.memberId}, 'verified from dashboard')`;
      return sql<{ depositor: string | null; amount: number; credit: number | null; payee: string | null; w_total: number | null; w_remaining: number | null }[]>`
        select d.player_id as depositor, f.amount, f.credit_amount as credit,
               w.player_id as payee, w.amount as w_total, w.amount_remaining as w_remaining
          from fills f
          left join deposit_requests d on d.id = f.deposit_id
          left join withdraw_requests w on w.id = f.withdraw_id
         where f.id = ${id}`;
    });
    if (info?.depositor) await notifyPlayer(ctx.accountId, info.depositor,
      `✅ *Your ${money(info.credit ?? info.amount)} deposit was verified* and added to your account. You can /withdraw anytime.`);
    if (info?.payee) await notifyPlayer(ctx.accountId, info.payee,
      Number(info.w_remaining) > 0
        ? `✅ *${money(info.amount)} has been sent* for your cash-out. ${money(Number(info.w_remaining))}/${money(Number(info.w_total))} still to be sent.`
        : `✅ *${money(info.amount)} has been sent — your cash-out is complete.* 🎉`);
  } catch { /* surfaced on refresh */ }
  revalidatePath('/deposits');
  revalidatePath('/dashboard');
}

export async function discardDeposit(form: FormData) {
  const ctx = await getCtx();
  if (!ctx) return;
  const id = String(form.get('id') ?? '');
  if (!id) return;
  await withAccount(ctx.accountId, (sql) => sql`update fills set status = 'discarded' where id = ${id} and status = 'awaiting_confirmation'`);
  revalidatePath('/deposits');
  revalidatePath('/dashboard');
}
