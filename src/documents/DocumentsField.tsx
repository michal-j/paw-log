import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { DOCS_MAX, DemoRepository, type DocFile } from '../data';
import { DocIcon, OpenOutIcon } from '../components/icons';
import { Field, Sheet } from '../components/Sheet';
import { fill, useI18n } from '../i18n';
import * as act from '../log/actions';
import { useLog } from '../log/LogProvider';
import { useBusy } from '../log/useBusy';
import { FileList, FileRow, useDocMeta, type FileState } from './FileRow';
import { checkPick, cleanDocName, formatSize, nameFromFile } from './model';
import { readPdf } from './pdf';
import { useDocumentLink } from './useDocumentUrl';
import { useOpenDocument } from './StoredFileRow';
import './documents.css';

/** A PDF picked in a form and not saved yet: it is sent when the form is saved. */
export interface DraftDoc {
  /** Made when it is picked and kept, so a retry sends to the same path and saves the same row. */
  id: string;
  name: string;
  file: Blob;
  sizeBytes: number;
  pageCount: number | null;
  state: FileState;
  /** 0 to 100 while `uploading`. */
  progress: number;
  /** Sent already by an earlier attempt of this Save: not sent again. */
  sent: boolean;
}

/** What went wrong with a pick or a save, said under the Documents field. */
export type DocError = { kind: 'tooBig'; name: string; size: string } | { kind: 'unreadable' } | { kind: 'failed' } | null;

/** The PDFs picked in a form (see DraftDoc) and the error to show; `stored`: how many the entry has already. */
export function useDocDrafts(stored: number) {
  const { repository, records } = useLog();
  const [drafts, setDrafts] = useState<DraftDoc[]>([]);
  const latest = useRef(drafts);
  useEffect(() => {
    latest.current = drafts;
  }, [drafts]);
  const [error, setError] = useState<DocError>(null);
  const [reading, setReading] = useState(false);
  const room = DOCS_MAX - stored - drafts.length;

  const patch = useCallback((id: string, change: Partial<DraftDoc>) => {
    setDrafts((list) => list.map((d) => (d.id === id ? { ...d, ...change } : d)));
  }, []);

  /** Take the files of PDFs already sent by a failed Save out of storage again (no row points at them). Best effort. */
  const purge = useCallback(
    (list: DraftDoc[]) => {
      const dogId = records?.dogId;
      const sent = dogId ? list.filter((d) => d.sent).map((d) => ({ id: d.id, dogId })) : [];
      if (sent.length) void repository.purgeDocumentFiles(sent).catch(() => undefined);
    },
    [repository, records],
  );

  const pick = async (file: File) => {
    if (room <= 0) return;
    const problem = checkPick(file);
    if (problem === 'tooBig') return setError({ kind: 'tooBig', name: file.name, size: formatSize(file.size) });
    if (problem) return setError({ kind: 'unreadable' });
    setReading(true);
    try {
      const info = await readPdf(file);
      const name = nameFromFile(file.name) || file.name.slice(0, 120);
      setDrafts((list) => [
        ...list,
        { id: act.newId(), name, file, sizeBytes: file.size, pageCount: info.pageCount, state: 'ready', progress: 0, sent: false },
      ]);
      setError(null);
    } catch {
      setError({ kind: 'unreadable' });
    } finally {
      setReading(false);
    }
  };

  return {
    drafts,
    error,
    setError,
    reading,
    room,
    pick,
    patch,
    rename: (id: string, name: string) => setDrafts((list) => list.map((d) => (d.id === id ? { ...d, name: cleanDocName(name, d.name) } : d))),
    remove: (id: string) => {
      purge(latest.current.filter((d) => d.id === id));
      setDrafts((list) => list.filter((d) => d.id !== id));
    },
    /** The form is closed without a finished Save: PDFs a failed attempt already sent are removed from storage. */
    discard: () => purge(latest.current),
    /** After a Save that did not finish: a PDF that was still going is ready to try again (a failed one keeps its mark). */
    settle: () => setDrafts((list) => list.map((d) => (d.state === 'uploading' ? { ...d, state: 'ready' } : d))),
    /** Before a Save: every PDF not sent yet shows as waiting to go. */
    start: () => {
      setError(null);
      setDrafts((list) => list.map((d) => (d.sent ? d : { ...d, state: 'uploading', progress: 0 })));
    },
  };
}

/** The upload entries `act.saveEvent` takes, wired to the drafts' rows. */
export function docUploads(
  drafts: DraftDoc[],
  patch: (id: string, change: Partial<DraftDoc>) => void,
  make: (d: DraftDoc, position: number) => DocFile,
  firstPosition: number,
): act.DocumentUpload[] {
  return drafts.map((d, i) => ({
    doc: make(d, firstPosition + i),
    file: d.file,
    skip: d.sent,
    onProgress: (f) => patch(d.id, { state: 'uploading', progress: f * 100 }),
    onSent: () => patch(d.id, { state: 'ready', progress: 100, sent: true }),
    onFail: () => patch(d.id, { state: 'failed' }),
  }));
}

/** The text under the Documents field for an error. */
export function useDocErrorText() {
  const { t } = useI18n();
  return (error: DocError): string | undefined => {
    if (!error) return undefined;
    if (error.kind === 'tooBig') return fill(t('docTooBig'), { name: error.name, size: error.size });
    return t(error.kind === 'failed' ? 'docSaveFailed' : 'docUnreadable');
  };
}

/**
 * PdfPick: opens the phone's Files browser for one PDF. A plain file input (accept PDF); the choice
 * goes to `onFile`. `variant`: the ghost "Add PDF" button of a form, or the dashed "Choose a PDF" tile.
 */
export function PdfPick({
  variant,
  disabled,
  busy,
  onFile,
  children,
}: {
  variant: 'button' | 'tile';
  disabled?: boolean;
  busy?: boolean;
  onFile: (file: File) => void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const label = children ?? t(variant === 'tile' ? 'docPick' : 'docPdf');
  return (
    <>
      {variant === 'tile' ? (
        <button type="button" className="photo-pick doc-pick" disabled={disabled || busy} aria-busy={busy || undefined} onClick={() => input.current?.click()}>
          <span className="photo-pick__icon" aria-hidden="true">
            <DocIcon size={22} />
          </span>
          {label}
        </button>
      ) : (
        <button type="button" className="btn btn--ghost btn--md doc-add" disabled={disabled || busy} aria-busy={busy || undefined} onClick={() => input.current?.click()}>
          <span className="btn__icon" aria-hidden="true">
            <DocIcon size={16} />
          </span>
          {label}
        </button>
      )}
      <input
        ref={input}
        className="doc-input"
        type="file"
        accept="application/pdf,.pdf"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="doc-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (input.current) input.current.value = ''; // the same file can be picked again
          if (file) onFile(file);
        }}
      />
    </>
  );
}

/** Which document the Document sheet is open on. */
export type DocTarget = { kind: 'stored'; doc: DocFile } | { kind: 'draft'; id: string };

/**
 * The Documents field of an event form (vet visit, note): the entry's PDFs as rows (a tap opens the
 * Document sheet), the Add PDF button and the limits. A picked file shows up at once and is sent on Save.
 */
export function DocumentsField({
  stored,
  drafts,
  error,
  reading,
  room,
  saving,
  onPick,
  onOpen,
  onRetry,
}: {
  stored: DocFile[];
  drafts: DraftDoc[];
  error: DocError;
  reading: boolean;
  room: number;
  /** Save is running: the field is read-only meanwhile. */
  saving: boolean;
  onPick: (file: File) => void;
  onOpen: (target: DocTarget) => void;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  const { repository } = useLog();
  const errorText = useDocErrorText()(error);
  const isDemo = repository instanceof DemoRepository;
  return (
    <Field label={t('docsHead')} hint={t('optional')} error={errorText}>
      {stored.length + drafts.length > 0 && (
        <FileList variant="form">
          {stored.map((d) => (
            <FileRow key={d.id} name={d.name} sizeBytes={d.sizeBytes} pageCount={d.pageCount} mode="form" onPress={() => onOpen({ kind: 'stored', doc: d })} />
          ))}
          {drafts.map((d) => (
            <FileRow
              key={d.id}
              name={d.name}
              sizeBytes={d.sizeBytes}
              pageCount={d.pageCount}
              mode="form"
              state={d.state}
              progress={d.progress}
              onPress={() => onOpen({ kind: 'draft', id: d.id })}
              onRetry={onRetry}
            />
          ))}
        </FileList>
      )}
      {room > 0 && <PdfPick variant="button" disabled={saving} busy={reading} onFile={onPick} />}
      {!errorText && <p className="field__note">{t(room > 0 ? 'docLimit' : 'docMax')}</p>}
      {isDemo && <p className="field__note">{t('docDemo')}</p>}
    </Field>
  );
}

/**
 * The Document sheet (design D5): Name, Open and Remove document. A saved document is renamed or removed
 * at once (with Undo, as a photo is); one picked and not sent yet is renamed or dropped in the form.
 */
export function DocumentSheet({
  target,
  drafts,
  onRenameDraft,
  onRemoveDraft,
  onClose,
}: {
  target: DocTarget;
  drafts: DraftDoc[];
  onRenameDraft: (id: string, name: string) => void;
  onRemoveDraft: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { repository, run } = useLog();
  const { busy, guard } = useBusy();
  const draft = target.kind === 'draft' ? drafts.find((d) => d.id === target.id) : undefined;
  const stored = target.kind === 'stored' ? target.doc : undefined;
  const current = stored ?? draft;
  const [name, setName] = useState(current?.name ?? '');
  const link = useDocumentLink(stored ?? null);
  const open = useOpenDocument();
  const metaOf = useDocMeta();
  if (!current) return null;

  const save = async () => {
    const next = cleanDocName(name, current.name);
    if (draft) onRenameDraft(draft.id, next);
    else if (stored && next !== stored.name) {
      if (!(await run(() => act.renameDocument(repository, { ...stored, name: next }, stored), t('toastSaved')))) return;
    }
    onClose();
  };
  const remove = async () => {
    if (draft) {
      onRemoveDraft(draft.id);
      onClose();
    } else if (stored && (await run(() => act.deleteDocument(repository, stored), t('docRemoved')))) onClose();
  };

  return (
    <Sheet
      title={t('docTitle')}
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--primary btn--lg" disabled={busy} onClick={guard(save)}>
          {t('save')}
        </button>
      }
    >
      <Field label={t('docName')} htmlFor="doc-name">
        <input id="doc-name" className="input" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <p className="field__note doc-sheet__note">{`PDF · ${metaOf(current.sizeBytes, current.pageCount)}`}</p>
      <div className={`two${stored ? '' : ' two--one'}`}>
        {stored && (
          <button type="button" className="btn btn--ghost btn--lg" onClick={() => open(stored, link)}>
            <span className="btn__icon" aria-hidden="true">
              <OpenOutIcon />
            </span>
            {t('docOpen')}
          </button>
        )}
        <button type="button" className="btn btn--ghost btn--lg btn--danger" disabled={busy} onClick={guard(remove)}>
          {t('docRemove')}
        </button>
      </div>
    </Sheet>
  );
}
