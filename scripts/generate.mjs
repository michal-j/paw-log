// Generates src/styles/tokens.css and src/i18n/catalogues.generated.json from the docs.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { buildCatalogues, buildTokensCss, mergeCatalogues } from './lib.mjs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

writeFileSync(
  new URL('src/styles/tokens.css', root),
  buildTokensCss(JSON.parse(read('docs/design-system/tokens.json'))),
);

// Reviewed copy plus draft copy proposals (pending CEO review), so new screens can use their strings now.
const drafts = readdirSync(new URL('docs/copy/', root))
  .filter((f) => /^copy-proposal-.*\.csv$/.test(f))
  .sort()
  .map((f) => buildCatalogues(read(`docs/copy/${f}`)));
writeFileSync(
  new URL('src/i18n/catalogues.generated.json', root),
  JSON.stringify(mergeCatalogues(buildCatalogues(read('docs/copy/pawlog-copy-en-pl.csv')), ...drafts), null, 1) + '\n',
);
console.log(`generated tokens.css and catalogues.generated.json (${drafts.length} draft copy file(s))`);
