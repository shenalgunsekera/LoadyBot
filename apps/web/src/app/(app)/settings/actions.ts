'use server';

import { withAccount } from '@loady/core';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/session';

const cents = (v: FormDataEntryValue | null, fallback: number) => {
  const s = String(v ?? '').trim();
  if (!s) return fallback;
  const n = Math.round(parseFloat(s) * 100);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export async function updateConfig(form: FormData) {
  const ctx = await getCtx();
  if (!ctx) return;
  await withAccount(ctx.accountId, (sql) => sql`
    update account_config
       set min_amount = ${cents(form.get('min'), 2000)},
           max_amount = ${cents(form.get('max'), 500000)},
           amount_step = ${cents(form.get('step'), 500)},
           reversible_allowed = ${form.get('reversible') === 'on'},
           in_development = ${form.get('in_development') === 'on'},
           updated_at = now()
     where account_id = ${ctx.accountId}`);
  revalidatePath('/settings');
}
