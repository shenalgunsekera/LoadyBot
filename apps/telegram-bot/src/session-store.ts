import { db } from '@loady/core';
import type { StorageAdapter } from 'grammy';

/** grammY session storage backed by Postgres (bot_sessions), so the webhook
 *  keeps flow state across serverless invocations. */
export function pgSessions<T>(): StorageAdapter<T> {
  return {
    async read(key) {
      const [r] = await db()<{ data: T }[]>`select data from bot_sessions where key = ${key}`;
      return r?.data;
    },
    async write(key, value) {
      const sql = db();
      await sql`insert into bot_sessions (key, data, updated_at) values (${key}, ${sql.json(value as never)}, now())
               on conflict (key) do update set data = excluded.data, updated_at = now()`;
    },
    async delete(key) {
      await db()`delete from bot_sessions where key = ${key}`;
    },
  };
}
