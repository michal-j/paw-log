import { DemoRepository, type Repository } from './data';
import { useI18n } from './i18n';
import { Brand } from './components/Brand';
import { LangSwitch } from './components/LangSwitch';
import { Timeline } from './timeline/Timeline';

/**
 * Home: the read-only timeline (slice 2a). Day view, add/edit, calendar and matrix come in later slices.
 * `onSignOut` is passed for the real (signed-in) app only; demo mode has no account.
 */
export function App({ repository, onSignOut }: { repository: Repository; onSignOut?: () => void }) {
  const { t } = useI18n();
  const isDemo = repository instanceof DemoRepository;

  return (
    <main className="app">
      {isDemo && <p className="banner">{t('demoBanner')}</p>}
      <header className="bar">
        <Brand />
        <div className="bar__actions">
          <LangSwitch />
          {onSignOut && (
            <button type="button" className="lang-btn" onClick={onSignOut}>
              {t('auth.signOut')}
            </button>
          )}
        </div>
      </header>
      <Timeline repository={repository} />
    </main>
  );
}
