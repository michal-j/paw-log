// CI guard: the repo is public, so fail on anything that looks like a service key or a real project URL.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !f.endsWith('package-lock.json') && !f.startsWith('scripts/check-secrets'));
const patterns = [
  [/service[_-]?role/i, 'service-role key reference', true],
  [/https:\/\/[a-z0-9]{20}\.supabase\.co/i, 'concrete Supabase project URL'],
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, 'JWT-looking token'],
  [/sb_secret_[A-Za-z0-9_-]{8,}/, 'Supabase secret key'],
];
let bad = 0;
for (const f of files) {
  let text;
  try {
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  for (const [re, label, codeOnly] of patterns) {
    if (codeOnly && f.endsWith('.md')) continue; // docs may name the rule
    if (re.test(text)) {
      console.error(`${f}: ${label}`);
      bad++;
    }
  }
}
if (bad) process.exit(1);
console.log(`secret scan clean (${files.length} files)`);
