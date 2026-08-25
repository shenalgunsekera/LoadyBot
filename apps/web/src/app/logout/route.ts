import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@loady/core';

export async function GET(req: NextRequest) {
  const c = await cookies();
  const sid = c.get('sid')?.value;
  const oid = c.get('oid')?.value;
  if (sid) await db()`delete from sessions where token = ${sid}`.catch(() => {});
  if (oid) await db()`delete from platform_sessions where token = ${oid}`.catch(() => {});
  c.delete('sid');
  c.delete('oid');
  return NextResponse.redirect(new URL('/', req.url));
}
