// Documents (JCB-76): pure derivations for the Day view, the condition page and the forms.
// No React, no I/O: unit-tested in tests/documents.test.ts.
import { DOCS_MAX, DOC_MAX_BYTES, DOC_NAME_MAX_LENGTH, type DocFile, type HealthEvent } from '../data';
import { EVENT_ORDER } from '../day/model';

/** A document with the event it belongs to (its date and links). */
export interface DocItem {
  doc: DocFile;
  event: HealthEvent;
}

const byPosition = (a: DocFile, b: DocFile) => a.position - b.position || a.id.localeCompare(b.id);

/** An event's documents in their order. */
export function docsOf(eventId: string, docs: DocFile[]): DocFile[] {
  return docs.filter((d) => d.eventId === eventId).sort(byPosition);
}

/** Position for a document added after `existing`. */
export const nextDocPosition = (existing: DocFile[]) => existing.reduce((max, d) => Math.max(max, d.position + 1), 0);

/**
 * A condition's documents: those of the events linked to it, newest first (the list is read from the
 * top, the latest result first), within a day in the Day view's card order.
 */
export function conditionDocs(conditionId: string, events: HealthEvent[], docs: DocFile[]): DocItem[] {
  const sorted = events
    .filter((e) => e.conditionIds.includes(conditionId))
    .sort((a, b) => b.date.localeCompare(a.date) || EVENT_ORDER.indexOf(a.type) - EVENT_ORDER.indexOf(b.type) || a.id.localeCompare(b.id));
  return sorted.flatMap((event) => docsOf(event.id, docs).map((doc) => ({ doc, event })));
}

/** "850 KB" below a megabyte, else megabytes with one decimal and a comma ("1,2 MB"), in both languages. */
export function formatSize(bytes: number): string {
  const kb = Math.max(1, Math.round(bytes / 1024));
  if (kb < 1000) return `${kb} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.0', '').replace('.', ',')} MB`;
}

/** The size as the limit message says it: whole megabytes, "14 MB". */
export const formatSizeShort = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

/** A file name as the document's starting name: without ".pdf", trimmed, within the limit. */
export function nameFromFile(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, '').trim();
  return base.slice(0, DOC_NAME_MAX_LENGTH).trim();
}

/** What is stored: trimmed, within the limit; an emptied name falls back to the previous one. */
export function cleanDocName(name: string, fallback: string): string {
  return name.trim().slice(0, DOC_NAME_MAX_LENGTH).trim() || fallback;
}

export type PickProblem = 'tooBig' | 'notPdf';

/** Whether a picked file may be added: a PDF (by its type or name), not over the size limit. */
export function checkPick(file: Pick<File, 'name' | 'size' | 'type'>): PickProblem | null {
  const looksPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!looksPdf) return 'notPdf';
  if (file.size > DOC_MAX_BYTES) return 'tooBig';
  if (file.size === 0) return 'notPdf';
  return null;
}

/** Room left for one more document on an entry. */
export const canAddDoc = (count: number) => count < DOCS_MAX;
