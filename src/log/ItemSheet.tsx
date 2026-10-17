import { useState } from 'react';
import type { Item, Unit } from '../data';
import { CrossIcon } from '../components/icons';
import { Chip, Chips, Field, Sheet } from '../components/Sheet';
import { fill, useI18n, type MessageKey } from '../i18n';
import { markSize } from '../timeline/model';
import { defaultUnitFor, groupOf, unitsFor } from './amount';
import { ColourPicker } from './fields';
import { isItemColour, nextColour } from './items';
import { useBusy } from './useBusy';
import { useLog } from './LogProvider';

/** The item as the editor would save it; null when nothing changed. Pure, for tests. */
export function editedItem(item: Item, values: { name: string; colour: string; defaultUnit: Unit; flavours: string[] }): Item | null {
  const name = values.name.trim();
  const flavours = [...new Set(values.flavours.map((x) => x.trim()).filter(Boolean))];
  const next: Item = { ...item, name, colour: values.colour, defaultUnit: values.defaultUnit, flavours };
  const same =
    next.name === item.name &&
    next.colour === item.colour &&
    next.defaultUnit === (item.defaultUnit ?? null) &&
    flavours.join('\n') === (item.flavours ?? []).join('\n');
  return same ? null : next;
}

/**
 * Edit an item (JCB-59): name, colour, default unit, flavours. Opened from the item picker of the
 * entry form and from a Usual day item; `onDone` returns to that form. Entries and usual-day rows
 * keep the flavour text they were logged with. Undo puts the item back as it was.
 */
export function ItemSheet({ item, onDone }: { item: Item; onDone: () => void }) {
  const { t } = useI18n();
  const { records, repository, run } = useLog();
  const { busy, guard } = useBusy();
  const group = groupOf(item.kind);
  const [name, setName] = useState(item.name);
  const [colour, setColour] = useState(() =>
    isItemColour(item.colour) ? item.colour : nextColour(records?.items.filter((i) => i.id !== item.id) ?? []),
  );
  const [unit, setUnit] = useState<Unit>(item.defaultUnit ?? defaultUnitFor(group));
  const [flavours, setFlavours] = useState<string[]>(item.flavours ?? []);
  const [newFlavour, setNewFlavour] = useState('');
  const [err, setErr] = useState(false);
  const units = unitsFor(group).includes(unit) ? unitsFor(group) : [...unitsFor(group), unit];

  const addFlavour = () => {
    const x = newFlavour.trim();
    if (x && !flavours.includes(x)) setFlavours([...flavours, x]);
    setNewFlavour('');
  };

  const save = async () => {
    if (!name.trim()) return setErr(true);
    // A flavour typed but not added yet still counts.
    const typed = newFlavour.trim();
    const next = editedItem(item, { name, colour, defaultUnit: unit, flavours: typed ? [...flavours, typed] : flavours });
    if (!next) return onDone();
    if (
      await run(async () => {
        await repository.saveItem(next);
        return () => repository.saveItem(item);
      }, t('toastItem'))
    )
      onDone();
  };

  return (
    <Sheet
      title={t('editItem')}
      onClose={onDone}
      footer={
        <button type="button" className="btn btn--primary btn--lg" disabled={busy} onClick={guard(save)}>
          {t('save')}
        </button>
      }
    >
      <Field label={t('itemName')} htmlFor="item-name" error={err ? t('itemNameErr') : undefined}>
        <input
          id="item-name"
          className="input"
          value={name}
          autoComplete="off"
          onChange={(e) => {
            setName(e.target.value);
            setErr(false);
          }}
        />
      </Field>
      <ColourPicker value={colour} size={markSize(item)} onPick={setColour} />
      <Field label={t('defaultUnit')}>
        <Chips label={t('defaultUnit')}>
          {units.map((u) => (
            <Chip key={u} on={unit === u} onClick={() => setUnit(u)}>
              {t(`u_${u}` as MessageKey)}
            </Chip>
          ))}
        </Chips>
      </Field>
      <Field label={t('flavours')} hint={t('optional')}>
        {flavours.length > 0 && (
          <div className="chips" role="group" aria-label={t('flavours')}>
            {flavours.map((x) => (
              <button
                key={x}
                type="button"
                className="chip chip--remove"
                aria-label={fill(t('removeFlavour'), { x })}
                onClick={() => setFlavours(flavours.filter((y) => y !== x))}
              >
                {x}
                <CrossIcon />
              </button>
            ))}
          </div>
        )}
        <div className="input-row">
          <input
            className="input"
            aria-label={t('flavourPh')}
            placeholder={t('flavourPh')}
            value={newFlavour}
            autoComplete="off"
            onChange={(e) => setNewFlavour(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addFlavour();
              }
            }}
          />
          <button type="button" className="btn btn--ghost btn--lg" disabled={!newFlavour.trim()} onClick={addFlavour}>
            {t('label.172')}
          </button>
        </div>
      </Field>
    </Sheet>
  );
}
