'use server';

import { withAccount } from '@loady/core';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/session';

/** Put a player on hold (status → frozen) or take them off it. A held player
 *  keeps their money and anything already moving settles, but deposit_create /
 *  withdraw_create refuse anything new (both guard status = 'active'). */
export async function setHold(form: FormData) {
  const ctx = await getCtx();
  if (!ctx) return;
  const id = String(form.get('id') ?? '');
  const hold = String(form.get('hold') ?? '') === '1';
  if (!id) return;
  await withAccount(ctx.accountId, (sql) => sql`
    update players set status = ${hold ? 'frozen' : 'active'} where id = ${id}`);
  revalidatePath('/players');
}

/** Flag / clear a player for review. */
export async function setFlag(form: FormData) {
  const ctx = await getCtx();
  if (!ctx) return;
  const id = String(form.get('id') ?? '');
  const flag = String(form.get('flag') ?? '') === '1';
  if (!id) return;
  await withAccount(ctx.accountId, (sql) => sql`
    update players set flagged = ${flag} where id = ${id}`);
  revalidatePath('/players');
}

/** Rename a player + re-point one of their platform accounts (id / username). */
export async function editPlayer(form: FormData) {
  const ctx = await getCtx();
  if (!ctx) return;
  const id = String(form.get('id') ?? '');
  const name = String(form.get('name') ?? '').trim().slice(0, 60);
  const platformId = String(form.get('platformId') ?? '');
  const uid = String(form.get('uid') ?? '').trim();
  if (!id) return;
  await withAccount(ctx.accountId, async (sql) => {
    if (name) await sql`update players set display_name = ${name} where id = ${id}`;
    if (platformId && uid) await sql`select player_set_platform_full(${id}, ${platformId}, ${uid}, ${uid})`;
  });
  revalidatePath('/players');
}

/** Permanently erase a player and all their data. Refused (with a clear message)
 *  for anyone who has real ledger history — the books are append-only. */
export async function deletePlayer(id: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getCtx();
  if (!ctx) return { ok: false, error: 'Not signed in.' };
  if (!id) return { ok: false, error: 'No player.' };
  try {
    await withAccount(ctx.accountId, (sql) => sql`select player_delete(${id})`);
  } catch (e) {
    const msg = (e as { message?: string })?.message ?? '';
    if (/foreign key|violates|still referenced/i.test(msg)) {
      return { ok: false, error: 'This player has money history and can’t be fully erased. Put them on hold instead.' };
    }
    return { ok: false, error: msg.replace(/^error:\s*/i, '') || 'Could not delete.' };
  }
  revalidatePath('/players');
  return { ok: true };
}
