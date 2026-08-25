import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { consumeToken, isPlatformAdmin, createPlatformSession, SESSION_COOKIE } from '@/lib/auth';

/** Operator magic-link target. Club members sign in with a password instead. */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('token');
  const back = (e: string) => NextResponse.redirect(new URL(`/admin/login?e=${e}`, req.url));
  if (!t) return back('invalid');

  const email = await consumeToken(t);
  if (!email) return back('expired');
  if (await isPlatformAdmin(email)) {
    const oid = await createPlatformSession(email);
    if (oid) {
      (await cookies()).set('oid', oid, SESSION_COOKIE);
      return NextResponse.redirect(new URL('/admin', req.url));
    }
  }
  return back('invalid');
}
