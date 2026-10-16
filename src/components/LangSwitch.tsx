import { LANGS, useI18n } from '../i18n';

/** EN / PL toggle used in the top bar. */
export function LangSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang" role="group" aria-label={t('langSwitch')}>
      {LANGS.map((l) => (
        <button key={l} type="button" className="lang-btn" aria-pressed={l === lang} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
