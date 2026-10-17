import type { Condition } from '../data';
import { TargetIcon } from '../components/icons';
import { fill, useI18n } from '../i18n';
import { isOpen } from './model';
import './tracked.css';

/**
 * ConditionTag (design proposal pinned-tracked): the Card chip shape in the photo-badge colours, with a
 * target glyph; a resolved condition is neutral. Tapping it opens the condition. 24px tall, 44px hit area.
 */
export function ConditionTag({ condition, onOpen }: { condition: Condition; onOpen: (id: string) => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={`cond-tag${isOpen(condition) ? '' : ' cond-tag--resolved'}`}
      aria-label={fill(t('condOpenX'), { x: condition.name })}
      onClick={() => onOpen(condition.id)}
    >
      <TargetIcon />
      {condition.name}
    </button>
  );
}

/** The tags of one event. `row`: under a symptom row, right-aligned. Nothing when there are none. */
export function ConditionTags({ conditions, onOpen, row }: { conditions: Condition[]; onOpen: (id: string) => void; row?: boolean }) {
  if (!conditions.length) return null;
  return (
    <div className={`cond-tags${row ? ' cond-tags--row' : ''}`}>
      {conditions.map((c) => (
        <ConditionTag key={c.id} condition={c} onOpen={onOpen} />
      ))}
    </div>
  );
}
