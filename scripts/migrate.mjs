import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { connect, ROOT } from './db.mjs';

/**
 * Applies pending SQL migrations in order, each in its own transaction, and
 * records them in schema_migrations. Migrations run with app.bypass = 'on' so
 * DDL and data backfills are never blocked by row-level security.
 */
const DIR = join(ROOT, 'db', 'migrations');
const sql = connect({ max: 1 });

await sql`create table if not exists schema_migrations (
  filename   text primary key,
  applied_at timestamptz not null default now()
)`;

const applied = new Set((await sql`select filename from schema_migrations`).map((r) => r.filename));
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

let ran = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  const body = readFileSync(join(DIR, file), 'utf8');
  try {
    await sql.begin(async (tx) => {
      await tx`select set_config('app.bypass', 'on', true)`;
      await tx.unsafe(body);
      await tx`insert into schema_migrations (filename) values (${file})`;
    });
    console.log(`  ✓ ${file}`);
    ran++;
  } catch (err) {
    console.error(`\n  ✗ ${file}\n    ${err.message}\n`);
    await sql.end();
    process.exit(1);
  }
}
console.log(ran ? `\nApplied ${ran} migration(s).` : 'Already up to date.');
await sql.end();
