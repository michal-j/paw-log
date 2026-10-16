import { useI18n } from '../i18n';
import { AuthShell } from './AuthShell';

/** Shown instead of crashing when the build has no VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. */
export function ConfigError() {
  const { t } = useI18n();
  return (
    <AuthShell>
      <section className="auth__card" aria-labelledby="config-title">
        <h2 id="config-title" className="auth__title">
          {t('config.title')}
        </h2>
        <p className="auth__text">{t('config.body')}</p>
        <a className="auth__ghost auth__ghost--wide" href="/demo">
          {t('config.openDemo')}
        </a>
      </section>
    </AuthShell>
  );
}
