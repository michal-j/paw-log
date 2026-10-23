import { Chip, Chips, Sheet } from '../components/Sheet';
import { fill, useI18n } from '../i18n';
import { GROUP_CAPTION, KIND_GROUPS, KIND_LABEL, type Kind, type KindGroup } from './kinds';

const GROUPS: readonly KindGroup[] = ['events', 'items', 'off'];

/**
 * The Filters sheet (the shared Sheet): all 17 kinds as toggles in three captioned groups, "Clear" in the heading and a
 * primary button whose count follows the toggles, so the effect is visible before closing. Toggles apply at once.
 */
export function FilterSheet({
  kinds,
  total,
  onToggle,
  onClear,
  onClose,
}: {
  kinds: readonly Kind[];
  total: number;
  onToggle: (k: Kind) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Sheet
      title={t('filters')}
      onClose={onClose}
      headAction={
        <button type="button" className="sheet__close" disabled={kinds.length === 0} onClick={onClear}>
          {t('diagClear')}
        </button>
      }
      footer={
        <button type="button" className="btn btn--primary btn--lg" onClick={onClose}>
          {fill(t('searchShowResults'), { n: total })}
        </button>
      }
    >
      <p className="sheet__text">{t('searchKindsHint')}</p>
      {GROUPS.map((g) => (
        <div key={g} className="search-sheet__group">
          <h3 className="day__caption search-sheet__caption">{t(GROUP_CAPTION[g])}</h3>
          <Chips toggles label={t(GROUP_CAPTION[g])}>
            {KIND_GROUPS[g].map((k) => (
              <Chip key={k} mode="toggle" on={kinds.includes(k)} onClick={() => onToggle(k)}>
                {t(KIND_LABEL[k])}
              </Chip>
            ))}
          </Chips>
        </div>
      ))}
    </Sheet>
  );
}
