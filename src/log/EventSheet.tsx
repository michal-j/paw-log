import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SERVICE_MAX_LENGTH, SERVICES_MAX, type AlsoDone, type Condition, type EventType, type HealthEvent, type PlainDate } from '../data';
import { PlusIcon } from '../components/icons';
import { Chip, Chips, Field, Sheet } from '../components/Sheet';
import { fill, useI18n, type MessageKey } from '../i18n';
import { useFormat } from './format';
import * as act from './actions';
import { DateLine, OTHER } from './fields';
import { BUILT_IN_SERVICES, ownServices, resolveService } from './services';
import { useBusy } from './useBusy';
import { useDraftIds } from './useDraftIds';
import { useLog, type EventKind } from './LogProvider';
import { SYMPTOMS, isIntensity, propsFor, symptomKey, symptomTitle } from './symptoms';
import { ConditionPicker } from '../tracked/ConditionPicker';
import { nextPosition, photosOf } from '../photos/model';
import { LocalThumb, PhotoPick, PhotoThumb } from '../photos/PhotoParts';
import type { PreparedPhoto } from '../photos/resize';
import { DocumentSheet, DocumentsField, docUploads, useDocDrafts, type DocTarget } from '../documents/DocumentsField';
import { docsOf, nextDocPosition } from '../documents/model';

type OtherType = 'frontline' | 'deworming' | 'anal_glands' | 'nails' | 'other';
const OTHER_TYPES: readonly { type: OtherType; label: MessageKey }[] = [
  { type: 'frontline', label: 'kFront' },
  { type: 'deworming', label: 'copy.102' },
  { type: 'anal_glands', label: 'label.117' },
  { type: 'nails', label: 'label.118' },
  { type: 'other', label: 'other' },
];
const ADD_TITLE: Record<EventKind, MessageKey> = { symptom: 'symptom.139', vet: 'visit.146', note: 'note.153', other: 'addOther' };

/** Which sheet edits an event of this type. Photo events have their own sheet (src/photos/PhotoSheet). */
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
  /** Own services typed in this form, newest first: offered as chips even before they are saved. */
  addedServices: AlsoDone[];
  /** The "+ Add service" field: closed (null) or open with its text. */
  serviceDraft: string | null;
  detail: string;
  /** Linked tracked conditions, including new ones in `pending`. */
  conditionIds: string[];
  /** Conditions named with "+ New" here; created on Save (only those still picked). */
  pending: Condition[];
  /** Photos picked here, saved with the event (symptom, vet visit, note). */
  newPhotos: PreparedPhoto[];
  photoErr: boolean;
  err: boolean;
}

function initial(kind: EventKind, date: PlainDate, event: HealthEvent | undefined, ctxOpen: boolean, linkTo?: string): Form {
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
    addedServices: [],
    serviceDraft: null,
    detail: event?.detail ?? '',
    conditionIds: event ? [...event.conditionIds] : linkTo ? [linkTo] : [],
    pending: [],
    newPhotos: [],
    photoErr: false,
    err: false,
  };
}

/** Symptom, vet visit, note and other events (Frontline, deworming, anal glands, nails, other). */
export function EventSheet({
  kind,
  date,
  event,
  ctxOpen = false,
  linkTo,
  onShowDay,
}: {
  kind: EventKind;
  date: PlainDate;
  event?: HealthEvent;
  ctxOpen?: boolean;
  /** Started from a condition page: linked to it, and that page stays after saving. */
  linkTo?: string;
  onShowDay: (date: PlainDate) => void;
}) {
  const { t } = useI18n();
  const f = useFormat();
  const { records, repository, run, close, setOverlay } = useLog();
  const { busy, guard } = useBusy();
  // A new event keeps its id across Save attempts, so a retry never adds a copy (JCB-71).
  const draft = useDraftIds();
  const [form, setForm] = useState<Form>(() => initial(kind, date, event, ctxOpen, linkTo));
  const [preparing, setPreparing] = useState(false);
  // PDFs (JCB-76): the entry's saved ones, the ones picked here, and the Document sheet over this one.
  const storedDocs = event && records ? docsOf(event.id, records.documents) : [];
  const docs = useDocDrafts(storedDocs.length);
  const [docTarget, setDocTarget] = useState<DocTarget | null>(null);
  const serviceInput = useRef<HTMLInputElement>(null);
  const addingService = form.serviceDraft !== null;
  useEffect(() => {
    if (addingService) serviceInput.current?.focus();
  }, [addingService]);
  if (!records) return null;
  const photos = event ? photosOf(event.id, records.photos) : [];
  const withPhotos = kind !== 'other';
  const withDocs = kind === 'vet' || kind === 'note';
  const set = (patch: Partial<Form>) => setForm((x) => ({ ...x, ...patch }));

  const clinics = [...new Set(records.events.filter((e) => e.type === 'vet' && e.title).map((e) => e.title))];

  const build = (): Omit<HealthEvent, 'id' | 'dogId' | 'date' | 'conditionIds'> | null => {
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
    // A note made with Add document on a condition has no text: the PDF is what it holds.
    if (kind === 'note') return detail || storedDocs.length > 0 || docs.drafts.length > 0 ? { type: 'note', title: '', detail, props: {}, intensity: null, alsoDone: [] } : null;
    if (!form.type || (form.type === 'other' && !title)) return null;
    return { type: form.type, title: form.type === 'other' ? title : '', detail, props: {}, intensity: null, alsoDone: [] };
  };

  const canSave = kind !== 'other' || form.type !== null;
  const save = async () => {
    const fields = build();
    if (!fields) return set({ err: true });
    // New conditions named here start on the event's date; only those still picked are created.
    const created = form.pending.filter((c) => form.conditionIds.includes(c.id)).map((c) => ({ ...c, startedOn: form.date }));
    const next: HealthEvent = { id: event?.id ?? draft.id('event'), dogId: records.dogId, date: form.date, conditionIds: form.conditionIds, ...fields };
    // New photos keep their ids across Save attempts too: a retry uploads to the same paths.
    const photoId = draft.seq('photo');
    const start = nextPosition(photos);
    const add = form.newPhotos.map((p, i) => ({
      photo: { id: photoId(), dogId: records.dogId, eventId: next.id, width: p.width, height: p.height, takenAt: p.takenAt, caption: '', position: start + i },
      files: { full: p.full, thumb: p.thumb },
    }));
    // New PDFs: sent first, one failure stops the whole save (nothing half-saved) and marks its row.
    let failed = false;
    const uploads = docUploads(
      docs.drafts,
      docs.patch,
      (d, position) => ({ id: d.id, dogId: records.dogId, eventId: next.id, name: d.name, sizeBytes: d.sizeBytes, pageCount: d.pageCount, position }),
      nextDocPosition(storedDocs),
    ).map((u) => ({ ...u, onFail: () => ((failed = true), u.onFail?.()) }));
    docs.start();
    const ok = await run(() => act.saveEvent(repository, next, event ?? null, created, { add }, { add: uploads }), t('toastSaved'));
    docs.settle();
    if (ok) {
      close();
      if (!linkTo) onShowDay(next.date);
    } else if (failed) docs.setError({ kind: 'failed' });
  };
  const remove = async () => {
    if (event && (await run(() => act.deleteEvent(repository, event, photos, storedDocs), t('toastEventDeleted')))) close();
  };

  // Own services: those used in earlier visits of this dog (most recent first), after the ones typed here.
  const known = [...form.addedServices, ...ownServices(records.events)];
  const ownChips = known.filter((x, i) => known.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);
  const toggleService = (value: AlsoDone) =>
    form.alsoDone.includes(value)
      ? set({ alsoDone: form.alsoDone.filter((x) => x !== value) })
      : form.alsoDone.length < SERVICES_MAX && set({ alsoDone: [...form.alsoDone, value] });
  const addService = () => {
    const chips = [...BUILT_IN_SERVICES.map((b) => b.value), ...ownChips];
    const value = resolveService(form.serviceDraft ?? '', chips);
    if (!value) return serviceInput.current?.focus();
    const isNew = !chips.includes(value);
    setForm((x) => ({
      ...x,
      addedServices: isNew ? [value, ...x.addedServices] : x.addedServices,
      alsoDone: x.alsoDone.includes(value) || x.alsoDone.length >= SERVICES_MAX ? x.alsoDone : [...x.alsoDone, value],
      serviceDraft: null,
    }));
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
            {BUILT_IN_SERVICES.map((a) => (
              <Chip key={a.value} mode="toggle" on={form.alsoDone.includes(a.value)} onClick={() => toggleService(a.value)}>
                {t(a.label)}
              </Chip>
            ))}
            {ownChips.map((c) => (
              <Chip key={c} mode="toggle" on={form.alsoDone.includes(c)} onClick={() => toggleService(c)}>
                {c}
              </Chip>
            ))}
            {!addingService && form.alsoDone.length < SERVICES_MAX && (
              <button type="button" className="chip" aria-label={t('addService')} onClick={() => set({ serviceDraft: '' })}>
                <span className="chip__mark">
                  <PlusIcon size={12} />
                </span>
                {t('addService')}
              </button>
            )}
          </Chips>
          {addingService && (
            <div className="input-row cond-new-row">
              <input
                ref={serviceInput}
                className="input"
                aria-label={t('serviceName')}
                placeholder={t('servicePh')}
                maxLength={SERVICE_MAX_LENGTH}
                value={form.serviceDraft ?? ''}
                onChange={(e) => set({ serviceDraft: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addService();
                  }
                }}
              />
              <button type="button" className="btn btn--ghost btn--lg" onClick={addService}>
                {t('label.172')}
              </button>
            </div>
          )}
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
    <>
      <Sheet
        title={event ? t('editEvent') : t(ADD_TITLE[kind])}
        // Escape closes the Document sheet over this one, not this one too.
        onClose={() => !docTarget && close()}
        footer={
          <>
            {event && (
              <button type="button" className="btn btn--ghost btn--lg btn--danger" disabled={busy} onClick={guard(remove)}>
                {t('delete')}
              </button>
            )}
            <button type="button" className="btn btn--primary btn--lg" disabled={busy || preparing || docs.reading || !canSave} onClick={guard(save)}>
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
        {withPhotos && (
          <Field label={t('chips.109')} hint={optional} error={form.photoErr ? t('photoUnreadable') : undefined}>
            <div className="photo-row photo-row--field">
              {photos.map((p) => (
                <PhotoThumb
                  key={p.id}
                  photo={p}
                  size="sm"
                  label={fill(t('photoAlt'), { d: f.shortDate(form.date) })}
                  onOpen={() => setOverlay({ kind: 'viewer', ids: photos.map((x) => x.id), index: Math.max(0, photos.indexOf(p)) })}
                />
              ))}
              {form.newPhotos.map((p, i) => (
                <LocalThumb key={i} file={p.thumb} />
              ))}
              <PhotoPick
                variant="sm"
                label={t('addPhoto')}
                onPicked={(p) => setForm((x) => ({ ...x, newPhotos: [...x.newPhotos, p], photoErr: false }))}
                onError={() => set({ photoErr: true })}
                onBusy={setPreparing}
              />
            </div>
          </Field>
        )}
        {withDocs && (
          <DocumentsField
            stored={storedDocs}
            drafts={docs.drafts}
            error={docs.error}
            reading={docs.reading}
            room={docs.room}
            saving={busy}
            onPick={(f) => void docs.pick(f)}
            onOpen={setDocTarget}
            onRetry={() => void guard(save)()}
          />
        )}
        <ConditionPicker
          conditions={records.conditions}
          pending={form.pending}
          selected={form.conditionIds}
          onToggle={(id) =>
            set({ conditionIds: form.conditionIds.includes(id) ? form.conditionIds.filter((x) => x !== id) : [...form.conditionIds, id] })
          }
          onAdd={(name) => {
            const c: Condition = { id: act.newId(), dogId: records.dogId, name, startedOn: form.date, description: '', resolvedOn: null, position: 0 };
            set({ pending: [...form.pending, c], conditionIds: [...form.conditionIds, c.id] });
          }}
        />
      </Sheet>
      {docTarget && (
        // Over this sheet, not inside it; keyed per document so its name field starts from that document's name.
        <DocumentSheet
          key={docTarget.kind === 'stored' ? docTarget.doc.id : docTarget.id}
          target={docTarget}
          drafts={docs.drafts}
          onRenameDraft={docs.rename}
          onRemoveDraft={docs.remove}
          onClose={() => setDocTarget(null)}
        />
      )}
    </>
  );
}

