import { randomBytes } from 'node:crypto';
import { db, withAccount } from '@loady/core';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const tok = (n = 24) => randomBytes(n).toString('base64url');

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

const DEFAULT_METHODS: [string, string][] = [
  ['venmo', 'Venmo'], ['zelle', 'Zelle'], ['cashapp', 'Cash App'], ['paypal', 'PayPal'],
];

/**
 * Create a brand-new account, its owner member, and a seeded starter setup —
 * fully automatic, no operator step. The account row is control-plane; the
 * config/platforms/methods are seeded inside the account's own RLS context.
 */
export async function provisionAccount(opts: { name: string; email: string; plan: string }): Promise<{ accountId: string }> {
  const email = opts.email.trim().toLowerCase();
  const [pkg] = await db()<{ id: string }[]>`select id from packages where code = ${opts.plan} and active limit 1`;
  const slug = await uniqueSlug(opts.name);
  const [acc] = await db()<{ id: string }[]>`
    insert into accounts (slug, name, status, package_id, trial_ends_at)
    values (${slug}, ${opts.name.trim()}, 'trialing', ${pkg?.id ?? null}, now() + interval '14 days')
    returning id`;
  await db()`insert into account_members (account_id, email, role, accepted_at)
             values (${acc!.id}, ${email}, 'owner', now())
             on conflict (account_id, email) do nothing`;
  await withAccount(acc!.id, async (sql) => {
    await sql`insert into account_config (account_id) values (${acc!.id})`;
    await sql`insert into platforms (account_id, code, name, sort_order)
              values (${acc!.id}, 'clubgg', 'ClubGG', 1), (${acc!.id}, 'sportsbook', 'Sportsbook', 2)`;
    for (const [code, name] of DEFAULT_METHODS) {
      await sql`insert into payment_methods (account_id, code, name) values (${acc!.id}, ${code}, ${name})`;
    }
  });
  return { accountId: acc!.id };
}

export async function memberExists(email: string): Promise<boolean> {
  const [m] = await db()`select 1 from account_members where email = ${email.trim().toLowerCase()} limit 1`;
  return !!m;
}

/** Mint a magic-link token and deliver it (real email if configured, else dev log). */
export async function sendMagicLink(email: string): Promise<{ devLink?: string }> {
  const e = email.trim().toLowerCase();
  const t = tok();
  await db()`insert into login_tokens (token, email, expires_at) values (${t}, ${e}, now() + interval '30 minutes')`;
  const link = `${APP_URL}/auth/verify?token=${t}`;
  await deliver(e, link);
  return { devLink: process.env.NODE_ENV !== 'production' ? link : undefined };
}

async function deliver(email: string, link: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? 'Loady <noreply@loady.app>';
  if (!key) { console.log(`\n[dev] magic link for ${email}:\n${link}\n`); return; }
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to: email, subject: 'Your Loady sign-in link',
      html: `<p>Click to sign in to Loady:</p><p><a href="${link}">${link}</a></p><p style="color:#888">This link expires in 30 minutes.</p>`,
    }),
  }).catch((err) => console.error('[email] send failed', err));
}

/** Redeem a magic-link token and open a 30-day session. Returns the session id. */
export async function consumeTokenAndCreateSession(t: string): Promise<string | null> {
  return db().begin(async (tx) => {
    const [lt] = await tx<{ email: string; expires_at: Date; used_at: Date | null }[]>`
      select email, expires_at, used_at from login_tokens where token = ${t} for update`;
    if (!lt || lt.used_at || lt.expires_at < new Date()) return null;
    await tx`update login_tokens set used_at = now() where token = ${t}`;
    const [m] = await tx<{ id: string }[]>`select id from account_members where email = ${lt.email} order by created_at limit 1`;
    if (!m) return null;
    const sid = tok(32);
    await tx`insert into sessions (token, member_id, expires_at) values (${sid}, ${m.id}, now() + interval '30 days')`;
    return sid;
  }) as Promise<string | null>;
}
