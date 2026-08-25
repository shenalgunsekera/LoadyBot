import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { consumeTokenAndCreateSession } from '@/lib/auth';

/** The magic-link target: redeem the token, open a session cookie, land on the dashboard. */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('token');
  const back = (e: string) => NextResponse.redirect(new URL(`/login?e=${e}`, req.url));
  if (!t) return back('invalid');

  const sid = await consumeTokenAndCreateSession(t);
  if (!sid) return back('expired');

  (await cookies()).set('sid', sid, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.redirect(new URL('/dashboard', req.url));
}
