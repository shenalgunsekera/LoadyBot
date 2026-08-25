import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { consumeToken, isPlatformAdmin, createPlatformSession, createMemberSession } from '@/lib/auth';

const COOKIE = {
  httpOnly: true as const,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};

/** Magic-link target. Operators land in the ops room; club owners in their dashboard. */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('token');
  const back = (e: string) => NextResponse.redirect(new URL(`/login?e=${e}`, req.url));
  if (!t) return back('invalid');

  const email = await consumeToken(t);
  if (!email) return back('expired');

  const c = await cookies();
  if (await isPlatformAdmin(email)) {
    const oid = await createPlatformSession(email);
    if (oid) { c.set('oid', oid, COOKIE); return NextResponse.redirect(new URL('/admin', req.url)); }
  }
  const sid = await createMemberSession(email);
  if (sid) { c.set('sid', sid, COOKIE); return NextResponse.redirect(new URL('/dashboard', req.url)); }
  return back('nomember');
}
