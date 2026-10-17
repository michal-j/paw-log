import { useState } from 'react';
import type { PinnedNote } from '../data';
import { Field, Sheet } from '../components/Sheet';
import { useI18n } from '../i18n';
import * as act from '../log/actions';
import { useBusy } from '../log/useBusy';
import { useLog } from '../log/LogProvider';

/**
 * Add or edit a pinned note: optional title and the text. The fields keep their own state, so
 * typing, a failed check or a reload of the list behind the sheet never re-draws the sheet.
 * Delete has no confirmation, only Undo (as elsewhere in the app).
 */
export function PinnedSheet({ note }: { note?: PinnedNote }) {
  const { t } = useI18n();
  const { records, repository, run, close } = useLog();
  const { busy, guard } = useBusy();
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [err, setErr] = useState(false);

  const save = async () => {
    if (!records) return;
    if (!body.trim()) return setErr(true);
    const fields = { title: title.trim(), body: body.trim() };
    if (note && fields.title === note.title && fields.body === note.body) return close();
    // A new note goes on top. An edit keeps the position the note has now (it may have been moved since the sheet opened).
    const mine = records.pinned.find((n) => n.id === note?.id);
    const position = mine?.position ?? note?.position ?? (records.pinned.length ? Math.min(...records.pinned.map((n) => n.position)) - 1 : 0);
    const next: PinnedNote = { id: note?.id ?? act.newId(), dogId: records.dogId, position, ...fields };
    if (await run(() => act.savePinnedNote(repository, next, note ?? null), t('toastSaved'))) close();
  };
  const remove = async () => {
    if (note && (await run(() => act.deletePinnedNote(repository, note), t('toastPinDeleted')))) close();
  };

  return (
    <Sheet
      title={note ? t('editPinned') : t('addPinned')}
      onClose={close}
      footer={
        <>
          {note && (
            <button type="button" className="btn btn--ghost btn--lg btn--danger" disabled={busy} onClick={guard(remove)}>
              {t('delete')}
            </button>
          )}
          <button type="button" className="btn btn--primary btn--lg" disabled={busy} onClick={guard(save)}>
            {t('save')}
          </button>
        </>
      }
    >
      <Field label={t('pinTitle')} hint={t('optional')} htmlFor="pinned-title-input">
        <input id="pinned-title-input" className="input" value={title} autoComplete="off" onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label={t('pinText')} htmlFor="pinned-text-input" error={err ? t('pinTextErr') : undefined}>
        <textarea
          id="pinned-text-input"
          className="input"
          rows={6}
          placeholder={t('pinned.161')}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setErr(false);
          }}
        />
      </Field>
    </Sheet>
  );
}
