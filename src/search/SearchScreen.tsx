import { Fragment, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PlainDate } from '../data';
import { SearchIcon, SlidersIcon, CrossIcon } from '../components/icons';
import { fill, useI18n, type MessageKey } from '../i18n';
import { pluralForm } from '../i18n/plural';
import { useFormat } from '../log/format';
import { useLog } from '../log/LogProvider';
import { FilterSheet } from './FilterSheet';
import { runSearch, type DatedDoc, type EntryDoc } from './index';
import { KIND_LABEL, type Kind } from './kinds';
import { useKeyboardFit } from './keyboard';
import { useMonthCaption } from './month';
import { PAGE, useSearchIndex, type SearchMemory } from './memory';
import { ConditionResult, EntryRows, EventResult, ItemResult, PinnedResult } from './ResultCards';
import { tokensOf } from './text';
import '../day/day.css';
import '../tracked/tracked.css';
import './search.css';

/** The card or row to ring on its day: an event or an entry, by id. */
export interface Ring {
  kind: 'event' | 'entry';
  id: string;
}

const COUNT: Record<'one' | 'few' | 'many', MessageKey> = { one: 'searchResults_one', few: 'searchResults_few', many: 'searchResults_many' };

/**
 * Search across the log (JCB-138): a field, a Filters button, a one-line summary of the filters and the results,
 * newest first under month captions. Text, filters, how many results are shown and the scroll live in `memory`.
 */
export function SearchScreen({
  memory,
  onOpenDay,
  onOpenCondition,
  onOpenItem,
}: {
  memory: SearchMemory;
  onOpenDay: (date: PlainDate, ring: Ring) => void;
  onOpenCondition: (id: string) => void;
  onOpenItem: (id: string) => void;
}) {
  const { t, lang } = useI18n();
  const format = useFormat();
  const month = useMonthCaption();
  const { records, loadFailed, reload, open } = useLog();
  const [q, setQ] = useState(() => memory.get().q);
  const [kinds, setKinds] = useState<Kind[]>(() => memory.get().kinds);
  const [shown, setShown] = useState(() => memory.get().shown);
  const [sheet, setSheet] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useKeyboardFit();

  const index = useSearchIndex(records, lang, t, format);
  const tokens = useMemo(() => tokensOf(q, lang), [q, lang]);
  const result = useMemo(() => (index ? runSearch(index, tokens, kinds) : null), [index, tokens, kinds]);

  // Back from a Day: the scroll position comes back once the list is on screen.
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current || !result) return;
    restored.current = true;
    if (bodyRef.current) bodyRef.current.scrollTop = memory.get().scrollTop;
  }, [result, memory]);

  /** A new text or filter starts a new list: first page, from the top. */
  const restart = (patch: { q?: string; kinds?: Kind[] }) => {
    if (patch.q !== undefined) setQ(patch.q);
    if (patch.kinds !== undefined) setKinds(patch.kinds);
    setShown(PAGE);
    memory.set({ ...patch, shown: PAGE, scrollTop: 0 });
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  };
  const toggle = (k: Kind) => restart({ kinds: kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k] });
  const showMore = () => {
    const next = shown + PAGE;
    setShown(next);
    memory.set({ shown: next });
  };
  const leave = () => inputRef.current?.blur(); // closes the keyboard before another screen opens
  const openSheet = () => {
    leave();
    setSheet(true);
  };

  const n = kinds.length;
  const names = kinds.slice(0, 2).map((k) => t(KIND_LABEL[k]));
  const summary = n > 2 ? fill(t('searchFilterSummary'), { a: names[0] ?? '', b: names[1] ?? '', n: n - 2 }) : names.join(', ');

  let body: ReactNode;
  if (!result) {
    body = loadFailed ? (
      <EmptyCard>
        <p className="day-empty__text">{t('loadFailed')}</p>
        <button type="button" className="btn btn--ghost btn--md list-empty__btn" onClick={reload}>
          {t('retry')}
        </button>
      </EmptyCard>
    ) : (
      <div aria-busy="true">
        <p className="sr-only" role="status">
          {t('auth.loading')}
        </p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="search-skel" aria-hidden="true">
            <i className="h" />
            <i className="s" />
            <i />
          </div>
        ))}
      </div>
    );
  } else if (result.idle) {
    body = (
      <EmptyCard>
        <p className="day-empty__text">{t('searchHint')}</p>
      </EmptyCard>
    );
  } else if (result.total === 0) {
    const typed = tokens.length > 0;
    body = (
      <EmptyCard>
        {typed ? (
          <>
            <p className="day-card__head search-none__title">{fill(t('searchNoneTitle'), { q: q.trim() })}</p>
            <p className="day-empty__text">{t('searchNoneHint')}</p>
            {n > 0 && (
              <button type="button" className="btn btn--ghost btn--md list-empty__btn" onClick={() => restart({ kinds: [] })}>
                {t('searchNoneAll')}
              </button>
            )}
          </>
        ) : (
          <p className="day-empty__text">{t('searchNoneKind')}</p>
        )}
      </EmptyCard>
    );
  } else {
    const page = result.dated.slice(0, shown);
    const cards: ReactNode[] = [];
    let current = '';
    let run: EntryDoc[] = [];
    const openEntry = (d: EntryDoc) => {
      leave();
      onOpenDay(d.date, { kind: 'entry', id: d.id });
    };
    const flush = () => {
      if (run.length > 0) cards.push(<EntryRows key={`rows-${run[0]?.id}`} docs={run} tokens={tokens} scoped={result.scoped} onOpen={openEntry} />);
      run = [];
    };
    page.forEach((d: DatedDoc) => {
      const m = month(d.date);
      if (m !== current) {
        flush();
        current = m;
        cards.push(
          <h3 key={`m-${m}`} className="day__caption">
            {m}
          </h3>,
        );
      }
      if (d.type === 'entry') {
        run.push(d);
      } else {
        flush();
        cards.push(
          <EventResult
            key={d.id}
            doc={d}
            tokens={tokens}
            kinds={kinds}
            onOpen={() => {
              leave();
              onOpenDay(d.date, { kind: 'event', id: d.id });
            }}
          />,
        );
      }
    });
    flush();
    const remaining = result.dated.length - page.length;
    const caption = (text: string) => <h3 className="day__caption">{text}</h3>;
    body = (
      <>
        <p className="search-count" role="status" aria-live="polite">
          {fill(t(COUNT[pluralForm(lang, result.total)]), { n: result.total })}
        </p>
        {result.items.length > 0 && (
          <>
            {caption(t('searchGroupItems'))}
            {result.items.map((d) => (
              <ItemResult key={d.item.id} doc={d} tokens={tokens} onOpen={() => onOpenItem(d.item.id)} />
            ))}
          </>
        )}
        {result.conditions.length > 0 && (
          <>
            {caption(t('copy.173'))}
            {result.conditions.map((d) => (
              <ConditionResult key={d.condition.id} doc={d} tokens={tokens} onOpen={() => onOpenCondition(d.condition.id)} />
            ))}
          </>
        )}
        {result.pinned.length > 0 && (
          <>
            {caption(t('copy.171'))}
            {result.pinned.map((d) => (
              <PinnedResult key={d.note.id} doc={d} tokens={tokens} onOpen={() => open({ kind: 'pinned', note: d.note })} />
            ))}
          </>
        )}
        {cards.map((c, i) => (
          <Fragment key={i}>{c}</Fragment>
        ))}
        {remaining > 0 && (
          <button type="button" className="btn btn--ghost btn--md search-more" onClick={showMore}>
            {fill(t('searchMore'), { n: Math.min(PAGE, remaining) })}
          </button>
        )}
      </>
    );
  }

  return (
    <section className="search" aria-labelledby="search-title">
      <h2 id="search-title" className="sr-only">
        {t('search')}
      </h2>
      <div className="search-head">
        <div className="search-row">
          <div className="search-field">
            <span className="search-field__icon" aria-hidden="true">
              <SearchIcon size={18} />
            </span>
            <input
              ref={inputRef}
              className="input"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label={t('searchFieldLabel')}
              placeholder={t('searchFieldLabel')}
              value={q}
              onChange={(e) => restart({ q: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.blur()}
            />
            {q && (
              <button
                type="button"
                className="search-field__clear"
                aria-label={t('searchClear')}
                onClick={() => {
                  restart({ q: '' });
                  inputRef.current?.focus();
                }}
              >
                <span>
                  <CrossIcon size={10} />
                </span>
              </button>
            )}
          </div>
          <button
            type="button"
            className="btn btn--ghost search-filter-btn"
            aria-haspopup="dialog"
            aria-label={n > 0 ? fill(t('searchFiltersOn'), { n }) : undefined}
            onClick={openSheet}
          >
            <span className="btn__icon">
              <SlidersIcon />
            </span>
            {t('filters')}
            {n > 0 && <span className="search-filter-btn__n">{n}</span>}
          </button>
        </div>
      </div>
      {n > 0 && (
        <div className="search-summary">
          <button type="button" className="search-summary__text" onClick={openSheet}>
            {summary}
          </button>
          <button type="button" className="link-btn search-summary__clear" onClick={() => restart({ kinds: [] })}>
            {t('diagClear')}
          </button>
        </div>
      )}
      <div ref={bodyRef} className="search-body" onScroll={(e) => memory.set({ scrollTop: e.currentTarget.scrollTop })}>
        {body}
      </div>
      {sheet && <FilterSheet kinds={kinds} total={result?.total ?? 0} onToggle={toggle} onClear={() => restart({ kinds: [] })} onClose={() => setSheet(false)} />}
    </section>
  );
}

function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <article className="day-card day-empty search-empty">
      <span className="day-empty__icon" aria-hidden="true">
        <SearchIcon size={16} />
      </span>
      <div>{children}</div>
    </article>
  );
}
