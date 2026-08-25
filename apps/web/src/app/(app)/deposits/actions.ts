'use server';

import { withAccount } from '@loady/core';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/session';

export async function verifyDeposit(form: FormData) {
  const ctx = await getCtx();
  if (!ctx) return;
  const id = String(form.get('id') ?? '');
  if (!id) return;
  try {
    await withAccount(ctx.accountId, (sql) => sql`select fill_release(${id}, ${ctx.memberId}, 'verified from dashboard')`);
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
