'use server';

import { withAccount } from '@loady/core';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/session';

const cents = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Math.round(parseFloat(s) * 100);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export async function updateMethod(form: FormData) {
  const ctx = await getCtx();
  if (!ctx) return;
  const id = String(form.get('id') ?? '');
  if (!id) return;
  const enabled = form.get('enabled') === 'on';
  const payout = form.get('payout') === 'on';
  const settlement = String(form.get('settlement') ?? 'p2p') === 'company' ? 'company' : 'p2p';
  const handle = String(form.get('club_handle') ?? '').trim() || null;
  await withAccount(ctx.accountId, (sql) => sql`
    update payment_methods
       set enabled = ${enabled}, payout_enabled = ${payout}, settlement = ${settlement},
           club_handle = ${handle}, min_amount = ${cents(form.get('min'))}, max_amount = ${cents(form.get('max'))}
     where id = ${id}`);
  revalidatePath('/methods');
}

export async function addMethod(form: FormData) {
  const ctx = await getCtx();
  if (!ctx) return;
  const name = String(form.get('name') ?? '').trim();
  const code = String(form.get('code') ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!name || !code) return;
  await withAccount(ctx.accountId, (sql) => sql`
    insert into payment_methods (account_id, code, name) values (${ctx.accountId}, ${code}, ${name})
    on conflict (account_id, code) do nothing`);
  revalidatePath('/methods');
}
