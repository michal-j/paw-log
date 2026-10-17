import type { Lang } from './index';

/** Which plural form of a counted string applies: `one`, `few` (Polish 2-4, 22-24 ...) or `many`. */
export function pluralForm(lang: Lang, n: number): 'one' | 'few' | 'many' {
  const category = new Intl.PluralRules(lang).select(n);
  return category === 'one' ? 'one' : category === 'few' ? 'few' : 'many';
}
