import { NextResponse, type NextRequest } from 'next/server';
import { withAccount, signedReceiptUrl } from '@loady/core';
import { getCtx } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Redirect to a short-lived signed URL for a receipt — only for the club that
 *  owns it (RLS scopes the lookup to the signed-in account). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.redirect(new URL('/login', req.url));
  const { id } = await params;
  const path = await withAccount(ctx.accountId, async (sql) =>
    (await sql<{ storage_path: string | null }[]>`select storage_path from receipts where id = ${id}`)[0]?.storage_path ?? null);
  if (!path) return new Response('Not found', { status: 404 });
  const url = await signedReceiptUrl(path, 300);
  if (!url) return new Response('Receipt unavailable', { status: 404 });
  return NextResponse.redirect(url);
}
