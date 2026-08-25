import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@loady/core';

export async function GET(req: NextRequest) {
  const c = await cookies();
  const sid = c.get('sid')?.value;
  if (sid) await db()`delete from sessions where token = ${sid}`.catch(() => {});
  c.delete('sid');
  return NextResponse.redirect(new URL('/', req.url));
}
