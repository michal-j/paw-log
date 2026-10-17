import { useCallback, useEffect, useState } from 'react';
import { DemoRepository, type PlainDate, type Repository } from './data';
import { DayView } from './day/DayView';
import { useI18n } from './i18n';
import { Brand } from './components/Brand';
import { MenuIcon, PinIcon, PlusIcon, TimelineIcon, TrackedIcon } from './components/icons';
import { AddSheet } from './log/AddSheet';
import { BackfillSheet } from './log/BackfillSheet';
import { EntrySheet } from './log/EntrySheet';
import { EventSheet } from './log/EventSheet';
import { LogProvider, useLog } from './log/LogProvider';
import { MenuSheet } from './log/MenuSheet';
import { SlotSheet } from './log/SlotSheet';
import { dayPath, parseRoute, routePath, tabPath, timelinePath, usualPath, type Route } from './routes';
import { PinnedNotes } from './pinned/PinnedNotes';
import { PinnedSheet } from './pinned/PinnedSheet';
import { Timeline } from './timeline/Timeline';
import { TrackedPlaceholder } from './tracked/TrackedPlaceholder';
import { UsualDay } from './usual/UsualDay';
import { ErrorBoundary } from './components/ErrorBoundary';
import './components/controls.css';

/** What PawLog keeps in `history.state`. */
interface HistoryState {
  /** Timeline entries: the list scroll position to restore. */
  scrollTop?: number;
  /** Entries pushed from inside the app: Back can simply go back in history. */
  fromTimeline?: boolean;
  fromApp?: boolean;
}

const historyState = (): HistoryState => (window.history.state as HistoryState | null) ?? {};

interface Location {
  route: Route;
  scrollTop: number;
}

/** Read the address bar; anything that is not a valid route is rewritten to the Timeline. */
function readLocation(): Location {
  const route = parseRoute(window.location.pathname);
  const path = routePath(route);
  if (path !== window.location.pathname) window.history.replaceState(null, '', path);
  return { route, scrollTop: historyState().scrollTop ?? 0 };
}

/**
 * Home: the Timeline; a row opens the Day view, where entries and events are logged and edited.
 * `onSignOut` is passed for the real (signed-in) app only; demo mode has no account.
 */
export function App({ repository, onSignOut }: { repository: Repository; onSignOut?: () => void }) {
  return (
    <ErrorBoundary>
      <LogProvider repository={repository}>
        <Shell repository={repository} onSignOut={onSignOut} />
      </LogProvider>
    </ErrorBoundary>
  );
}

function Shell({ repository, onSignOut }: { repository: Repository; onSignOut?: () => void }) {
  const { t } = useI18n();
  const log = useLog();
  const { open, close, reload } = log;
  const isDemo = repository instanceof DemoRepository;
  const [loc, setLoc] = useState<Location>(readLocation);
  const { route } = loc;
  const base = route.base;

  useEffect(() => {
    const onPop = () => setLoc(readLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openDay = useCallback(
    (date: PlainDate, scrollTop: number) => {
      window.history.replaceState({ ...historyState(), scrollTop }, '');
      window.history.pushState({ fromTimeline: true } satisfies HistoryState, '', dayPath(base, date));
      setLoc({ route: { base, view: 'day', date }, scrollTop });
    },
    [base],
  );

  const toTimeline = useCallback(() => {
    if (historyState().fromTimeline) {
      window.history.back(); // popstate restores the Timeline entry and its scroll position
      return;
    }
    window.history.replaceState(null, '', timelinePath(base));
    setLoc({ route: { base, view: 'timeline' }, scrollTop: 0 });
  }, [base]);

  const leaveInvalidDay = useCallback(() => {
    window.history.replaceState(null, '', timelinePath(base));
    setLoc({ route: { base, view: 'timeline' }, scrollTop: 0 });
  }, [base]);

  // Previous/next replace the entry, so Back (in the app or the browser) returns straight to the Timeline.
  const stepDay = useCallback(
    (date: PlainDate) => {
      window.history.replaceState(historyState(), '', dayPath(base, date));
      setLoc((l) => ({ ...l, route: { base, view: 'day', date } }));
    },
    [base],
  );

  /** After saving: show the day the entry or event was saved on. */
  const showDay = useCallback(
    (date: PlainDate) => {
      if (route.view === 'day' && route.date === date) return;
      if (route.view === 'day') return stepDay(date);
      const state: HistoryState = route.view === 'timeline' ? { fromTimeline: true } : { fromApp: true };
      window.history.pushState(state, '', dayPath(base, date));
      setLoc((l) => ({ ...l, route: { base, view: 'day', date } }));
    },
    [route, base, stepDay],
  );

  const openUsual = useCallback(
    (date?: PlainDate) => {
      close();
      if (route.view === 'usual' && route.date === date) return;
      window.history.pushState({ fromApp: true } satisfies HistoryState, '', usualPath(base, date));
      setLoc((l) => ({ ...l, route: { base, view: 'usual', date } }));
    },
    [route, base, close],
  );

  const leaveUsual = useCallback(() => {
    if (historyState().fromApp) {
      window.history.back();
      return;
    }
    const date = route.view === 'usual' ? route.date : undefined;
    const path = date ? dayPath(base, date) : timelinePath(base);
    window.history.replaceState(null, '', path);
    setLoc({ route: date ? { base, view: 'day', date } : { base, view: 'timeline' }, scrollTop: 0 });
  }, [route, base]);

  /** The Pinned and Tracked tabs replace the current entry, like the Timeline tab does. */
  const openTab = useCallback(
    (view: 'pinned' | 'tracked') => {
      close();
      window.history.replaceState(null, '', tabPath(base, view));
      setLoc({ route: { base, view }, scrollTop: 0 });
    },
    [base, close],
  );

  const resetDemo = useCallback(() => {
    if (repository instanceof DemoRepository) repository.reset();
    close();
    reload();
  }, [repository, close, reload]);

  const dayHref = useCallback((date: PlainDate) => dayPath(base, date), [base]);
  const today = repository.today();
  const addDate = route.view === 'day' ? route.date : today;

  return (
    <main className="app">
      {isDemo && <p className="banner">{t('demoBanner')}</p>}
      <header className="bar">
        <Brand />
        <div className="bar__actions">
          <button type="button" className="btn btn--ghost menu-btn" aria-haspopup="dialog" onClick={() => open({ kind: 'menu' })}>
            <span className="btn__icon">
              <MenuIcon />
            </span>
            {t('menu')}
          </button>
        </div>
      </header>
      {route.view === 'day' ? (
        <DayView date={route.date} onBack={toTimeline} onStep={stepDay} onInvalid={leaveInvalidDay} onUsualDay={openUsual} />
      ) : route.view === 'usual' ? (
        <UsualDay date={route.date ?? today} onBack={leaveUsual} />
      ) : route.view === 'pinned' ? (
        <PinnedNotes />
      ) : route.view === 'tracked' ? (
        <TrackedPlaceholder />
      ) : (
        <Timeline initialScrollTop={loc.scrollTop} dayHref={dayHref} onOpenDay={openDay} />
      )}
      <nav className="nav" aria-label={t('menu')}>
        <button
          type="button"
          className="nav__item"
          aria-current={route.view === 'timeline' ? 'page' : undefined}
          onClick={() => route.view !== 'timeline' && (route.view === 'day' ? toTimeline() : leaveInvalidDay())}
        >
          <TimelineIcon active={route.view === 'timeline'} />
          {t('timeline')}
        </button>
        <button type="button" className="nav__item" aria-current={route.view === 'pinned' ? 'page' : undefined} onClick={() => route.view !== 'pinned' && openTab('pinned')}>
          <PinIcon active={route.view === 'pinned'} />
          {t('copy.171')}
        </button>
        <div className="nav__add-wrap">
          <button type="button" className="btn btn--primary nav__add" aria-haspopup="dialog" onClick={() => open({ kind: 'add', date: addDate })}>
            <PlusIcon />
            {t('label.172')}
          </button>
        </div>
        <button type="button" className="nav__item" aria-current={route.view === 'tracked' ? 'page' : undefined} onClick={() => route.view !== 'tracked' && openTab('tracked')}>
          <TrackedIcon active={route.view === 'tracked'} />
          {t('copy.173')}
        </button>
      </nav>
      <SheetHost onShowDay={showDay} onUsualDay={() => openUsual(route.view === 'day' ? route.date : undefined)} onSignOut={onSignOut} onResetDemo={isDemo ? resetDemo : undefined} />
      <ToastHost />
    </main>
  );
}

function SheetHost({
  onShowDay,
  onUsualDay,
  onSignOut,
  onResetDemo,
}: {
  onShowDay: (date: PlainDate) => void;
  onUsualDay: () => void;
  onSignOut?: () => void;
  onResetDemo?: () => void;
}) {
  const { sheet } = useLog();
  if (!sheet) return null;
  switch (sheet.kind) {
    case 'add':
      return <AddSheet key={`add-${sheet.date}-${sheet.part ?? 0}`} date={sheet.date} part={sheet.part} usual={sheet.usual} />;
    case 'entry':
      return <EntrySheet key={sheet.entry?.id ?? sheet.slot?.id ?? 'new'} {...sheet} onShowDay={onShowDay} />;
    case 'event':
      return <EventSheet key={sheet.event?.id ?? sheet.type} kind={sheet.type} date={sheet.date} event={sheet.event} ctxOpen={sheet.ctxOpen} onShowDay={onShowDay} />;
    case 'slot':
      return <SlotSheet key={sheet.slot?.id ?? `new-${sheet.part}`} date={sheet.date} part={sheet.part} slot={sheet.slot} group={sheet.group} />;
    case 'backfill':
      return <BackfillSheet key={`backfill-${sheet.slot.id}`} slot={sheet.slot} />;
    case 'pinned':
      return <PinnedSheet key={sheet.note?.id ?? 'new'} note={sheet.note} />;
    case 'menu':
      return <MenuSheet onUsualDay={onUsualDay} onSignOut={onSignOut} onResetDemo={onResetDemo} />;
  }
}

function ToastHost() {
  const { t } = useI18n();
  const { toast, undoToast } = useLog();
  return (
    <div className="toast-root" aria-live="polite">
      {toast && (
        <div className="toast" role="status">
          <span className="toast__text">{toast.text}</span>
          {toast.undo && (
            <button type="button" className="link-btn" onClick={undoToast}>
              {t('undo')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
