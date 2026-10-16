import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DayPart, DayPartTimes, Entry, HealthEvent, Item, PlainDate, Repository, ScheduleSlot } from '../data';
import { useI18n } from '../i18n';
import type { KindGroup } from './amount';
import type { Undo } from './actions';

/** Everything the Day view, the Usual day and the sheets read. Reloaded after every write. */
export interface Records {
  dogId: string;
  items: Item[];
  slots: ScheduleSlot[];
  entries: Entry[];
  events: HealthEvent[];
  times: DayPartTimes;
  today: PlainDate;
}

export type EventKind = 'symptom' | 'vet' | 'note' | 'other';

export type SheetState =
  | { kind: 'add'; date: PlainDate; part?: DayPart }
  | { kind: 'entry'; group: KindGroup; date: PlainDate; part: DayPart; entry?: Entry; slot?: ScheduleSlot; ctxOpen?: boolean }
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
  sheet: SheetState | null;
  open: (sheet: SheetState) => void;
  close: () => void;
  /**
   * Run a write, then reload and show `message` with Undo (when the write returns one).
   * On failure: reload and show the generic error. Resolves true on success.
   */
  run: (work: () => Promise<Undo | null>, message: string | (() => string)) => Promise<boolean>;
  /** Reload everything (after a reset, say). */
  reload: () => void;
  toast: Toast | null;
  undoToast: () => void;
  dismissToast: () => void;
}

const Context = createContext<LogApi | null>(null);
const TOAST_MS = 5000;

async function loadRecords(repository: Repository): Promise<Records> {
  const today = repository.today();
  const [dog, items, slots, entries, events, times] = await Promise.all([
    repository.getDog(),
    repository.listItems(),
    repository.listScheduleSlots(),
    repository.listEntries({ to: today }),
    repository.listEvents({ to: today }),
    repository.getDayPartTimes(),
  ]);
  return { dogId: dog.id, items, slots, entries, events, times, today };
}

export function LogProvider({ repository, children }: { repository: Repository; children: ReactNode }) {
  const { t } = useI18n();
  const [version, setVersion] = useState(0);
  const [records, setRecords] = useState<Records | null>(null);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    let live = true;
    loadRecords(repository).then(
      (next) => live && setRecords(next),
      () => live && setRecords((r) => r), // keep what is shown; error state not designed yet
    );
    return () => {
      live = false;
    };
  }, [repository, version]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const show = useCallback((text: string, undo?: Undo) => {
    if (timer.current) clearTimeout(timer.current);
    const id = ++seq.current;
    setToast({ id, text, undo });
    timer.current = setTimeout(() => setToast((x) => (x?.id === id ? null : x)), TOAST_MS);
  }, []);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const run = useCallback(
    async (work: () => Promise<Undo | null>, message: string | (() => string)) => {
      try {
        const undo = await work();
        reload();
        show(typeof message === 'string' ? message : message(), undo ?? undefined);
        return true;
      } catch {
        reload();
        show(t('auth.errUnknown'));
        return false;
      }
    },
    [reload, show, t],
  );

  const undoToast = useCallback(() => {
    const undo = toast?.undo;
    setToast(null);
    if (!undo) return;
    undo().then(reload, () => {
      reload();
      show(t('auth.errUnknown'));
    });
  }, [toast, reload, show, t]);

  const value = useMemo<LogApi>(
    () => ({
      repository,
      version,
      records,
      sheet,
      open: setSheet,
      close: () => setSheet(null),
      run,
      reload,
      toast,
      undoToast,
      dismissToast: () => setToast(null),
    }),
    [repository, version, records, sheet, run, reload, toast, undoToast],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLog(): LogApi {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useLog must be used inside LogProvider');
  return ctx;
}
