import { cookies } from 'next/headers';
import { db } from '@loady/core';

export interface Ctx {
  accountId: string;
  accountName: string;
  memberId: string;
  email: string;
  role: 'owner' | 'admin';
}

/**
 * Resolve the logged-in member + their account from the session cookie.
 *
 * TODO(auth): this is the wiring point for the magic-link flow. The sessions and
 * login_tokens tables already exist (migration 0001). Once /login is built this
 * reads the `sid` cookie → sessions → account_members → accounts. Until then it
 * returns null so pages can render their signed-out / demo state.
 */
export async function getCtx(): Promise<Ctx | null> {
  const sid = (await cookies()).get('sid')?.value;
  if (!sid) return null;
  const [row] = await db()<Ctx[]>`
    select m.account_id, a.name as account_name, m.id as member_id, m.email, m.role
      from sessions s
      join account_members m on m.id = s.member_id
      join accounts a on a.id = m.account_id
     where s.token = ${sid} and s.expires_at > now()
     limit 1`;
  return row ?? null;
}
