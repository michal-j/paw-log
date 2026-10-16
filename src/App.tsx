import { DemoRepository, type Repository } from './data';
import { LANGS, useI18n } from './i18n';
import { Timeline } from './timeline/Timeline';

/** Home: the read-only timeline (slice 2a). Day view, add/edit, calendar and matrix come in later slices. */
export function App({ repository }: { repository: Repository }) {
  const { lang, setLang, t } = useI18n();
  const isDemo = repository instanceof DemoRepository;

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
      <Timeline repository={repository} />
    </main>
  );
}
