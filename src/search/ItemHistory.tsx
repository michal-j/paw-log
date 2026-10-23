import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { PlainDate } from '../data';
import { DoseMark } from '../components/DoseMark';
import { ChevronIcon, SearchIcon } from '../components/icons';
import { fill, useI18n } from '../i18n';
import { useFormat } from '../log/format';
import { useLog } from '../log/LogProvider';
import { markSize } from '../timeline/model';
import type { EntryDoc } from './index';
import { PAGE, useSearchIndex, type SearchMemory } from './memory';
import { useMonthCaption } from './month';
import type { Ring } from './SearchScreen';
import { useEntriesText } from './ResultCards';
import '../day/day.css';
import './search.css';

/**
 * An item's whole history (any item kind): every entry newest first by month, with amount or state, day part and any
 * note; a row opens its day. It is the kind filter's list narrowed to one item, so the two never disagree.
 */
export function ItemHistory({
  id,
  memory,
  onBack,
  onMissing,
  onOpenDay,
}: {
  id: string;
  memory: SearchMemory;
  onBack: () => void;
  onMissing: () => void;
  onOpenDay: (date: PlainDate, ring: Ring) => void;
}) {
  const { t, lang } = useI18n();
  const f = useFormat();
  const month = useMonthCaption();
  const entries = useEntriesText();
  const { records } = useLog();
  const index = useSearchIndex(records, lang, t, f);
  const doc = index?.itemDoc(id);
  const list = index?.entriesOf(id) ?? [];
  const [shown, setShown] = useState(() => memory.item(id).shown);
  const bodyRef = useRef<HTMLDivElement>(null);

  // An item that no longer exists (deleted meanwhile) leaves the page.
  useEffect(() => {
    if (index && !doc) onMissing();
  }, [index, doc, onMissing]);

  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current || !doc) return;
    restored.current = true;
    if (bodyRef.current) bodyRef.current.scrollTop = memory.item(id).scrollTop;
  }, [doc, memory, id]);

  if (!doc) return <section className="day" aria-busy="true" />;
  const page = list.slice(0, shown);
  const groups: { month: string; docs: EntryDoc[] }[] = [];
  for (const d of page) {
    const m = month(d.date);
    const last = groups[groups.length - 1];
    if (last?.month === m) last.docs.push(d);
    else groups.push({ month: m, docs: [d] });
  }
  const remaining = list.length - page.length;
  const row = (d: EntryDoc): ReactNode => (
    <li key={d.id} className="search-dose">
      <button type="button" className="day-card__row day-card__row--desc" onClick={() => onOpenDay(d.date, { kind: 'entry', id: d.id })}>
        <span className="day-card__row-label search-dose__label">
          <DoseMark colour={doc.item.colour} size={markSize(doc.item)} state={d.state} />
          <span>
            <span className="search-nowrap">{f.shortDate(d.date)}</span>
            <span className="search-dose__sub">
              {' · '}
              {d.partLabel}
              {d.entry.flavour ? ` · ${d.entry.flavour}` : ''}
            </span>
          </span>
        </span>
        <span className="day-card__row-value search-dose__value">
          {d.state === 'skipped' || d.state === 'partial' ? <span className={`day-tag day-tag--${d.state}`}>{d.stateWord}</span> : d.amount}
        </span>
        {d.note && <span className="day-card__row-desc">{d.note}</span>}
      </button>
    </li>
  );

  return (
    <section className="day" aria-labelledby="item-title">
      <div className="day__top">
        <button type="button" className="day-btn day-btn--back" onClick={onBack}>
          <ChevronIcon dir="left" size={18} />
          {t('back')}
        </button>
      </div>
      <div className="day__head">
        <div className="day__titles">
          <h2 id="item-title" className="day__title">
            {doc.item.name}
          </h2>
          <p className="day__sub">
            {doc.kindWord} · {entries(list.length)}
          </p>
        </div>
      </div>
      <div ref={bodyRef} className="day__body" onScroll={(e) => memory.setItem(id, { scrollTop: e.currentTarget.scrollTop })}>
        {groups.map((g) => (
          <Fragment key={g.month}>
            <h3 className="day__caption">{g.month}</h3>
            <div className="day-card">
              <ul className="day-card__rows">{g.docs.map(row)}</ul>
            </div>
          </Fragment>
        ))}
        {list.length === 0 && (
          <article className="day-card day-empty search-empty">
            <span className="day-empty__icon" aria-hidden="true">
              <SearchIcon size={16} />
            </span>
            <p className="day-empty__text">{t('searchItemEmpty')}</p>
          </article>
        )}
        {remaining > 0 && (
          <button
            type="button"
            className="btn btn--ghost btn--md search-more"
            onClick={() => {
              const next = shown + PAGE;
              setShown(next);
              memory.setItem(id, { shown: next });
            }}
          >
            {fill(t('searchMore'), { n: Math.min(PAGE, remaining) })}
          </button>
        )}
      </div>
    </section>
  );
}
