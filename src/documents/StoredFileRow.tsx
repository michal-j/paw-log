import { useCallback } from 'react';
import type { DocFile } from '../data';
import { fill, useI18n } from '../i18n';
import { useLog } from '../log/LogProvider';
import { FileRow } from './FileRow';
import { formatSize } from './model';
import { openPdf } from './open';
import { useDocumentLink, type DocumentLink } from './useDocumentUrl';

/** Opens a stored document: call the result from the tap itself (see openPdf). */
export function useOpenDocument() {
  const { t } = useI18n();
  const { repository, notify } = useLog();
  return useCallback(
    (doc: DocFile, link: DocumentLink | null = null) =>
      openPdf({
        link,
        load: async () => (await repository.documentUrls([doc]))[doc.id] ?? null,
        onFail: () => notify(t('docOpenFailed')),
      }),
    [repository, notify, t],
  );
}

/**
 * A saved document as a row that opens it in the phone's PDF viewer. The link is made ahead of the
 * tap, so the tap can open the window at once.
 */
export function StoredFileRow({ doc, mode, date }: { doc: DocFile; mode: 'card' | 'page'; date?: string }) {
  const { t } = useI18n();
  const link = useDocumentLink(doc);
  const open = useOpenDocument();
  return (
    <FileRow
      name={doc.name}
      sizeBytes={doc.sizeBytes}
      pageCount={doc.pageCount}
      mode={mode}
      date={date}
      label={fill(t('docOpenLabel'), { name: doc.name, size: formatSize(doc.sizeBytes) })}
      onPress={() => open(doc, link)}
    />
  );
}
