import { useState, type ReactNode } from 'react';
import type { DayPart, PlainDate } from '../data';
import { EventBadge } from '../components/EventBadge';
import { BowlIcon, DotsIcon, NoteIcon, PillIcon } from '../components/icons';
import { Sheet } from '../components/Sheet';
import { useI18n, type MessageKey } from '../i18n';
import { DAY_PARTS } from '../timeline/model';
import type { KindGroup } from './amount';
import { DateLine } from './fields';
import { useFormat } from './format';
import { useLog, type EventKind, type Records } from './LogProvider';

/** Without a part: the part of the day it is now (the last one whose usual time has passed). */
export function partNow(times: Records['times'], now: string): DayPart {
  return [...DAY_PARTS].reverse().find((p) => times[p] <= now) ?? 1;
}

/**
 * + Add: the one way in. From the navbar it offers Food, Medication, Symptom, Vet visit, Note and
 * Other; from a day part's + it offers Food and Medication with that part set.
 */
export function AddSheet({ date: initialDate, part }: { date: PlainDate; part?: DayPart }) {
  const { t } = useI18n();
  const f = useFormat();
  const { records, repository, open, close } = useLog();
  const [date, setDate] = useState(initialDate);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [atPart, setAtPart] = useState(part);
  if (!records) return null;

  const entry = (group: KindGroup) =>
    open({ kind: 'entry', group, date, part: atPart ?? partNow(records.times, repository.nowTime()), ctxOpen });
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
