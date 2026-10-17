import { useState } from 'react';
import type { Condition } from '../data';
import { Field, Sheet } from '../components/Sheet';
import { useI18n } from '../i18n';
import * as act from '../log/actions';
import { useLog } from '../log/LogProvider';
import { useBusy } from '../log/useBusy';
import { useDraftIds } from '../log/useDraftIds';
import { DESCRIPTION_MAX, NAME_MAX, linkedEvents, normaliseDates } from './model';

/**
 * Create (no `condition`) or edit a tracked condition: name, started on, resolved on (only when
 * resolved), description; Delete keeps the linked events. `onCreated` shows a new condition's page.
 */
export function ConditionSheet({ condition, onCreated }: { condition?: Condition; onCreated: (id: string) => void }) {
  const { t } = useI18n();
  const { records, repository, run, close } = useLog();
  const { busy, guard } = useBusy();
  // A new condition keeps its id across Save attempts, so a retry never adds a copy (JCB-71).
  const draft = useDraftIds();
  const today = records?.today ?? repository.today();
  const [name, setName] = useState(condition?.name ?? '');
  const [startedOn, setStartedOn] = useState(condition?.startedOn ?? today);
  const [resolvedOn, setResolvedOn] = useState(condition?.resolvedOn ?? null);
  const [description, setDescription] = useState(condition?.description ?? '');
  const [err, setErr] = useState(false);
  if (!records) return null;

  const save = async () => {
    if (!name.trim()) return setErr(true);
    const next = normaliseDates({
      id: condition?.id ?? draft.id('condition'),
      dogId: records.dogId,
      name: name.trim(),
      startedOn,
      resolvedOn,
      description: description.trim(),
      position: condition?.position ?? 0,
    });
    if (await run(() => act.saveCondition(repository, next, condition ?? null), t('toastSaved'))) {
      close();
      if (!condition) onCreated(next.id);
    }
  };
  const remove = async () => {
    if (!condition) return;
    const eventIds = linkedEvents(condition.id, records.events).map((e) => e.id);
    if (await run(() => act.deleteCondition(repository, condition, eventIds), t('condToastDeleted'))) close();
  };

  return (
    <Sheet
      title={condition ? t('condEditTitle') : t('trackNew')}
      onClose={close}
      footer={
        <>
          {condition && (
            <button type="button" className="btn btn--ghost btn--lg btn--danger" disabled={busy} onClick={guard(remove)}>
              {t('delete')}
            </button>
          )}
          <button type="button" className="btn btn--primary btn--lg" disabled={busy} onClick={guard(save)}>
            {t('save')}
          </button>
        </>
      }
    >
      <Field label={t('condName')} htmlFor="cond-name" error={err ? t('condNameErr') : undefined}>
        <input
          id="cond-name"
          className="input"
          placeholder={t('photo.160')}
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErr(false);
          }}
        />
      </Field>
      <div className={`two field${resolvedOn ? '' : ' two--one'}`}>
        <div>
          <div className="field__label">
            <label htmlFor="cond-start">{t('condStart')}</label>
          </div>
          <input
            id="cond-start"
            className="input"
            type="date"
            max={resolvedOn ?? today}
            value={startedOn}
            onChange={(e) => e.target.value && e.target.value <= today && setStartedOn(e.target.value)}
          />
        </div>
        {resolvedOn && (
          <div>
            <div className="field__label">
              <label htmlFor="cond-end">{t('condResolvedOn')}</label>
            </div>
            <input
              id="cond-end"
              className="input"
              type="date"
              min={startedOn}
              max={today}
              value={resolvedOn}
              onChange={(e) => e.target.value && e.target.value <= today && setResolvedOn(e.target.value)}
            />
          </div>
        )}
      </div>
      <Field label={t('photo.157')} hint={t('optional')} htmlFor="cond-desc">
        <textarea id="cond-desc" className="input" rows={3} maxLength={DESCRIPTION_MAX} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      {condition && <p className="field__note">{t('condDeleteNote')}</p>}
    </Sheet>
  );
}

/** Mark as resolved: asks for the date (today by default, not before the start). Undo reopens it. */
export function ResolveSheet({ condition }: { condition: Condition }) {
  const { t } = useI18n();
  const { records, repository, run, close } = useLog();
  const { busy, guard } = useBusy();
  const today = records?.today ?? repository.today();
  const [resolvedOn, setResolvedOn] = useState(today < condition.startedOn ? condition.startedOn : today);

  const save = async () => {
    const next = normaliseDates({ ...condition, resolvedOn });
    if (await run(() => act.saveCondition(repository, next, condition), t('condToastResolved'))) close();
  };

  return (
    <Sheet
      title={t('condMarkResolved')}
      onClose={close}
      footer={
        <button type="button" className="btn btn--primary btn--lg" disabled={busy} onClick={guard(save)}>
          {t('save')}
        </button>
      }
    >
      <Field label={t('condResolvedOn')} htmlFor="resolve-date">
        <input
          id="resolve-date"
          className="input"
          type="date"
          min={condition.startedOn}
          max={today}
          value={resolvedOn}
          onChange={(e) => e.target.value && e.target.value <= today && setResolvedOn(e.target.value)}
        />
      </Field>
    </Sheet>
  );
}
