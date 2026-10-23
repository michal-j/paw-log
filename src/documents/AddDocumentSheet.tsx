import { useState } from 'react';
import type { PlainDate } from '../data';
import { Field, Sheet } from '../components/Sheet';
import { fill, useI18n } from '../i18n';
import * as act from '../log/actions';
import { DateLine } from '../log/fields';
import { useLog } from '../log/LogProvider';
import { useBusy } from '../log/useBusy';
import { useDraftIds } from '../log/useDraftIds';
import { DemoRepository } from '../data';
import { PdfPick, docUploads, useDocDrafts, useDocErrorText } from './DocumentsField';
import { FileList, FileRow } from './FileRow';
import { cleanDocName } from './model';

/**
 * Add document on a condition page (design D3-D6): choose a PDF, name it, pick the date (today), Save.
 * It is saved as a Note on that date linked to the condition, with the PDF attached, so the document
 * shows in the condition's Documents and History, and in the Day view, like its photos do.
 */
export function AddDocumentSheet({ date, condition: conditionId }: { date: PlainDate; condition: string }) {
  const { t } = useI18n();
  const { records, repository, run, close } = useLog();
  const { busy, guard } = useBusy();
  // The note keeps its id across Save attempts, so a retry never adds a copy (JCB-71).
  const draft = useDraftIds();
  const docs = useDocDrafts(0);
  const errorText = useDocErrorText()(docs.error);
  const [form, setForm] = useState({ date, ctxOpen: false, name: '', named: false });
  if (!records) return null;
  const condition = records.conditions.find((c) => c.id === conditionId);
  const file = docs.drafts[0];
  const isDemo = repository instanceof DemoRepository;

  const save = async () => {
    if (!file) return;
    const name = cleanDocName(form.named ? form.name : file.name, file.name);
    const eventId = draft.id('event');
    let failed = false;
    const uploads = docUploads(
      [{ ...file, name }],
      docs.patch,
      (d, position) => ({ id: d.id, dogId: records.dogId, eventId, name: d.name, sizeBytes: d.sizeBytes, pageCount: d.pageCount, position }),
      0,
    ).map((u) => ({
      ...u,
      onFail: () => {
        failed = true;
        u.onFail?.();
      },
    }));
    const note = { id: eventId, dogId: records.dogId, date: form.date, type: 'note' as const, title: '', detail: '', conditionIds: [conditionId] };
    docs.start();
    const ok = await run(() => act.saveEvent(repository, note, null, [], {}, { add: uploads }), t('toastSaved'));
    docs.settle();
    if (ok) close();
    else if (failed) docs.setError({ kind: 'failed' });
  };

  return (
    <Sheet
      title={t('docAddTitle')}
      onClose={() => {
        docs.discard();
        close();
      }}
      footer={
        <button type="button" className="btn btn--primary btn--lg" disabled={busy || !file || docs.reading} onClick={guard(save)}>
          {t('save')}
        </button>
      }
    >
      {!file ? (
        <div className="field">
          <PdfPick variant="tile" busy={docs.reading} onFile={(f) => void docs.pick(f)} />
          {errorText ? (
            <p className="field__error" role="alert">
              {errorText}
            </p>
          ) : (
            <p className="field__note">{t('docLimitOne')}</p>
          )}
        </div>
      ) : (
        <>
          <Field label={t('docName')} htmlFor="doc-add-name">
            <input
              id="doc-add-name"
              className="input"
              maxLength={120}
              disabled={busy}
              value={form.named ? form.name : file.name}
              onChange={(e) => setForm((x) => ({ ...x, name: e.target.value, named: true }))}
            />
          </Field>
          <DateLine
            date={form.date}
            open={form.ctxOpen}
            today={records.today}
            onOpen={() => setForm((x) => ({ ...x, ctxOpen: true }))}
            onDate={(d) => setForm((x) => ({ ...x, date: d }))}
          />
          <div className="field">
            <FileList variant="form">
              <FileRow
                name={cleanDocName(form.named ? form.name : file.name, file.name)}
                sizeBytes={file.sizeBytes}
                pageCount={file.pageCount}
                mode="form"
                state={file.state}
                progress={file.progress}
                onRetry={() => void guard(save)()}
              />
            </FileList>
            {errorText ? (
              <p className="field__error" role="alert">
                {errorText}
              </p>
            ) : (
              condition && <p className="field__note">{fill(t('docLinked'), { x: condition.name })}</p>
            )}
            {isDemo && <p className="field__note">{t('docDemo')}</p>}
          </div>
        </>
      )}
    </Sheet>
  );
}
