'use server';

import { db } from '@loady/core';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/session';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const gen = () => 'LOADY-' + Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');

/** Add a teammate as an admin (or owner) of this club. */
export async function inviteMember(form: FormData) {
  const ctx = await getCtx();
  if (!ctx) return;
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const role = String(form.get('role') ?? 'admin') === 'owner' ? 'owner' : 'admin';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
  await db()`insert into account_members (account_id, email, role) values (${ctx.accountId}, ${email}, ${role})
             on conflict (account_id, email) do nothing`;
  // They sign in with a magic link (same passwordless flow) and link their bot identity below.
  revalidatePath('/team');
}

/** Mint a one-time code a member sends to the bot (/link CODE) to link identity. */
export async function generateLinkCode(memberId: string, platform: 'telegram' | 'discord'): Promise<{ ok: boolean; code?: string; error?: string }> {
  const ctx = await getCtx();
  if (!ctx) return { ok: false, error: 'Not signed in.' };
  const [m] = await db()`select id from account_members where id = ${memberId} and account_id = ${ctx.accountId}`;
  if (!m) return { ok: false, error: 'Unknown member.' };
  for (let i = 0; i < 12; i++) {
    const code = gen();
    try {
      await db()`insert into member_link_codes (code, account_id, member_id, platform, expires_at)
                 values (${code}, ${ctx.accountId}, ${memberId}, ${platform}, now() + interval '15 minutes')`;
      return { ok: true, code };
    } catch { /* collision */ }
  }
  return { ok: false, error: 'Please try again.' };
}
