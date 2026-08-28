'use server';

import { withAccount } from '@loady/core';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/session';

/** Mark a verified deposit as loaded — the chips are now on the player's account. */
export async function markLoaded(form: FormData) {
  const ctx = await getCtx();
  if (!ctx) return;
  const id = String(form.get('id') ?? '');
  if (!id) return;
  await withAccount(ctx.accountId, (sql) => sql`
    update fills set loaded_at = now(), loaded_by = ${ctx.memberId}
     where id = ${id} and status = 'released' and deposit_id is not null and loaded_at is null`);
  revalidatePath('/jobs');
  revalidatePath('/dashboard');
}
