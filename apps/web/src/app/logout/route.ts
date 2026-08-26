import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@loady/core';

// POST only — a GET logout gets prefetched by <Link> and silently ends the
// session, bouncing every navigation to /login. A form POST is never prefetched.
export async function POST(req: NextRequest) {
  const c = await cookies();
  const sid = c.get('sid')?.value;
  const oid = c.get('oid')?.value;
  if (sid) await db()`delete from sessions where token = ${sid}`.catch(() => {});
  if (oid) await db()`delete from platform_sessions where token = ${oid}`.catch(() => {});
  c.delete('sid');
  c.delete('oid');
  // 303 so the browser follows the POST with a GET to the landing page.
  return NextResponse.redirect(new URL('/', req.url), 303);
}
