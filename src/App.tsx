import { useCallback, useEffect, useRef, useState } from 'react';
import { DemoRepository, type PlainDate, type Repository } from './data';
import { DayView } from './day/DayView';
import { useI18n } from './i18n';
import { Brand } from './components/Brand';
import { MenuIcon, PinIcon, PlusIcon, SearchIcon, TimelineIcon, TrackedIcon } from './components/icons';
import { AddSheet } from './log/AddSheet';
import { BackfillSheet } from './log/BackfillSheet';
import { EntrySheet } from './log/EntrySheet';
import { EventSheet } from './log/EventSheet';
import { LogProvider, useLog } from './log/LogProvider';
import { MenuSheet } from './log/MenuSheet';
import { SlotSheet } from './log/SlotSheet';
import { conditionPath, dayPath, itemPath, parseRoute, routePath, tabPath, timelinePath, usualPath, type Route } from './routes';
import { PinnedNotes } from './pinned/PinnedNotes';
import { PinnedSheet } from './pinned/PinnedSheet';
import { PhotoSheet } from './photos/PhotoSheet';
import { AddDocumentSheet } from './documents/AddDocumentSheet';
import { PhotoCompare, PhotoViewer } from './photos/PhotoViewer';
import { ConditionPage } from './tracked/ConditionPage';
import { ConditionSheet, ResolveSheet } from './tracked/ConditionSheet';
import { TrackedList } from './tracked/TrackedList';
import { ItemHistory } from './search/ItemHistory';
import { createSearchMemory } from './search/memory';
import { SearchScreen, type Ring } from './search/SearchScreen';
import { Timeline } from './timeline/Timeline';
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
  /** A Day opened from Search: the card or row to ring (JCB-138). */
  ring?: Ring;
}

const historyState = (): HistoryState => (window.history.state as HistoryState | null) ?? {};

interface Location {
  route: Route;
  scrollTop: number;
  /** Timeline only: the day the visitor ended on after Previous/Next, to scroll into view. */
  focusDate?: PlainDate;
  /** Day only: the card or row to scroll to and ring (arriving from Search). */
  ring?: Ring;
  /** The entry was pushed from inside the app, so Back goes back in history to where the visitor came from. */
  fromApp: boolean;
}

/** Read the address bar; anything that is not a valid route is rewritten to the Timeline. */
function readLocation(): Location {
  const route = parseRoute(window.location.pathname);
  const path = routePath(route);
  if (path !== window.location.pathname) window.history.replaceState(null, '', path);
  const state = historyState();
  return { route, scrollTop: state.scrollTop ?? 0, ring: route.view === 'day' ? state.ring : undefined, fromApp: !!state.fromApp };
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
  const { open, close, reload, toast, setOverlay } = log;
  const isDemo = repository instanceof DemoRepository;
  const [loc, setLoc] = useState<Location>(readLocation);
  const { route } = loc;
  const base = route.base;

  // What Search keeps while the app is open: text, filters, results shown, scroll (never in the URL).
  const [searchMemory] = useState(createSearchMemory);

  // The day the visitor leaves by Back: the Timeline they return to scrolls to it.
  const backFrom = useRef<PlainDate | null>(null);
  useEffect(() => {
    const onPop = () => {
      setOverlay(null); // Back leaves the photo viewer along with the screen it was opened on
      const focusDate = backFrom.current ?? undefined;
      backFrom.current = null;
      setLoc({ ...readLocation(), focusDate });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setOverlay]);

  const openDay = useCallback(
    (date: PlainDate, scrollTop: number) => {
      window.history.replaceState({ ...historyState(), scrollTop }, '');
      window.history.pushState({ fromTimeline: true } satisfies HistoryState, '', dayPath(base, date));
      setLoc({ route: { base, view: 'day', date }, scrollTop, fromApp: false });
    },
    [base],
  );

  /** A Day opened from Search or an item's history: Back returns there, and the card or row is ringed. */
  const openDayFromSearch = useCallback(
    (date: PlainDate, ring: Ring) => {
      window.history.pushState({ fromApp: true, ring } satisfies HistoryState, '', dayPath(base, date));
      setLoc({ route: { base, view: 'day', date }, scrollTop: 0, ring, fromApp: true });
    },
    [base],
  );

  const toTimeline = useCallback(() => {
    const leaving = route.view === 'day' ? route.date : undefined;
    if (historyState().fromTimeline) {
      backFrom.current = leaving ?? null;
      window.history.back(); // popstate restores the Timeline entry and its scroll position
      return;
    }
    window.history.replaceState(null, '', timelinePath(base));
    setLoc({ route: { base, view: 'timeline' }, scrollTop: 0, focusDate: leaving, fromApp: false });
  }, [base, route]);

  /** The Day view's Back: where the visitor came from when the Day was opened from inside the app (Search, say), else the Timeline. */
  const leaveDay = useCallback(() => {
    if (historyState().fromApp) {
      window.history.back();
      return;
    }
    toTimeline();
  }, [toTimeline]);

  const leaveInvalidDay = useCallback(() => {
    window.history.replaceState(null, '', timelinePath(base));
    setLoc({ route: { base, view: 'timeline' }, scrollTop: 0, fromApp: false });
  }, [base]);

  // Previous/next replace the entry, so Back (in the app or the browser) returns straight to the Timeline.
  const stepDay = useCallback(
    (date: PlainDate) => {
      // The ring belongs to the day it was opened on.
      window.history.replaceState({ ...historyState(), ring: undefined }, '', dayPath(base, date));
      setLoc((l) => ({ ...l, route: { base, view: 'day', date }, ring: undefined }));
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
      setLoc((l) => ({ ...l, route: { base, view: 'day', date }, ring: undefined, fromApp: !state.fromTimeline }));
    },
    [route, base, stepDay],
  );

  const openUsual = useCallback(
    (date?: PlainDate) => {
      close();
      if (route.view === 'usual' && route.date === date) return;
      window.history.pushState({ fromApp: true } satisfies HistoryState, '', usualPath(base, date));
      setLoc((l) => ({ ...l, route: { base, view: 'usual', date }, fromApp: true }));
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
    setLoc({ route: date ? { base, view: 'day', date } : { base, view: 'timeline' }, scrollTop: 0, fromApp: false });
  }, [route, base]);

  /** The Pinned, Tracked and Search tabs replace the current entry, like the Timeline tab does. */
  const openTab = useCallback(
    (view: 'pinned' | 'tracked' | 'search') => {
      close();
      window.history.replaceState(null, '', tabPath(base, view));
      setLoc({ route: { base, view }, scrollTop: 0, fromApp: false });
    },
    [base, close],
  );

  /** An item's whole history, from an item card in Search. */
  const openItem = useCallback(
    (id: string) => {
      close();
      window.history.pushState({ fromApp: true } satisfies HistoryState, '', itemPath(base, id));
      setLoc({ route: { base, view: 'item', id }, scrollTop: 0, fromApp: true });
    },
    [base, close],
  );

  /** Back from an item's history (or it no longer exists): Search. */
  const leaveItem = useCallback(() => {
    if (historyState().fromApp) {
      window.history.back();
      return;
    }
    window.history.replaceState(null, '', tabPath(base, 'search'));
    setLoc({ route: { base, view: 'search' }, scrollTop: 0, fromApp: false });
  }, [base]);

  /** A condition from the Tracked list, a tag in the Day view or another condition's page. */
  const openCondition = useCallback(
    (id: string) => {
      close();
      if (route.view === 'condition' && route.id === id) return;
      window.history.pushState({ fromApp: true } satisfies HistoryState, '', conditionPath(base, id));
      setLoc((l) => ({ ...l, route: { base, view: 'condition', id }, fromApp: true }));
    },
    [route, base, close],
  );

  /** Back from a condition page (or it no longer exists): where it was opened from, else the Tracked list. */
  const leaveCondition = useCallback(() => {
    if (historyState().fromApp) {
      window.history.back();
      return;
    }
    window.history.replaceState(null, '', tabPath(base, 'tracked'));
    setLoc({ route: { base, view: 'tracked' }, scrollTop: 0, fromApp: false });
  }, [base]);

  const resetDemo = useCallback(() => {
    if (repository instanceof DemoRepository) repository.reset();
    close();
    reload();
  }, [repository, close, reload]);

  const dayHref = useCallback((date: PlainDate) => dayPath(base, date), [base]);
  const today = repository.today();
  const addDate = route.view === 'day' ? route.date : today;

  return (
    <main className={toast ? 'app app--toast' : 'app'}>
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
        <DayView
          date={route.date}
          onBack={leaveDay}
          backLabel={loc.fromApp ? t('back') : undefined}
          ring={loc.ring}
          onStep={stepDay}
          onInvalid={leaveInvalidDay}
          onUsualDay={openUsual}
          onOpenCondition={openCondition}
        />
      ) : route.view === 'usual' ? (
        <UsualDay date={route.date ?? today} onBack={leaveUsual} />
      ) : route.view === 'pinned' ? (
        <PinnedNotes />
      ) : route.view === 'tracked' ? (
        <TrackedList onOpen={openCondition} />
      ) : route.view === 'search' ? (
        <SearchScreen memory={searchMemory} onOpenDay={openDayFromSearch} onOpenCondition={openCondition} onOpenItem={openItem} />
      ) : route.view === 'item' ? (
        <ItemHistory key={route.id} id={route.id} memory={searchMemory} onBack={leaveItem} onMissing={leaveItem} onOpenDay={openDayFromSearch} />
      ) : route.view === 'condition' ? (
        <ConditionPage key={route.id} id={route.id} onBack={leaveCondition} onMissing={leaveCondition} onOpenCondition={openCondition} />
      ) : (
        <Timeline initialScrollTop={loc.scrollTop} focusDate={loc.focusDate} dayHref={dayHref} onOpenDay={openDay} />
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
        <button
          type="button"
          className="nav__item"
          aria-current={route.view === 'tracked' || route.view === 'condition' ? 'page' : undefined}
          onClick={() => route.view !== 'tracked' && openTab('tracked')}
        >
          <TrackedIcon active={route.view === 'tracked' || route.view === 'condition'} />
          {t('copy.173')}
        </button>
        <button
          type="button"
          className="nav__item"
          aria-current={route.view === 'search' || route.view === 'item' ? 'page' : undefined}
          onClick={() => route.view !== 'search' && openTab('search')}
        >
          <SearchIcon active={route.view === 'search' || route.view === 'item'} />
          {t('search')}
        </button>
      </nav>
      <OverlayHost onShowDay={showDay} onOpenCondition={openCondition} />
      <SheetHost onShowDay={showDay} onOpenCondition={openCondition} onUsualDay={() => openUsual(route.view === 'day' ? route.date : undefined)} onSignOut={onSignOut} onResetDemo={isDemo ? resetDemo : undefined} />
      <ToastHost />
    </main>
  );
}

function SheetHost({
  onShowDay,
  onOpenCondition,
  onUsualDay,
  onSignOut,
  onResetDemo,
}: {
  onShowDay: (date: PlainDate) => void;
  onOpenCondition: (id: string) => void;
  onUsualDay: () => void;
  onSignOut?: () => void;
  onResetDemo?: () => void;
}) {
  const { sheet } = useLog();
  if (!sheet) return null;
  switch (sheet.kind) {
    case 'add':
      return (
        <AddSheet key={`add-${sheet.date}-${sheet.part ?? 0}`} date={sheet.date} part={sheet.part} usual={sheet.usual} condition={sheet.condition} />
      );
    case 'entry':
      return <EntrySheet key={sheet.entry?.id ?? sheet.slot?.id ?? 'new'} {...sheet} onShowDay={onShowDay} />;
    case 'event':
      return (
        <EventSheet
          key={sheet.event?.id ?? sheet.type}
          kind={sheet.type}
          date={sheet.date}
          event={sheet.event}
          ctxOpen={sheet.ctxOpen}
          linkTo={sheet.linkTo}
          onShowDay={onShowDay}
        />
      );
    case 'condition':
      return <ConditionSheet key={sheet.condition?.id ?? 'new'} condition={sheet.condition} onCreated={onOpenCondition} />;
    case 'resolve':
      return <ResolveSheet key={sheet.condition.id} condition={sheet.condition} />;
    case 'slot':
      return <SlotSheet key={sheet.slot?.id ?? `new-${sheet.part}`} date={sheet.date} part={sheet.part} slot={sheet.slot} group={sheet.group} />;
    case 'backfill':
      return <BackfillSheet key={`backfill-${sheet.slot.id}`} slot={sheet.slot} />;
    case 'pinned':
      return <PinnedSheet key={sheet.note?.id ?? 'new'} note={sheet.note} />;
    case 'photo':
      return (
        <PhotoSheet
          key={sheet.photo?.id ?? 'new'}
          date={sheet.date}
          photo={sheet.photo}
          ctxOpen={sheet.ctxOpen}
          linkTo={sheet.linkTo}
          onShowDay={onShowDay}
        />
      );
    case 'document':
      return <AddDocumentSheet key={`document-${sheet.condition}`} date={sheet.date} condition={sheet.condition} />;
    case 'menu':
      return <MenuSheet onUsualDay={onUsualDay} onSignOut={onSignOut} onResetDemo={onResetDemo} />;
  }
}

/** The photo viewer and Compare, over the screen they were opened from. */
function OverlayHost({ onShowDay, onOpenCondition }: { onShowDay: (date: PlainDate) => void; onOpenCondition: (id: string) => void }) {
  const { overlay } = useLog();
  if (!overlay) return null;
  return overlay.kind === 'viewer' ? (
    <PhotoViewer ids={overlay.ids} index={overlay.index} onShowDay={onShowDay} onOpenCondition={onOpenCondition} />
  ) : (
    <PhotoCompare condition={overlay.condition} />
  );
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
