// Applies supabase/migrations to an in-process Postgres (PGlite) and runs supabase/tests/database/*.test.sql.
// No Docker or Supabase project needed. tests/db/supabase-stub.sql stands in for the parts of Supabase
// the migrations rely on; tests/db/tap-shim.sql provides the pgTAP functions the tests use.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const sqlFiles = (dir) =>
  readdirSync(new URL(dir, root))
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => `${dir}${f}`);

const notices = [];
const db = new PGlite();
const onNotice = (n) => notices.push(n.message);

await db.exec(read('tests/db/supabase-stub.sql'));
for (const file of sqlFiles('supabase/migrations/')) {
  await db.exec(read(file));
  console.log(`applied ${file}`);
}
await db.exec(read('tests/db/tap-shim.sql'));

let failed = 0;
for (const file of sqlFiles('supabase/tests/database/')) {
  // pgTAP is shimmed here, so drop the extension line.
  const sql = read(file).replace(/^create extension if not exists pgtap.*$/im, '');
  notices.length = 0;
  try {
    await db.exec(sql, { onNotice });
    console.log(`\n${file}\n${notices.map((n) => `  ${n}`).join('\n')}`);
  } catch (err) {
    failed++;
    await db.exec('rollback').catch(() => {});
    console.error(`\n${file}\n${notices.map((n) => `  ${n}`).join('\n')}\n  ${err.message}`);
  }
}
await db.close();
if (failed) process.exit(1);
console.log('\ndatabase tests passed');
