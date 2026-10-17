import { useState } from 'react';
import type { PinnedNote } from '../data';
import { ChevronIcon, PinIcon, PlusIcon } from '../components/icons';
import { fill, useI18n, type MessageKey } from '../i18n';
import { pluralForm } from '../i18n/plural';
import { useFormat } from '../log/format';
import { useLog } from '../log/LogProvider';
import '../day/day.css';
import '../components/list.css';
import './pinned.css';

/** The notes in `order` (ids); notes not listed (added meanwhile) follow, in list order. */
const inOrder = (notes: PinnedNote[], order: string[] | null): PinnedNote[] => {
  if (!order) return notes;
  const byId = new Map(notes.map((n) => [n.id, n]));
  const listed = order.flatMap((id) => byId.get(id) ?? []);
  return [...listed, ...notes.filter((n) => !order.includes(n.id))];
};

/**
 * Pinned notes: standing facts both of us should always know. A card opens its sheet; Reorder turns
 * on up/down buttons (they work with one thumb, in a PWA and with VoiceOver) and becomes Done.
 */
export function PinnedNotes() {
  const { t, lang } = useI18n();
  const f = useFormat();
  const { records, open, repository, run } = useLog();
  // Non-null while reordering: the order shown, kept here so quick taps build on each other.
  const [order, setOrder] = useState<string[] | null>(null);
  const notes = inOrder(records?.pinned ?? [], order);
  const n = notes.length;

  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= n) return;
    const ids = notes.map((x) => x.id);
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    setOrder(ids);
    void run(async () => {
      await repository.reorderPinnedNotes(ids);
      return null;
    }, () => null);
  };

  const count = fill(t(`notes_${pluralForm(lang, n)}` as MessageKey), { n });

  return (
    <section className="list" aria-labelledby="pinned-title">
      <div className="usual__head">
        <div className="list__titlerow">
          <h2 id="pinned-title" className="usual__title">
            {t('pinned.31')}
          </h2>
          {/* While the list is empty, the empty state's button is the only "add" on screen. */}
          {n > 0 && (
            <button type="button" className="btn btn--ghost btn--md list__new" aria-label={t('addPinned')} onClick={() => open({ kind: 'pinned' })}>
              <span className="btn__icon">
                <PlusIcon />
              </span>
              {t('newShort')}
            </button>
          )}
        </div>
        <p className="usual__hint">{t('pinnedHint')}</p>
      </div>
      <div className="day__body">
        {records && n === 0 ? (
          <article className="day-card day-empty">
            <span className="day-empty__icon">
              <PinIcon active size={16} />
            </span>
            <div>
              <p className="day-empty__text">{t('pinEmpty')}</p>
              <button type="button" className="btn btn--primary btn--md" style={{ marginTop: 'var(--space-3)' }} onClick={() => open({ kind: 'pinned' })}>
                <span>
                  <PlusIcon />
                </span>
                {t('addPinned')}
              </button>
            </div>
          </article>
        ) : (
          n > 0 && (
            <>
              <div className="day__section">
                <h3 className="day__caption">{count}</h3>
                {n > 1 && (
                  <button type="button" className="day__link" onClick={() => setOrder(order ? null : notes.map((x) => x.id))}>
                    {t(order ? 'done' : 'reorder')}
                  </button>
                )}
              </div>
              <ul className="pin-list">
                {notes.map((note, i) => {
                  const card = (
                    <>
                      {note.title && <span className="day-card__head">{note.title}</span>}
                      <span className="day-card__text">{note.body}</span>
                      {note.updatedOn && <span className="pin-card__meta">{fill(t('editedOn'), { d: f.dayMonth(note.updatedOn) })}</span>}
                    </>
                  );
                  const cls = `day-card pin-card${note.title ? '' : ' pin-card--untitled'}`;
                  if (!order) {
                    return (
                      <li key={note.id}>
                        <button type="button" className={`${cls} day-card--tap`} onClick={() => open({ kind: 'pinned', note })}>
                          {card}
                        </button>
                      </li>
                    );
                  }
                  const name = note.title || note.body.slice(0, 24);
                  return (
                    <li key={note.id} className="pin-row">
                      <article className={cls}>{card}</article>
                      <div className="pin-move">
                        <button
                          type="button"
                          className="day-btn day-btn--step"
                          aria-label={fill(t('moveUp'), { x: name })}
                          aria-disabled={i === 0 ? true : undefined}
                          onClick={() => move(i, -1)}
                        >
                          <ChevronIcon dir="up" size={18} />
                        </button>
                        <button
                          type="button"
                          className="day-btn day-btn--step"
                          aria-label={fill(t('moveDown'), { x: name })}
                          aria-disabled={i === n - 1 ? true : undefined}
                          onClick={() => move(i, 1)}
                        >
                          <ChevronIcon dir="down" size={18} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )
        )}
      </div>
    </section>
  );
}
