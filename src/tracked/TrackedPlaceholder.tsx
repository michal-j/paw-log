import { useI18n } from '../i18n';
import '../day/day.css';
import '../components/list.css';

/**
 * Placeholder for the Tracked tab until the conditions are built (a separate issue replaces this
 * file). Uses reviewed strings only: the tab name (#173) and the Tracked hint (#35).
 */
export function TrackedPlaceholder() {
  const { t } = useI18n();
  return (
    <section className="list" aria-labelledby="tracked-title">
      <div className="usual__head">
        <h2 id="tracked-title" className="usual__title">
          {t('copy.173')}
        </h2>
        <p className="usual__hint">{t('trackedHint')}</p>
      </div>
      <div className="day__body" />
    </section>
  );
}
