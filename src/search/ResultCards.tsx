import { Fragment, type ReactNode } from 'react';
import { DoseMark } from '../components/DoseMark';
import { EventBadge } from '../components/EventBadge';
import { ChevronIcon, DotsIcon } from '../components/icons';
import { BADGE_FOR } from '../day/model';
import { fill, useI18n, type MessageKey } from '../i18n';
import { pluralForm } from '../i18n/plural';
import { useFormat } from '../log/format';
import { PhotoThumb } from '../photos/PhotoParts';
import { markSize } from '../timeline/model';
import type { ConditionDoc, EntryDoc, EventDoc, ItemDoc, PinnedDoc } from './index';
import { Hl } from './Highlight';
import type { Kind } from './kinds';
import { TYPE_WORD } from './kinds';
import { hasToken, nfc, norm, snippet, type Token } from './text';

type Tokens = readonly Token[];

const ENTRIES: Record<'one' | 'few' | 'many', MessageKey> = { one: 'condYearEntries_one', few: 'condYearEntries_few', many: 'condYearEntries_many' };

/** "45 entries" in the current language. */
export function useEntriesText() {
  const { t, lang } = useI18n();
  return (n: number) => fill(t(ENTRIES[pluralForm(lang, n)]), { n });
}

/** The Day view's event badge, with its text ("!" for a symptom, "F" Frontline, "D" deworming). */
function Badge({ type }: { type: EventDoc['event']['type'] }) {
  const kind = BADGE_FOR[type];
  if (!kind) {
    return (
      <span className="day-card__glyph" aria-hidden="true">
        <DotsIcon />
      </span>
    );
  }
  return <EventBadge kind={kind} text={kind === 'sym' ? '!' : kind === 'front' ? 'F' : kind === 'worm' ? 'D' : ''} />;
}

/** The cut-down text of a result: a window around the first match, highlighted. */
const Snip = ({ text, tokens }: { text: string; tokens: Tokens }) => <Hl text={snippet(text, tokens)} tokens={tokens} />;

/**
 * An event as the Day view's tappable card plus its date at the right. Extras (services, documents, condition tags,
 * photo captions) show only when they are why it matched; the type label shows when the type word is why (README).
 */
export function EventResult({ doc, tokens, kinds, onOpen }: { doc: EventDoc; tokens: Tokens; kinds: readonly Kind[]; onOpen: () => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const e = doc.event;
  const docWord = t(TYPE_WORD.doc);
  const own = doc.kindWords[0]?.words[0] ?? '';
  // Every type word that a typed word matched through, and is not already in the head, shows muted after the title
  // ("Heartburn · Symptom", "Vet visit · Maple Vet · Photo"): a match always lands on visible, highlighted text.
  const headText = e.type === 'vet' ? `${own} ${doc.title}` : doc.title;
  const why = doc.kindWords
    .filter((k) => k.kind !== 'doc')
    .flatMap((k) => k.words)
    .filter((w) => hasToken(w, tokens) && !hasToken(headText, [{ raw: norm(nfc(w)), stem: '' }]));
  const labels = why.length > 0 && (
    <>
      {why.map((w) => (
        <Fragment key={w}>
          {' '}
          <span className="search-res__kind">
            {'· '}
            <Hl text={w} tokens={tokens} />
          </span>
        </Fragment>
      ))}
    </>
  );
  const head: ReactNode =
    e.type === 'vet' ? (
      <>
        <Hl text={own} tokens={tokens} />
        {doc.title && (
          <>
            {' · '}
            <Hl text={doc.title} tokens={tokens} />
          </>
        )}
        {labels}
      </>
    ) : (
      <>
        <Hl text={doc.title} tokens={tokens} />
        {labels}
      </>
    );
  const showDocs = kinds.includes('doc') || hasToken(docWord, tokens);
  const docs = doc.docs.filter((d) => showDocs || hasToken(d, tokens));
  const services = doc.services.filter((s) => hasToken(s.label, tokens) || (s.alias && hasToken(s.alias, tokens)));
  const captions = doc.captions.filter((c) => hasToken(c, tokens));
  const tags = doc.conditions.filter((c) => hasToken(c.name, tokens));
  const main = (
    <>
      <span className="search-res__top">
        <span className="day-card__head">
          <Badge type={e.type} />
          <span>{head}</span>
        </span>
        <span className="search-res__date">{f.shortDate(doc.date)}</span>
      </span>
      {doc.text && (
        <span className="day-card__text">
          <Snip text={doc.text} tokens={tokens} />
        </span>
      )}
      {captions.map((c) => (
        <span key={c} className="day-card__text">
          <Snip text={c} tokens={tokens} />
        </span>
      ))}
      {(services.length > 0 || docs.length > 0) && (
        <span className="day-card__chips">
          {services.map((s) => (
            <span key={s.label} className="day-card__chip">
              <Hl text={s.label} tokens={tokens} />
              {s.alias && !hasToken(s.label, tokens) && (
                <>
                  {' · '}
                  <Hl text={s.alias} tokens={tokens} />
                </>
              )}
            </span>
          ))}
          {docs.map((d) => (
            <span key={d} className="day-card__chip">
              <Hl text={docWord} tokens={tokens} />
              {' · '}
              <Hl text={d} tokens={tokens} />
            </span>
          ))}
        </span>
      )}
      {tags.length > 0 && (
        <span className="cond-tags">
          {tags.map((c) => (
            <span key={c.id} className="cond-tag">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" />
                <circle cx="12" cy="12" r="2.5" fill="currentColor" />
              </svg>
              <span>
                <Hl text={c.name} tokens={tokens} />
              </span>
            </span>
          ))}
        </span>
      )}
    </>
  );
  return (
    <button type="button" className="day-card day-card--tap search-res" onClick={onOpen}>
      {doc.firstPhoto ? (
        <span className="search-res__withthumb">
          <span className="search-res__main">{main}</span>
          <PhotoThumb photo={doc.firstPhoto} size="sm" />
        </span>
      ) : (
        main
      )}
    </button>
  );
}

/**
 * Consecutive entries in one card of rows (like the Day view's list), so 60 doses are not 60 cards. Amount, day part and
 * item name are highlighted only when they were searched (an item kind or an item is chosen); the state and note always.
 */
export function EntryRows({ docs, tokens, scoped, onOpen }: { docs: EntryDoc[]; tokens: Tokens; scoped: boolean; onOpen: (d: EntryDoc) => void }) {
  const f = useFormat();
  const mark = (text: string) => (scoped ? <Hl text={text} tokens={tokens} /> : text);
  return (
    <div className="day-card">
      <ul className="day-card__rows">
        {docs.map((d) => (
          <li key={d.id} className="search-dose">
            <button type="button" className="day-card__row day-card__row--desc" onClick={() => onOpen(d)}>
              <span className="day-card__row-label search-dose__label">
                <DoseMark colour={d.item?.colour ?? 'mark-neutral'} size={d.item ? markSize(d.item) : 'small'} state={d.state} />
                <span>
                  {mark(d.name)}{' '}
                  <span className="search-dose__sub">
                    · {mark(d.partLabel)} · <span className="search-nowrap">{f.shortDate(d.date)}</span>
                  </span>
                </span>
              </span>
              <span className="day-card__row-value search-dose__value">
                {d.state === 'skipped' || d.state === 'partial' ? (
                  <span className={`day-tag day-tag--${d.state}`}>
                    <Hl text={d.stateWord} tokens={tokens} />
                    {d.stateAlias && hasToken(d.stateAlias, tokens) && !hasToken(d.stateWord, tokens) && (
                      <>
                        {' · '}
                        <Hl text={d.stateAlias} tokens={tokens} />
                      </>
                    )}
                  </span>
                ) : (
                  mark(d.amount)
                )}
              </span>
              {d.note && (
                <span className="day-card__row-desc">
                  <Snip text={d.note} tokens={tokens} />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** An item (food, medication, supplement, treat, procedure): name, kind, entry count, last date; opens its history. */
export function ItemResult({ doc, tokens, onOpen }: { doc: ItemDoc; tokens: Tokens; onOpen: () => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const entries = useEntriesText();
  const flavours = doc.flavours.filter((fl) => hasToken(fl, tokens));
  const name = doc.item.name;
  return (
    <button type="button" className="day-card day-card--tap cond-card search-item" onClick={onOpen}>
      <span className="search-item__lead">
        <DoseMark colour={doc.item.colour} size={markSize(doc.item)} state="given" />
      </span>
      <span className="cond-card__text">
        <span className="day-card__head">
          <span>
            <Hl text={name} tokens={tokens} />
            {flavours.length > 0 && (
              <>
                {', '}
                <Hl text={flavours.join(', ')} tokens={tokens} />
              </>
            )}
          </span>
        </span>
        <span className="cond-card__meta">
          <Hl text={doc.kindWord} tokens={tokens} /> · {entries(doc.count)}
          {doc.last ? ` · ${fill(t('searchLast'), { d: f.dayMonth(doc.last) })}` : ''}
        </span>
      </span>
      <span className="cond-card__chev" aria-hidden="true">
        <ChevronIcon size={16} />
      </span>
    </button>
  );
}

/** A tracked condition (open or resolved); opens its page. */
export function ConditionResult({ doc, tokens, onOpen }: { doc: ConditionDoc; tokens: Tokens; onOpen: () => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const c = doc.condition;
  const when = c.resolvedOn ? `${f.dayMonth(c.startedOn)} – ${f.dayMonth(c.resolvedOn)}` : fill(t('condSince'), { d: f.dayMonth(c.startedOn) });
  return (
    <button type="button" className={`day-card day-card--tap cond-card${c.resolvedOn ? ' cond-card--resolved' : ''}`} onClick={onOpen}>
      <span className="cond-card__text">
        <span className="day-card__head">
          <span>
            <Hl text={c.name} tokens={tokens} />
          </span>
        </span>
        <span className="cond-card__meta">{when}</span>
        {hasToken(c.description, tokens) && (
          <span className="day-card__text search-clamp">
            <Snip text={c.description} tokens={tokens} />
          </span>
        )}
      </span>
      <span className="cond-card__chev" aria-hidden="true">
        <ChevronIcon size={16} />
      </span>
    </button>
  );
}

/** A pinned note; opens the existing note sheet. */
export function PinnedResult({ doc, tokens, onOpen }: { doc: PinnedDoc; tokens: Tokens; onOpen: () => void }) {
  const { title, body } = doc.note;
  return (
    <button type="button" className="day-card day-card--tap search-res" onClick={onOpen}>
      <span className="search-res__top">
        <span className="day-card__head">
          <EventBadge kind="note" text="" />
          {title ? (
            <span>
              <Hl text={title} tokens={tokens} />
            </span>
          ) : (
            <span className="search-clamp search-res__plain">
              <Snip text={body} tokens={tokens} />
            </span>
          )}
        </span>
      </span>
      {title && (
        <span className="day-card__text search-clamp">
          <Snip text={body} tokens={tokens} />
        </span>
      )}
    </button>
  );
}
