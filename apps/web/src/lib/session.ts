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
 * Resolve the logged-in member + their account from the `sid` session cookie.
 * Columns are aliased to camelCase to match Ctx — db() has no camel transform,
 * so a bare `m.account_id` would arrive as `account_id`, leaving ctx.accountId
 * undefined and crashing every page that scopes a query by it.
 */
export async function getCtx(): Promise<Ctx | null> {
  const sid = (await cookies()).get('sid')?.value;
  if (!sid) return null;
  const [row] = await db()<Ctx[]>`
    select m.account_id as "accountId", a.name as "accountName", m.id as "memberId", m.email, m.role
      from sessions s
      join account_members m on m.id = s.member_id
      join accounts a on a.id = m.account_id
     where s.token = ${sid} and s.expires_at > now()
     limit 1`;
  return row ?? null;
}

export interface OpCtx { adminId: string; email: string; }

/** Resolve the logged-in platform operator (us) from the `oid` cookie. */
export async function getOpCtx(): Promise<OpCtx | null> {
  const oid = (await cookies()).get('oid')?.value;
  if (!oid) return null;
  const [row] = await db()<OpCtx[]>`
    select pa.id as "adminId", pa.email
      from platform_sessions ps
      join platform_admins pa on pa.id = ps.admin_id
     where ps.token = ${oid} and ps.expires_at > now()
     limit 1`;
  return row ?? null;
}
