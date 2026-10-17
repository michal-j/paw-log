import { useState } from 'react';
import { DemoRepository, type Condition, type HealthEvent, type Photo, type PlainDate } from '../data';
import { Field, Sheet } from '../components/Sheet';
import { useI18n } from '../i18n';
import * as act from '../log/actions';
import { DateLine } from '../log/fields';
import { useLog } from '../log/LogProvider';
import { useBusy } from '../log/useBusy';
import { useDraftIds } from '../log/useDraftIds';
import { ConditionPicker } from '../tracked/ConditionPicker';
import { photoDate, photosOf } from './model';
import { PhotoPick, useObjectUrl } from './PhotoParts';
import type { PreparedPhoto } from './resize';
import { usePhotoUrl } from './usePhotoUrl';
import './photos.css';

interface Form {
  date: PlainDate;
  ctxOpen: boolean;
  /** The date was taken from the picked photo. */
  fromPhoto: boolean;
  /** A newly picked picture (new photo, or Change on an existing one). */
  picked: PreparedPhoto | null;
  caption: string;
  conditionIds: string[];
  pending: Condition[];
  err: 'missing' | 'unreadable' | null;
}

/**
 * Add photo / Edit photo (design P50-P55). A new photo is a `photo` event with one photo: pick or
 * take it, its date comes from the photo when it has one (editable), link conditions, describe it.
 * Editing a standalone photo changes the same things; a photo on a vet visit, symptom or note keeps
 * its event's date and links and has its own description. Change replaces the picture, Delete has
 * Undo (a photo event with no photo left goes too).
 */
export function PhotoSheet({
  date,
  photo,
  ctxOpen = false,
  linkTo,
  onShowDay,
}: {
  date: PlainDate;
  photo?: Photo;
  ctxOpen?: boolean;
  /** Started from a condition page: linked to it, and that page stays after saving. */
  linkTo?: string;
  onShowDay: (date: PlainDate) => void;
}) {
  const { t } = useI18n();
  const { records, repository, run, close } = useLog();
  const { busy, guard } = useBusy();
  // New rows (event, photo) keep their ids across Save attempts, so a retry uploads to the same paths
  // and upserts the same rows instead of adding copies (JCB-71).
  const draft = useDraftIds();
  const event: HealthEvent | undefined = photo ? records?.events.find((e) => e.id === photo.eventId) : undefined;
  const attached = !!event && event.type !== 'photo';
  const [form, setForm] = useState<Form>(() => ({
    date: event?.date ?? date,
    ctxOpen,
    fromPhoto: false,
    picked: null,
    caption: (attached ? photo?.caption : event?.detail) ?? '',
    conditionIds: event ? [...event.conditionIds] : linkTo ? [linkTo] : [],
    pending: [],
    err: null,
  }));
  const [preparing, setPreparing] = useState(false);
  const stored = usePhotoUrl(photo && !form.picked ? photo : null, 'full');
  const pickedUrl = useObjectUrl(form.picked?.full ?? null);
  if (!records || (photo && !event)) return null;
  const set = (patch: Partial<Form>) => setForm((x) => ({ ...x, ...patch }));
  const isDemo = repository instanceof DemoRepository;

  const onPicked = (p: PreparedPhoto) => {
    // The photo's own date becomes the event's date (for a new or standalone photo), still editable.
    const taken = attached ? null : photoDate(p.takenAt, records.today);
    set({ picked: p, err: null, ...(taken ? { date: taken, fromPhoto: true } : { fromPhoto: false }) });
  };

  const save = async () => {
    if (!photo && !form.picked) return set({ err: 'missing' });
    const caption = form.caption.trim();
    const created = form.pending.filter((c) => form.conditionIds.includes(c.id)).map((c) => ({ ...c, startedOn: form.date }));
    const eventId = event?.id ?? draft.id('event');
    const added = form.picked
      ? {
          photo: {
            id: draft.id('photo'),
            dogId: records.dogId,
            eventId,
            width: form.picked.width,
            height: form.picked.height,
            takenAt: form.picked.takenAt,
            caption: attached ? caption : '',
            position: photo?.position ?? 0,
          },
          files: { full: form.picked.full, thumb: form.picked.thumb },
        }
      : null;
    let next: HealthEvent;
    if (attached && event) next = event;
    else {
      const base: HealthEvent = event ?? { id: eventId, dogId: records.dogId, date: form.date, type: 'photo', title: '', detail: '', conditionIds: [] };
      next = { ...base, date: form.date, detail: caption, conditionIds: form.conditionIds };
    }
    const changes: act.PhotoChanges = {
      add: added ? [added] : [],
      remove: added && photo ? [photo] : [],
      update: !added && photo && attached && photo.caption !== caption ? [{ next: { ...photo, caption }, prev: photo }] : [],
    };
    if (await run(() => act.saveEvent(repository, next, event ?? null, attached ? [] : created, changes), t('toastSaved'))) {
      close();
      if (!photo && !linkTo) onShowDay(next.date);
    }
  };
  const remove = async () => {
    if (!photo || !event) return;
    const siblings = photosOf(event.id, records.photos);
    if (await run(() => act.deletePhoto(repository, photo, event, siblings), t('photoToastDeleted'))) close();
  };

  const preview = pickedUrl ?? stored;
  const hasPicture = !!form.picked || !!photo;
  return (
    <Sheet
      title={photo ? t('photoEditTitle') : t('addPhoto')}
      onClose={close}
      footer={
        <>
          {photo && (
            <button type="button" className="btn btn--ghost btn--lg btn--danger" disabled={busy} onClick={guard(remove)}>
              {t('delete')}
            </button>
          )}
          <button type="button" className="btn btn--primary btn--lg" disabled={busy || preparing} onClick={guard(save)}>
            {t('save')}
          </button>
        </>
      }
    >
      {!attached && (
        <DateLine
          date={form.date}
          note={form.fromPhoto ? t('photoDateFrom') : undefined}
          open={form.ctxOpen}
          today={records.today}
          onOpen={() => set({ ctxOpen: true })}
          onDate={(d) => set({ date: d, fromPhoto: false })}
        />
      )}
      <div className="field">
        {hasPicture ? (
          <div className="photo-preview">
            {preview ? <img src={preview} alt="" /> : <span className="photo-preview__blank" />}
            <PhotoPick variant="change" onPicked={onPicked} onError={() => set({ err: 'unreadable' })} onBusy={setPreparing}>
              {t('change')}
            </PhotoPick>
          </div>
        ) : (
          <PhotoPick variant="full" onPicked={onPicked} onError={() => set({ err: 'unreadable' })} onBusy={setPreparing}>
            {t('photoPick')}
          </PhotoPick>
        )}
        {form.picked && <p className="field__note">{t('photoResized')}</p>}
        {form.picked && isDemo && <p className="field__note">{t('photoDemoNote')}</p>}
        {form.err && (
          <p className="field__error" role="alert">
            {t(form.err === 'missing' ? 'photoErr' : 'photoUnreadable')}
          </p>
        )}
      </div>
      {!attached && (
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
      )}
      <Field label={t('photo.157')} hint={t('optional')} htmlFor="photo-caption">
        <textarea
          id="photo-caption"
          className="input"
          rows={2}
          maxLength={500}
          placeholder={t('photo.158')}
          value={form.caption}
          onChange={(e) => set({ caption: e.target.value })}
        />
      </Field>
    </Sheet>
  );
}
