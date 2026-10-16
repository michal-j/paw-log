import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DayPart, DayPartTimes, DogSettings, Entry, HealthEvent, Item, PlainDate, RemovedSlot, Repository, ScheduleSlot } from '../data';
import { useI18n } from '../i18n';
import { logStartOf } from '../timeline/model';
import type { KindGroup } from './amount';
import type { Undo } from './actions';

/** Everything the Day view, the Usual day and the sheets read. Reloaded after every write. */
export interface Records {
  dogId: string;
  items: Item[];
  slots: ScheduleSlot[];
  entries: Entry[];
  /** Usual-day items removed for a day. */
  removed: RemovedSlot[];
  events: HealthEvent[];
  times: DayPartTimes;
  settings: DogSettings;
  /** The first day offered ("Log starts on", set or derived): the Timeline and Day view reach back to it. */
  logStart: PlainDate;
  today: PlainDate;
  /** The `version` these records were loaded for: older than `LogApi.version` while a reload runs. */
  version: number;
}

export type EventKind = 'symptom' | 'vet' | 'note' | 'other';

export type SheetState =
  | { kind: 'add'; date: PlainDate; part?: DayPart }
  | {
      kind: 'entry';
      group: KindGroup;
      date: PlainDate;
      part: DayPart;
      entry?: Entry;
      slot?: ScheduleSlot;
      /** Logging a slot removed for the day: the new entry takes the marker's place (and id). */
      replaces?: RemovedSlot;
      ctxOpen?: boolean;
    }
  | { kind: 'event'; type: EventKind; date: PlainDate; event?: HealthEvent; ctxOpen?: boolean }
  | { kind: 'slot'; date: PlainDate; part: DayPart; slot?: ScheduleSlot }
  | { kind: 'menu' };

interface Toast {
  id: number;
  text: string;
  undo?: Undo;
}

interface LogApi {
  repository: Repository;
  /** Bumped after every write; views reload on it. */
  version: number;
  records: Records | null;
  /** The last load failed (offline, server); records keep what was loaded before, if anything. */
  loadFailed: boolean;
  sheet: SheetState | null;
  open: (sheet: SheetState) => void;
  close: () => void;
  /**
   * Run a write, then reload and show `message` with Undo (when the write returns one).
   * On failure: reload and show the generic error. Resolves true on success.
   */
  run: (work: () => Promise<Undo | null>, message: string | (() => string | null)) => Promise<boolean>;
  /** Reload everything (after a reset, say). */
  reload: () => void;
  toast: Toast | null;
  undoToast: () => void;
  dismissToast: () => void;
}

const Context = createContext<LogApi | null>(null);
const TOAST_MS = 5000;

/** A failed load is tried again after this long, and whenever the app comes back to the foreground or online. */
const RETRY_MS = 4000;

async function loadRecords(repository: Repository, version: number): Promise<Records> {
  const today = repository.today();
  const [dog, items, slots, entries, removed, events, times, settings] = await Promise.all([
    repository.getDog(),
    repository.listItems(),
    repository.listScheduleSlots(),
    repository.listEntries({ to: today }),
    repository.listRemovedSlots({ to: today }),
    repository.listEvents({ to: today }),
    repository.getDayPartTimes(),
    repository.getSettings(),
  ]);
  const logStart = logStartOf({ today, setting: settings.logStart, entries, events, slotStarts: slots.map((x) => x.activeFrom) });
  return { dogId: dog.id, items, slots, entries, removed, events, times, settings, logStart, today, version };
}

export function LogProvider({ repository, children }: { repository: Repository; children: ReactNode }) {
  const { t } = useI18n();
  const [version, setVersion] = useState(0);
  const [records, setRecords] = useState<Records | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  // Writes run one after another, in the order they were asked for, so two quick changes cannot
  // reach the server out of order (the later one must win).
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let live = true;
    loadRecords(repository, version).then(
      (next) => {
        if (!live) return;
        setRecords(next);
        setLoadFailed(false);
      },
      // Keep what is shown and try again shortly; the views say that loading failed.
      () => live && setLoadFailed(true),
    );
    return () => {
      live = false;
    };
  }, [repository, version]);

  // After a failed load: try again after a pause, when the app comes back to the foreground, or online.
  useEffect(() => {
    if (!loadFailed) return;
    const retry = () => reload();
    const id = setTimeout(retry, RETRY_MS);
    const onVisible = () => document.visibilityState === 'visible' && retry();
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(id);
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // version: every new attempt that fails arms the next one.
  }, [loadFailed, version, reload]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const show = useCallback((text: string, undo?: Undo) => {
    if (timer.current) clearTimeout(timer.current);
    const id = ++seq.current;
    setToast({ id, text, undo });
    timer.current = setTimeout(() => setToast((x) => (x?.id === id ? null : x)), TOAST_MS);
  }, []);

  /** Queue `work` after every write already asked for. */
  const enqueue = useCallback(<T,>(work: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(work, work);
    queue.current = next.catch(() => undefined);
    return next;
  }, []);

  const run = useCallback(
    async (work: () => Promise<Undo | null>, message: string | (() => string | null)) => {
      try {
        const undo = await enqueue(work);
        reload();
        const text = typeof message === 'string' ? message : message();
        if (text !== null) show(text, undo ?? undefined);
        return true;
      } catch {
        reload();
        show(t('auth.errUnknown'));
        return false;
      }
    },
    [enqueue, reload, show, t],
  );

  const undoToast = useCallback(() => {
    const undo = toast?.undo;
    setToast(null);
    if (!undo) return;
    enqueue(undo).then(reload, () => {
      reload();
      show(t('auth.errUnknown'));
    });
  }, [toast, enqueue, reload, show, t]);

  const value = useMemo<LogApi>(
    () => ({
      repository,
      version,
      records,
      loadFailed,
      sheet,
      open: setSheet,
      close: () => setSheet(null),
      run,
      reload,
      toast,
      undoToast,
      dismissToast: () => setToast(null),
    }),
    [repository, version, records, loadFailed, sheet, run, reload, toast, undoToast],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLog(): LogApi {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useLog must be used inside LogProvider');
  return ctx;
}
