import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Condition, DayPart, DayPartTimes, DogSettings, Entry, HealthEvent, Item, PinnedNote, PlainDate, RemovedSlot, Repository, ScheduleSlot } from '../data';
import { useI18n } from '../i18n';
import { logStartOf } from '../timeline/model';
import type { KindGroup } from './amount';
import type { Undo } from './actions';
import { isItemColour, withItemColours } from './items';

/** Everything the Day view, the Usual day and the sheets read. Reloaded after every write. */
export interface Records {
  dogId: string;
  items: Item[];
  slots: ScheduleSlot[];
  entries: Entry[];
  /** Usual-day items removed for a day. */
  removed: RemovedSlot[];
  events: HealthEvent[];
  /** Tracked conditions, open and resolved. */
  conditions: Condition[];
  /** Pinned notes in list order. */
  pinned: PinnedNote[];
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
  /** `usual`: adding to the Usual day (a part's +): Food or Medication, then the usual-day form. */
  /** `condition`: + Add on a condition page: symptom, vet visit or note, already linked to it. */
  | { kind: 'add'; date: PlainDate; part?: DayPart; usual?: boolean; condition?: string }
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
  /** `linkTo`: a new event started from a condition page: linked to it, and the page stays after saving. */
  | { kind: 'event'; type: EventKind; date: PlainDate; event?: HealthEvent; ctxOpen?: boolean; linkTo?: string }
  /** Create (no `condition`) or edit a tracked condition. */
  | { kind: 'condition'; condition?: Condition }
  /** Mark a condition as resolved: asks for the date. */
  | { kind: 'resolve'; condition: Condition }
  | { kind: 'slot'; date: PlainDate; part: DayPart; slot?: ScheduleSlot; group?: KindGroup }
  /** After a usual-day change from a past date: log it on the past days where it is open? */
  | { kind: 'backfill'; slot: ScheduleSlot }
  /** A pinned note: a new one, or `note` to edit. */
  | { kind: 'pinned'; note?: PinnedNote }
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
   * On failure or time-out: reload and show "Couldn't save". Resolves true on success, false otherwise.
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

/**
 * `shown`: the colours shown so far for items that are still grey (no item colour saved yet), by id.
 * Updated here, so a reload after saving one item keeps the colours shown for the others.
 */
async function loadRecords(repository: Repository, version: number, shown: Map<string, string>): Promise<Records> {
  const today = repository.today();
  const [dog, items, slots, entries, removed, events, conditions, pinned, times, settings] = await Promise.all([
    repository.getDog(),
    repository.listItems(),
    repository.listScheduleSlots(),
    repository.listEntries({ to: today }),
    repository.listRemovedSlots({ to: today }),
    repository.listEvents({ to: today }),
    repository.listConditions(),
    repository.listPinnedNotes(),
    repository.getDayPartTimes(),
    repository.getSettings(),
  ]);
  const logStart = logStartOf({ today, setting: settings.logStart, entries, events, slotStarts: slots.map((x) => x.activeFrom) });
  // Items still grey (no item colour yet) show the colour the data migration gives them, and keep
  // it while they stay grey (JCB-59); the next save of the item stores it.
  const shownItems = withItemColours(items, shown);
  shown.clear();
  items.forEach((raw, i) => !isItemColour(raw.colour) && shown.set(raw.id, shownItems[i]!.colour));
  return { dogId: dog.id, items: shownItems, slots, entries, removed, events, conditions, pinned, times, settings, logStart, today, version };
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
  const shownColours = useRef(new Map<string, string>());

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let live = true;
    loadRecords(repository, version, shownColours.current).then(
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
        // Failed, or no answer in time (the repository's time limit, JCB-71): the sheet stays open
        // with what was typed and Save works again; a retry writes the same ids, so nothing doubles.
        reload();
        show(t('errSave'));
        return false;
      }
    },
    [enqueue, reload, show, t],
  );

  const undoToast = useCallback(() => {
    const undo = toast?.undo;
    setToast(null);
    if (!undo) return;
    // The past-days question belongs to the change being undone.
    setSheet((s) => (s?.kind === 'backfill' ? null : s));
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
