import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db, withAccount } from '@loady/core';

const tok = (n = 32) => randomBytes(n).toString('base64url');

// ── Password hashing (scrypt, salt:hash) ─────────────────────────────────────
export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(pw, salt, 64).toString('hex')}`;
}
export function verifyPassword(pw: string, stored: string | null): boolean {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const got = scryptSync(pw, Buffer.from(saltHex, 'hex'), 64);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'club';
}
async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let i = 0; i < 50; i++) {
    const slug = i ? `${base}-${i}` : base;
    const [ex] = await db()`select 1 from accounts where slug = ${slug} limit 1`;
    if (!ex) return slug;
  }
  return `${base}-${tok(3)}`;
}
const DEFAULT_METHODS: [string, string][] = [['venmo', 'Venmo'], ['zelle', 'Zelle'], ['cashapp', 'Cash App'], ['paypal', 'PayPal']];

/**
 * Register. A brand-new email creates the club (owner). An email that was invited
 * as an admin (member exists, no password yet) just sets its password to join.
 */
export async function signUp(opts: { name: string; email: string; password: string }): Promise<{ ok: true; memberId: string } | { ok: false; error: string }> {
  const email = opts.email.trim().toLowerCase();
  const [existing] = await db()<{ id: string; password_hash: string | null }[]>`select id, password_hash from account_members where email = ${email} limit 1`;
  if (existing) {
    if (existing.password_hash) return { ok: false, error: 'That email already has an account — log in instead.' };
    await db()`update account_members set password_hash = ${hashPassword(opts.password)}, accepted_at = now(),
               display_name = coalesce(display_name, ${opts.name.trim()}) where id = ${existing.id}`;
    return { ok: true, memberId: existing.id };
  }
  const [pkg] = await db()<{ id: string }[]>`select id from packages where code = 'complete' and active limit 1`;
  const slug = await uniqueSlug(opts.name);
  const [acc] = await db()<{ id: string }[]>`
    insert into accounts (slug, name, status, package_id, trial_ends_at)
    values (${slug}, ${opts.name.trim()}, 'trialing', ${pkg?.id ?? null}, now() + interval '14 days') returning id`;
  const [mem] = await db()<{ id: string }[]>`
    insert into account_members (account_id, email, role, password_hash, accepted_at, display_name)
    values (${acc!.id}, ${email}, 'owner', ${hashPassword(opts.password)}, now(), ${opts.name.trim()}) returning id`;
  await withAccount(acc!.id, async (sql) => {
    await sql`insert into account_config (account_id) values (${acc!.id})`;
    await sql`insert into platforms (account_id, code, name, sort_order) values (${acc!.id}, 'clubgg', 'ClubGG', 1), (${acc!.id}, 'sportsbook', 'Sportsbook', 2)`;
    for (const [code, name] of DEFAULT_METHODS) await sql`insert into payment_methods (account_id, code, name) values (${acc!.id}, ${code}, ${name})`;
  });
  return { ok: true, memberId: mem!.id };
}

/** Verify email + password; returns the member id or null. */
export async function login(email: string, password: string): Promise<string | null> {
  const [m] = await db()<{ id: string; password_hash: string | null }[]>`select id, password_hash from account_members where email = ${email.trim().toLowerCase()} limit 1`;
  if (!m || !verifyPassword(password, m.password_hash)) return null;
  return m.id;
}

/** Open a 30-day session for a member id. */
export async function createMemberSession(memberId: string): Promise<string> {
  const sid = tok();
  await db()`insert into sessions (token, member_id, expires_at) values (${sid}, ${memberId}, now() + interval '30 days')`;
  return sid;
}

export const SESSION_COOKIE = {
  httpOnly: true as const,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};

// ── Operator (platform admin) sign-in stays magic-link (rare use) ────────────
export async function isPlatformAdmin(email: string): Promise<boolean> {
  const [a] = await db()`select 1 from platform_admins where email = ${email.trim().toLowerCase()} limit 1`;
  return !!a;
}
export async function createPlatformSession(email: string): Promise<string | null> {
  const [a] = await db()<{ id: string }[]>`select id from platform_admins where email = ${email.trim().toLowerCase()} limit 1`;
  if (!a) return null;
  const sid = tok();
  await db()`insert into platform_sessions (token, admin_id, expires_at) values (${sid}, ${a.id}, now() + interval '30 days')`;
  return sid;
}
export async function sendOperatorLink(email: string): Promise<{ devLink?: string }> {
  const e = email.trim().toLowerCase();
  const t = tok(24);
  await db()`insert into login_tokens (token, email, expires_at) values (${t}, ${e}, now() + interval '30 minutes')`;
  const link = `${process.env.APP_URL ?? 'http://localhost:3000'}/auth/verify?token=${t}`;
  if (!process.env.RESEND_API_KEY) console.log(`\n[dev] operator link for ${e}:\n${link}\n`);
  return { devLink: process.env.NODE_ENV !== 'production' ? link : undefined };
}
export async function consumeToken(t: string): Promise<string | null> {
  return db().begin(async (tx) => {
    const [lt] = await tx<{ email: string; expires_at: Date; used_at: Date | null }[]>`select email, expires_at, used_at from login_tokens where token = ${t} for update`;
    if (!lt || lt.used_at || lt.expires_at < new Date()) return null;
    await tx`update login_tokens set used_at = now() where token = ${t}`;
    return lt.email;
  }) as Promise<string | null>;
}
