import { useCallback, useEffect, useState } from 'react';
import { DemoRepository, type PlainDate, type Repository } from './data';
import { DayView } from './day/DayView';
import { LANGS, useI18n } from './i18n';
import { dayPath, parseRoute, routePath, timelinePath, type Route } from './routes';
import { Timeline } from './timeline/Timeline';

/** What PawLog keeps in `history.state`. */
interface HistoryState {
  /** Timeline entries: the list scroll position to restore. */
  scrollTop?: number;
  /** Day entries pushed from the Timeline: Back can simply go back in history. */
  fromTimeline?: boolean;
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

/** Home: the read-only timeline (slice 2a); a tap on a row opens the read-only Day view (slice 3a). */
export function App({ repository }: { repository: Repository }) {
  const { lang, setLang, t } = useI18n();
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

  const dayHref = useCallback((date: PlainDate) => dayPath(base, date), [base]);

  return (
    <main className="app">
      {isDemo && <p className="banner">{t('demoBanner')}</p>}
      <header className="bar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <ellipse cx="6.2" cy="11" rx="2" ry="2.6" />
              <ellipse cx="10.2" cy="6.6" rx="2" ry="2.6" />
              <ellipse cx="15" cy="6.6" rx="2" ry="2.6" />
              <ellipse cx="18.6" cy="11" rx="2" ry="2.6" />
              <path d="M12.4 11.4c2.6 0 5.2 2.9 5.2 5.4 0 1.8-1.5 2.7-3 2.4-.8-.2-1.4-.5-2.2-.5s-1.4.3-2.2.5c-1.5.3-3-.6-3-2.4 0-2.5 2.6-5.4 5.2-5.4z" />
            </svg>
          </span>
          <h1 className="title">PawLog</h1>
        </div>
        <div className="lang" role="group" aria-label={t('langSwitch')}>
          {LANGS.map((l) => (
            <button key={l} type="button" className="lang-btn" aria-pressed={l === lang} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      {route.view === 'day' ? (
        <DayView repository={repository} date={route.date} onBack={toTimeline} onStep={stepDay} onInvalid={leaveInvalidDay} />
      ) : (
        <Timeline repository={repository} initialScrollTop={loc.scrollTop} dayHref={dayHref} onOpenDay={openDay} />
      )}
    </main>
  );
}
