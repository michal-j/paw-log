// Pieces shared by the entry, event and usual-day sheets.
import { useId, useState } from 'react';
import type { DayPart, EntryState, Item, PlainDate, Unit } from '../data';
import { DoseMark } from '../components/DoseMark';
import { Chip, Chips, Field } from '../components/Sheet';
import { fill, useI18n, type MessageKey } from '../i18n';
import { ITEM_COLOURS } from './items';
import { DAY_PARTS, markSize } from '../timeline/model';
import { DECIMAL_UNITS, FRACTIONS, fractionOf, formatDecimal, parseAmount, unitKey, unitsFor, type KindGroup } from './amount';
import { useFormat } from './format';

/** "For Thu 15 Oct · Breakfast   Change"; once opened, a date input (and a part select) that stays open. */
export function DateLine({
  date,
  part,
  open,
  today,
  onOpen,
  onDate,
  onPart,
}: {
  date: PlainDate;
  part?: DayPart;
  open: boolean;
  today: PlainDate;
  onOpen: () => void;
  onDate: (d: PlainDate) => void;
  onPart?: (p: DayPart) => void;
}) {
  const { t } = useI18n();
  const f = useFormat();
  const dateId = useId();
  const partId = useId();
  if (!open) {
    return (
      <div className="dateline">
        <span>{`${t('copy.163')}${f.shortDate(date)}${part ? ` · ${f.part(part)}` : ''}`}</span>
        <button type="button" className="link-btn" onClick={onOpen}>
          {t('change')}
        </button>
      </div>
    );
  }
  return (
    <div className={`two field${onPart ? '' : ' two--one'}`}>
      <div>
        <div className="field__label">
          <label htmlFor={dateId}>{t('date')}</label>
        </div>
        <input
          id={dateId}
          className="input"
          type="date"
          max={today}
          value={date}
          onChange={(e) => e.target.value && e.target.value <= today && onDate(e.target.value)}
        />
      </div>
      {onPart && part && (
        <div>
          <div className="field__label">
            <label htmlFor={partId}>{t('dayPart')}</label>
          </div>
          <select id={partId} className="input" value={part} onChange={(e) => onPart(Number(e.target.value) as DayPart)}>
            {DAY_PARTS.map((p) => (
              <option key={p} value={p}>
                {f.part(p)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export const OTHER = '_other';

/** Item chips (with their circle) plus Other, which opens a name field. */
export function ItemPicker({
  label,
  items,
  value,
  onPick,
  otherName,
  onOtherName,
  otherPlaceholder,
  error,
  onEdit,
}: {
  label: string;
  items: Item[];
  value: string | null;
  onPick: (id: string) => void;
  otherName: string;
  onOtherName: (s: string) => void;
  otherPlaceholder: string;
  error?: string;
  /** Offers "Edit item" for the picked item (JCB-59). */
  onEdit?: (item: Item) => void;
}) {
  const { t } = useI18n();
  const picked = onEdit ? items.find((i) => i.id === value) : undefined;
  const action = picked && onEdit && (
    <button type="button" className="link-btn" onClick={() => onEdit(picked)}>
      {t('editItem')}
    </button>
  );
  return (
    <Field label={label} error={error} action={action}>
      <Chips label={label}>
        {items.map((i) => (
          <Chip key={i.id} on={value === i.id} onClick={() => onPick(i.id)}>
            <span className="chip__mark">
              <DoseMark colour={i.colour} size={markSize(i)} state="given" />
            </span>
            {i.name}
          </Chip>
        ))}
        <Chip on={value === OTHER} onClick={() => onPick(OTHER)}>
          {t('other')}
        </Chip>
      </Chips>
      {value === OTHER && (
        <input
          className="input"
          aria-label={otherPlaceholder}
          placeholder={otherPlaceholder}
          value={otherName}
          autoFocus
          onChange={(e) => onOtherName(e.target.value)}
        />
      )}
    </Field>
  );
}

/**
 * Flavour chips. With `canAdd` (food), "Add flavour" opens a field for a new one; the form adds it
 * to the item's flavours when it saves. A flavour that is not in the list yet shows as a chip.
 */
export function FlavourPicker({
  flavours,
  value,
  onPick,
  canAdd = false,
}: {
  flavours: string[];
  value: string;
  onPick: (f: string) => void;
  canAdd?: boolean;
}) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const known = value && !flavours.includes(value) && !adding ? [...flavours, value] : flavours;
  if (!known.length && !canAdd) return null;
  return (
    <Field label={t('flavour')}>
      <Chips label={t('flavour')}>
        {known.map((x) => (
          <Chip
            key={x}
            on={!adding && value === x}
            onClick={() => {
              setAdding(false);
              onPick(x);
            }}
          >
            {x}
          </Chip>
        ))}
        {canAdd && (
          <Chip
            on={adding}
            onClick={() => {
              setAdding(true);
              onPick(text.trim());
            }}
          >
            {t('addFlavour')}
          </Chip>
        )}
      </Chips>
      {adding && (
        <input
          className="input"
          aria-label={t('flavourPh')}
          placeholder={t('flavourPh')}
          value={text}
          autoFocus
          onChange={(e) => {
            setText(e.target.value);
            onPick(e.target.value.trim());
          }}
        />
      )}
    </Field>
  );
}

/** The item's colour: swatches of the design system's item colour tokens only. */
export function ColourPicker({ value, size, onPick }: { value: string; size: 'food' | 'small'; onPick: (c: string) => void }) {
  const { t } = useI18n();
  return (
    <Field label={t('colour')}>
      <div className="swatches" role="radiogroup" aria-label={t('colour')}>
        {ITEM_COLOURS.map((c, i) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-label={fill(t('colourN'), { n: i + 1 })}
            className="swatch"
            onClick={() => onPick(c)}
          >
            <DoseMark colour={c} size={size} state="given" />
          </button>
        ))}
      </div>
    </Field>
  );
}

export interface AmountValue {
  amount: number | null;
  unit: Unit;
  /** The free-number field is open ("Other", or an amount that is not a chip). */
  other: boolean;
  /** What is typed in the number field. */
  text: string;
}

export const amountValue = (amount: number | null, unit: Unit): AmountValue => ({
  amount,
  unit,
  other: amount !== null && !DECIMAL_UNITS.has(unit) && !fractionOf(amount),
  text: amount === null ? '' : formatDecimal(amount),
});

/**
 * Amount as fraction chips (or a decimal field for ml and g) and the unit as chips.
 * Changing to ml or g drops a fraction below 1, which would read oddly as "¼ ml".
 */
export function AmountFields({
  group,
  value,
  onChange,
  hint,
  error,
}: {
  group: KindGroup;
  value: AmountValue;
  onChange: (v: AmountValue) => void;
  hint?: string;
  error?: string;
}) {
  const { lang, t } = useI18n();
  const decimal = DECIMAL_UNITS.has(value.unit);
  const units = unitsFor(group).includes(value.unit) ? unitsFor(group) : [...unitsFor(group), value.unit];
  const typed = (text: string) => onChange({ ...value, text, amount: parseAmount(text) });
  const numberInput = (
    <input
      className="input input--short"
      inputMode="decimal"
      aria-label={t('amount')}
      placeholder={t('amountPh')}
      value={value.text}
      onChange={(e) => typed(e.target.value)}
    />
  );
  return (
    <>
      <Field label={t('amount')} hint={hint} error={error}>
        {decimal ? (
          <div className="input-row" style={{ marginTop: 0 }}>
            {numberInput}
            <span className="input-row__unit">{t(unitKey(value.unit, 2, lang))}</span>
          </div>
        ) : (
          <>
            <Chips label={t('amount')}>
              {FRACTIONS.map((f) => (
                <Chip
                  key={f.label}
                  wide
                  on={!value.other && value.amount !== null && Math.abs(value.amount - f.value) < 0.005}
                  onClick={() => onChange({ ...value, amount: f.value, other: false, text: formatDecimal(f.value) })}
                >
                  {f.label}
                </Chip>
              ))}
              <Chip wide on={value.other} onClick={() => onChange({ ...value, other: true })}>
                {t('other')}
              </Chip>
            </Chips>
            {value.other && <div className="input-row">{numberInput}</div>}
          </>
        )}
      </Field>
      <Field label={t('unit')}>
        <Chips label={t('unit')}>
          {units.map((u) => (
            <Chip
              key={u}
              on={value.unit === u}
              onClick={() => {
                const toDecimal = DECIMAL_UNITS.has(u);
                const drop = toDecimal && !DECIMAL_UNITS.has(value.unit) && value.amount !== null && value.amount < 1;
                onChange({ ...value, unit: u, amount: drop ? null : value.amount, text: drop ? '' : value.text, other: !toDecimal && value.other });
              }}
            >
              {t(`u_${u}` as MessageKey)}
            </Chip>
          ))}
        </Chips>
      </Field>
    </>
  );
}

const STATE_LABEL: Record<EntryState, MessageKey> = { given: 'name.96', skipped: 'name.97', partial: 'name.98' };

/** Given / Skipped (and Partly eaten for food), each with its circle. */
export function StatePicker({
  group,
  colour,
  size,
  value,
  onPick,
}: {
  group: KindGroup;
  colour: string;
  size: 'food' | 'small';
  value: EntryState;
  onPick: (s: EntryState) => void;
}) {
  const { t } = useI18n();
  const states: EntryState[] = group === 'food' ? ['given', 'skipped', 'partial'] : ['given', 'skipped'];
  const label = t(group === 'food' ? 'meal.125' : 'dose.137');
  return (
    <Field label={label}>
      <Chips label={label}>
        {states.map((s) => (
          <Chip key={s} on={value === s} onClick={() => onPick(s)}>
            <span className="chip__mark">
              <DoseMark colour={colour} size={size} state={s} />
            </span>
            {t(STATE_LABEL[s])}
          </Chip>
        ))}
      </Chips>
    </Field>
  );
}
