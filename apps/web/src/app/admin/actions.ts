'use server';

import { db } from '@loady/core';
import { revalidatePath } from 'next/cache';
import { getOpCtx } from '@/lib/session';

/** Operator toggles a customer's bot access on/off. Suspended → the bots stand
 *  down for that club (isServiceable === false); active → they serve again. */
export async function toggleAction(form: FormData) {
  const op = await getOpCtx();
  if (!op) return;
  const id = String(form.get('id') ?? '');
  const activate = String(form.get('activate') ?? '') === '1';
  if (!id) return;
  if (activate) {
    await db()`update accounts set status = 'active', suspended_at = null, status_note = null where id = ${id}`;
  } else {
    await db()`update accounts set status = 'suspended', suspended_at = now(), status_note = 'switched off by operator' where id = ${id}`;
  }
  revalidatePath('/admin');
}
