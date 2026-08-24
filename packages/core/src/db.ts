import postgres, { type Sql } from 'postgres';

let _sql: Sql | null = null;

/**
 * The shared connection pool. postgres.js returns timestamptz as JS Date and
 * bigint as string by default — money is bigint cents, so parse with Number()
 * or BigInt() at the edges. One pool serves every account; isolation comes from
 * the per-request tenant context (see tenant.ts), never from separate pools.
 */
export function db(): Sql {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    _sql = postgres(url, {
      ssl: 'require',
      max: Number(process.env.DB_POOL_MAX ?? 10),
      idle_timeout: 20,
      transform: { undefined: null },
    });
  }
  return _sql;
}

export type { Sql };
