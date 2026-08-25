'use server';

import { db } from '@loady/core';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/session';

// Unambiguous alphabet (no 0/O/1/I) for a code people type into a chat.
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const gen = () => 'LOADY-' + Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');

/** Mint a one-time connect code for this account + platform (15-minute expiry). */
export async function generateConnectCode(platform: 'telegram' | 'discord'): Promise<{ ok: boolean; code?: string; error?: string }> {
  const ctx = await getCtx();
  if (!ctx) return { ok: false, error: 'Not signed in.' };
  for (let i = 0; i < 12; i++) {
    const code = gen();
    try {
      await db()`insert into connect_codes (code, account_id, platform, created_by, expires_at)
                 values (${code}, ${ctx.accountId}, ${platform}, ${ctx.memberId}, now() + interval '15 minutes')`;
      return { ok: true, code };
    } catch { /* PK collision — try another */ }
  }
  return { ok: false, error: 'Please try again.' };
}

/** Unlink a connected chat (scoped to this account). */
export async function disconnectChat(form: FormData) {
  const ctx = await getCtx();
  if (!ctx) return;
  const id = String(form.get('id') ?? '');
  if (id) await db()`delete from chat_bindings where id = ${id} and account_id = ${ctx.accountId}`;
  revalidatePath('/connect');
}
