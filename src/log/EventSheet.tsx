import { useState, type ReactNode } from 'react';
import type { AlsoDone, EventType, HealthEvent, PlainDate } from '../data';
import { Chip, Chips, Field, Sheet } from '../components/Sheet';
import { useI18n, type MessageKey } from '../i18n';
import * as act from './actions';
import { DateLine, OTHER } from './fields';
import { useBusy } from './useBusy';
import { useDraftIds } from './useDraftIds';
import { useLog, type EventKind } from './LogProvider';
import { SYMPTOMS, isIntensity, propsFor, symptomKey, symptomTitle } from './symptoms';

type OtherType = 'frontline' | 'deworming' | 'anal_glands' | 'nails' | 'other';
const OTHER_TYPES: readonly { type: OtherType; label: MessageKey }[] = [
  { type: 'frontline', label: 'kFront' },
  { type: 'deworming', label: 'copy.102' },
  { type: 'anal_glands', label: 'label.117' },
  { type: 'nails', label: 'label.118' },
  { type: 'other', label: 'other' },
];
const ALSO: readonly { value: AlsoDone; label: MessageKey }[] = [
  { value: 'anal_glands', label: 'label.117' },
  { value: 'nails', label: 'label.118' },
];
const ADD_TITLE: Record<EventKind, MessageKey> = { symptom: 'symptom.139', vet: 'visit.146', note: 'note.153', other: 'addOther' };

/** Which sheet edits an event of this type. Photos are not edited here (attachments come later). */
export const eventKindOf = (type: EventType): EventKind | null =>
  type === 'symptom' || type === 'vet' || type === 'note' ? type : type === 'photo' ? null : 'other';

interface Form {
  date: PlainDate;
  ctxOpen: boolean;
  /** Symptom: a known symptom key, OTHER, or nothing picked yet. */
  symptom: MessageKey | typeof OTHER | null;
  /** Other: the type; nothing until one is picked. */
  type: OtherType | null;
  /** Free-text title: a typed symptom, the clinic, or what an "other" event was. */
  titleText: string;
  props: Record<string, string>;
  intensity: string;
  alsoDone: AlsoDone[];
  detail: string;
  err: boolean;
}

function initial(kind: EventKind, date: PlainDate, event: HealthEvent | undefined, ctxOpen: boolean): Form {
  const known = event?.type === 'symptom' ? symptomKey(event.title) : undefined;
  return {
    date: event?.date ?? date,
    ctxOpen,
    symptom: event?.type === 'symptom' ? (known ?? OTHER) : null,
    type: kind === 'other' && event ? (event.type as OtherType) : null,
    titleText: event && !(event.type === 'symptom' && known) && (kind === 'vet' || kind === 'other' || kind === 'symptom') ? event.title : '',
    props: { ...(event?.props ?? {}) },
    intensity: event?.intensity ?? '',
    alsoDone: [...(event?.alsoDone ?? [])],
    detail: event?.detail ?? '',
    err: false,
  };
}

/** Symptom, vet visit, note and other events (Frontline, deworming, anal glands, nails, other). */
export function EventSheet({
  kind,
  date,
  event,
  ctxOpen = false,
  onShowDay,
}: {
  kind: EventKind;
  date: PlainDate;
  event?: HealthEvent;
  ctxOpen?: boolean;
  onShowDay: (date: PlainDate) => void;
}) {
  const { t } = useI18n();
  const { records, repository, run, close } = useLog();
  const { busy, guard } = useBusy();
  // A new event keeps its id across Save attempts, so a retry never adds a copy (JCB-71).
  const draft = useDraftIds();
  const [form, setForm] = useState<Form>(() => initial(kind, date, event, ctxOpen));
  if (!records) return null;
  const set = (patch: Partial<Form>) => setForm((x) => ({ ...x, ...patch }));

  const clinics = [...new Set(records.events.filter((e) => e.type === 'vet' && e.title).map((e) => e.title))];

  const build = (): Omit<HealthEvent, 'id' | 'dogId' | 'date' | 'issueId'> | null => {
    const detail = form.detail.trim();
    const title = form.titleText.trim();
    if (kind === 'symptom') {
      if (!form.symptom || (form.symptom === OTHER && !title)) return null;
      const known = form.symptom === OTHER ? undefined : form.symptom;
      const defs = propsFor(known);
      const props: Record<string, string> = {};
      for (const d of defs) if (d.name !== 'intensity' && form.props[d.name]) props[d.name] = form.props[d.name] as string;
      const intensity = defs.some((d) => d.name === 'intensity') && isIntensity(form.intensity) ? form.intensity : null;
      return { type: 'symptom', title: known ? symptomTitle(known) : title, detail, props, intensity, alsoDone: [] };
    }
    if (kind === 'vet') return title || detail ? { type: 'vet', title, detail, props: {}, intensity: null, alsoDone: form.alsoDone } : null;
    if (kind === 'note') return detail ? { type: 'note', title: '', detail, props: {}, intensity: null, alsoDone: [] } : null;
    if (!form.type || (form.type === 'other' && !title)) return null;
    return { type: form.type, title: form.type === 'other' ? title : '', detail, props: {}, intensity: null, alsoDone: [] };
  };

  const canSave = kind !== 'other' || form.type !== null;
  const save = async () => {
    const fields = build();
    if (!fields) return set({ err: true });
    const next: HealthEvent = { id: event?.id ?? draft.id('event'), dogId: records.dogId, date: form.date, issueId: event?.issueId ?? null, ...fields };
    if (await run(() => act.saveEvent(repository, next, event ?? null), t('toastSaved'))) {
      close();
      onShowDay(next.date);
    }
  };
  const remove = async () => {
    if (event && (await run(() => act.deleteEvent(repository, event), t('toastEventDeleted')))) close();
  };

  const optional = t('optional');
  const detailField = (label: MessageKey, rows: number, placeholder?: MessageKey, error?: MessageKey) => (
    <Field label={t(label)} hint={error ? undefined : optional} htmlFor="event-detail" error={form.err && error ? t(error) : undefined}>
      <textarea
        id="event-detail"
        className="input"
        rows={rows}
        placeholder={placeholder ? t(placeholder) : undefined}
        value={form.detail}
        onChange={(e) => set({ detail: e.target.value, err: false })}
      />
    </Field>
  );

  let body: ReactNode;
  if (kind === 'symptom') {
    const known = form.symptom && form.symptom !== OTHER ? form.symptom : undefined;
    body = (
      <>
        <Field label={t('symptom.140')} error={form.err ? t('pickSymptom') : undefined}>
          <Chips label={t('symptom.140')}>
            {SYMPTOMS.map((k) => (
              <Chip key={k} on={form.symptom === k} onClick={() => set({ symptom: k, props: {}, intensity: '', err: false })}>
                {t(k)}
              </Chip>
            ))}
            <Chip on={form.symptom === OTHER} onClick={() => set({ symptom: OTHER, props: {}, err: false })}>
              {t('other')}
            </Chip>
          </Chips>
          {form.symptom === OTHER && (
            <input
              className="input"
              aria-label={t('otherSymptomPh')}
              placeholder={t('otherSymptomPh')}
              value={form.titleText}
              onChange={(e) => set({ titleText: e.target.value, err: false })}
            />
          )}
        </Field>
        {form.symptom &&
          propsFor(known).map((d) => {
            const value = d.name === 'intensity' ? form.intensity : (form.props[d.name] ?? '');
            const pick = (v: string) => {
              const nextValue = value === v ? '' : v;
              if (d.name === 'intensity') set({ intensity: nextValue });
              else set({ props: { ...form.props, [d.name]: nextValue } });
            };
            return (
              <Field key={d.name} label={t(d.label)} hint={optional}>
                <Chips label={t(d.label)} toggles>
                  {d.options.map((o) => (
                    <Chip key={o.value} mode="toggle" on={value === o.value} onClick={() => pick(o.value)}>
                      {o.label ? t(o.label) : o.text}
                    </Chip>
                  ))}
                </Chips>
              </Field>
            );
          })}
        {form.symptom && detailField('symptom.144', 2, 'note.155')}
      </>
    );
  } else if (kind === 'vet') {
    body = (
      <>
        <Field label={t('visit.147')} htmlFor="event-clinic">
          <input
            id="event-clinic"
            className="input"
            placeholder={t('visit.148')}
            value={form.titleText}
            onChange={(e) => set({ titleText: e.target.value, err: false })}
          />
          {clinics.length > 0 && (
            <Chips label={t('visit.147')}>
              {clinics.map((c) => (
                <Chip key={c} on={form.titleText === c} onClick={() => set({ titleText: c, err: false })}>
                  {c}
                </Chip>
              ))}
            </Chips>
          )}
        </Field>
        <Field label={t('visit.149')} htmlFor="event-detail" error={form.err ? t('writeClinic') : undefined}>
          <textarea id="event-detail" className="input" rows={3} value={form.detail} onChange={(e) => set({ detail: e.target.value, err: false })} />
        </Field>
        <Field label={t('visit.150')} hint={optional}>
          <Chips label={t('visit.150')} toggles>
            {ALSO.map((a) => (
              <Chip
                key={a.value}
                mode="toggle"
                on={form.alsoDone.includes(a.value)}
                onClick={() =>
                  set({ alsoDone: form.alsoDone.includes(a.value) ? form.alsoDone.filter((x) => x !== a.value) : [...form.alsoDone, a.value] })
                }
              >
                {t(a.label)}
              </Chip>
            ))}
          </Chips>
        </Field>
      </>
    );
  } else if (kind === 'note') {
    body = detailField('note.154', 4, 'note.155', 'writeNote');
  } else {
    body = (
      <>
        <Field label={t('typeLbl')}>
          <Chips label={t('typeLbl')}>
            {OTHER_TYPES.map((o) => (
              <Chip key={o.type} on={form.type === o.type} onClick={() => set({ type: o.type, err: false })}>
                {t(o.label)}
              </Chip>
            ))}
          </Chips>
        </Field>
        {form.type === 'other' && (
          <Field label={t('titleLbl')} htmlFor="event-title" error={form.err ? t('writeTitle') : undefined}>
            <input
              id="event-title"
              className="input"
              placeholder={t('titlePh')}
              value={form.titleText}
              onChange={(e) => set({ titleText: e.target.value, err: false })}
            />
          </Field>
        )}
        {detailField('symptom.144', 2, 'note.155')}
      </>
    );
  }

  return (
    <Sheet
      title={event ? t('editEvent') : t(ADD_TITLE[kind])}
      onClose={close}
      footer={
        <>
          {event && (
            <button type="button" className="btn btn--ghost btn--lg btn--danger" disabled={busy} onClick={guard(remove)}>
              {t('delete')}
            </button>
          )}
          <button type="button" className="btn btn--primary btn--lg" disabled={busy || !canSave} onClick={guard(save)}>
            {t('save')}
          </button>
        </>
      }
    >
      <DateLine
        date={form.date}
        open={form.ctxOpen}
        today={records.today}
        onOpen={() => set({ ctxOpen: true })}
        onDate={(d) => set({ date: d })}
      />
      {body}
    </Sheet>
  );
}

