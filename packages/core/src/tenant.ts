import { db, type Sql } from './db';

/**
 * Run a unit of work scoped to one account. Everything inside the callback runs
 * in a single transaction that has stamped app.current_account, so every tenant
 * table (RLS) sees only this account's rows — even if a query forgets its own
 * WHERE clause. This is THE isolation boundary: touch money tables only through
 * withAccount().
 *
 *   await withAccount(accountId, async (sql) => {
 *     return sql`select * from players`;   // ← only this account's players
 *   });
 */
export function withAccount<T>(accountId: string, fn: (sql: Sql) => Promise<T>): Promise<T> {
  return db().begin(async (tx) => {
    // Drop to loady_app (no BYPASSRLS) so row-level security actually applies —
    // the connecting role (Supabase postgres) can bypass RLS otherwise. Both the
    // role and the account setting are LOCAL to this transaction and reset when
    // the pooled connection is handed back.
    await tx`set local role loady_app`;
    await tx`select set_config('app.current_account', ${accountId}, true)`;
    return fn(tx as unknown as Sql);
  }) as Promise<T>;
}

/**
 * Platform-level work that legitimately spans accounts — provisioning, billing
 * webhooks, cross-account analytics, cleanup. Sets app.bypass so RLS steps
 * aside. Use sparingly and never with request-supplied account ids; prefer
 * withAccount() for anything a tenant can trigger.
 */
export function asPlatform<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  return db().begin(async (tx) => {
    await tx`select set_config('app.bypass', 'on', true)`;
    return fn(tx as unknown as Sql);
  }) as Promise<T>;
}
