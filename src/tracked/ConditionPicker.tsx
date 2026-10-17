import { useEffect, useRef, useState } from 'react';
import type { Condition } from '../data';
import { PlusIcon } from '../components/icons';
import { Chip, Field } from '../components/Sheet';
import { fill, useI18n } from '../i18n';
import { openConditions, resolvedConditions } from './model';

/**
 * "Tracked conditions" in the event forms: multi-select chips. Open conditions first; resolved ones
 * that are linked show "(resolved)", the others wait behind "Resolved (n)". "+ New" names a new
 * condition inline; it is created (starting on the event's date) only when the event is saved.
 */
export function ConditionPicker({
  conditions,
  pending,
  selected,
  onToggle,
  onAdd,
}: {
  conditions: Condition[];
  /** Conditions named with "+ New" in this form, not saved yet. */
  pending: Condition[];
  selected: string[];
  onToggle: (id: string) => void;
  onAdd: (name: string) => void;
}) {
  const { t } = useI18n();
  const [showResolved, setShowResolved] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (adding) input.current?.focus();
  }, [adding]);

  const resolved = resolvedConditions(conditions);
  const linkedResolved = resolved.filter((c) => selected.includes(c.id));
  const otherResolved = resolved.filter((c) => !selected.includes(c.id));
  const chip = (c: Condition) => (
    <Chip key={c.id} mode="toggle" on={selected.includes(c.id)} onClick={() => onToggle(c.id)}>
      {c.resolvedOn ? fill(t('condResolvedTag'), { x: c.name }) : c.name}
    </Chip>
  );
  const add = () => {
    const x = name.trim();
    if (!x) return input.current?.focus();
    onAdd(x);
    setName('');
    setAdding(false);
  };

  return (
    <Field label={t('condField')} hint={t('optional')}>
      <div className="chips" role="group" aria-label={t('condField')}>
        {openConditions(conditions).map(chip)}
        {pending.map(chip)}
        {linkedResolved.map(chip)}
        {showResolved && otherResolved.map(chip)}
        {!showResolved && otherResolved.length > 0 && (
          <button type="button" className="chip" onClick={() => setShowResolved(true)}>
            {fill(t('condShowResolved'), { n: otherResolved.length })}
          </button>
        )}
        {!adding && (
          <button type="button" className="chip" aria-label={t('trackNew')} onClick={() => setAdding(true)}>
            <span className="chip__mark">
              <PlusIcon size={12} />
            </span>
            {t('condNewChip')}
          </button>
        )}
      </div>
      {adding && (
        <div className="input-row cond-new-row">
          <input
            ref={input}
            className="input"
            aria-label={t('condName')}
            placeholder={t('photo.160')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
          />
          <button type="button" className="btn btn--ghost btn--lg" onClick={add}>
            {t('label.172')}
          </button>
        </div>
      )}
    </Field>
  );
}
