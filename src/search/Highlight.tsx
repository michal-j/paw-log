import { highlight, type Token } from './text';

/**
 * The one highlighter (JCB-138): every text a search result shows passes through here, so what is marked is always
 * exactly what matched (word starts, case and diacritics blind, the Polish stem included). `mark` is mint-bg behind ink.
 */
export function Hl({ text, tokens }: { text: string; tokens: readonly Token[] }) {
  return (
    <>
      {highlight(text, tokens).map((p, i) =>
        p.hit ? (
          <mark key={i} className="hit">
            {p.text}
          </mark>
        ) : (
          p.text
        ),
      )}
    </>
  );
}
