import { useState, type ReactNode } from 'react';
import type { DayPart, PlainDate } from '../data';
import { EventBadge } from '../components/EventBadge';
import { BowlIcon, DotsIcon, NoteIcon, PillIcon } from '../components/icons';
import { Sheet } from '../components/Sheet';
import { useI18n, type MessageKey } from '../i18n';
import { DAY_PARTS } from '../timeline/model';
import { groupOf, type KindGroup } from './amount';
import { DateLine } from './fields';
import { useFormat } from './format';
import { useLog, type EventKind, type Records } from './LogProvider';
import { matchDay, slotsOn } from './plan';

/** Without a part: the first part with an open usual-day item of that kind (food 4, medication 1 otherwise). */
function firstOpenPart(records: Records, date: PlainDate, group: KindGroup): DayPart {
  const { filled } = matchDay(date, records.slots, records.entries);
  const kindOf = new Map(records.items.map((i) => [i.id, groupOf(i.kind)]));
  const open = slotsOn(records.slots, date).filter((s) => !filled.has(s.id) && kindOf.get(s.itemId) === group);
  return DAY_PARTS.find((p) => open.some((s) => s.dayPart === p)) ?? (group === 'food' ? 4 : 1);
}

/**
 * + Add: the one way in. From the navbar it offers Food, Medication, Symptom, Vet visit, Note and
 * Other; from a day part's + it offers Food and Medication with that part set.
 */
export function AddSheet({ date: initialDate, part }: { date: PlainDate; part?: DayPart }) {
  const { t } = useI18n();
  const f = useFormat();
  const { records, open, close } = useLog();
  const [date, setDate] = useState(initialDate);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [atPart, setAtPart] = useState(part);
  if (!records) return null;

  const entry = (group: KindGroup) =>
    open({ kind: 'entry', group, date, part: atPart ?? firstOpenPart(records, date, group), ctxOpen });
  const event = (type: EventKind) => open({ kind: 'event', type, date, ctxOpen });

  const option = (key: string, icon: ReactNode, label: MessageKey, onClick: () => void) => (
    <button key={key} type="button" className="btn btn--ghost add-opt" onClick={onClick}>
      <span className="add-opt__icon">{icon}</span>
      <span className="add-opt__text">{t(label)}</span>
    </button>
  );

  return (
    <Sheet title={part ? `${t('addAria')}${f.part(part)}` : t('label.172')} onClose={close}>
      <DateLine
        date={date}
        part={atPart}
        open={ctxOpen}
        today={records.today}
        onOpen={() => setCtxOpen(true)}
        onDate={setDate}
        onPart={part ? setAtPart : undefined}
      />
      <div className="add-grid">
        {option('food', <BowlIcon />, 'title.104', () => entry('food'))}
        {option('med', <PillIcon />, 'title.106', () => entry('med'))}
        {!part && (
          <>
            {option('symptom', <EventBadge kind="sym" text="!" />, 'symptom.140', () => event('symptom'))}
            {option('vet', <EventBadge kind="vet" text="" />, 'copy.101', () => event('vet'))}
            {option('note', <NoteIcon />, 'note.154', () => event('note'))}
            {option('other', <DotsIcon />, 'otherEvent', () => event('other'))}
          </>
        )}
      </div>
    </Sheet>
  );
}
