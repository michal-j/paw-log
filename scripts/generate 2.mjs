// Generates src/styles/tokens.css and src/i18n/catalogues.generated.json from the docs.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildCatalogues, buildTokensCss } from './lib.mjs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

writeFileSync(
  new URL('src/styles/tokens.css', root),
  buildTokensCss(JSON.parse(read('docs/design-system/tokens.json'))),
);
writeFileSync(
  new URL('src/i18n/catalogues.generated.json', root),
  JSON.stringify(buildCatalogues(read('docs/copy/pawlog-copy-en-pl.csv')), null, 1) + '\n',
);
console.log('generated tokens.css and catalogues.generated.json');
