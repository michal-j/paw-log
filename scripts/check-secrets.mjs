// CI guard: the repo is public, so fail on anything that looks like a service key or a real project URL.
// Extra blocked words (e.g. real names that must never be committed) come from a git-ignored
// `.secret-words` file (one per line, `#` comments) and/or PAWLOG_BLOCKED_WORDS (comma-separated).
// They are matched case-insensitively and never printed, so CI logs cannot leak them.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const WORDS_FILE = '.secret-words';

const files = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !f.endsWith('package-lock.json') && !f.startsWith('scripts/check-secrets'));
const patterns = [
  [/service[_-]?role/i, 'service-role key reference', true],
  [/https:\/\/[a-z0-9]{20}\.supabase\.co/i, 'concrete Supabase project URL'],
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, 'JWT-looking token'],
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fileWords = existsSync(WORDS_FILE)
  ? readFileSync(WORDS_FILE, 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('#'))
  : [];
const envWords = (process.env.PAWLOG_BLOCKED_WORDS ?? '').split(',');
const blocked = [...new Set([...fileWords, ...envWords].map((w) => w.trim()).filter(Boolean))];
const blockedPatterns = blocked.map((w, i) => [new RegExp(escape(w), 'i'), `blocked word #${i + 1}`]);
patterns.push(...blockedPatterns);

let bad = 0;
for (const f of files) {
  for (const [re, label] of blockedPatterns) {
    if (re.test(f)) {
      console.error(`${f}: ${label} in file path`);
      bad++;
    }
  }
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
console.log(`secret scan clean (${files.length} files, ${blocked.length} blocked words)`);
