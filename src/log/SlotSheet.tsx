import { useState } from 'react';
import type { DayPart, Item, PlainDate, ScheduleSlot } from '../data';
import { DoseMark } from '../components/DoseMark';
import { Chip, Chips, Field, Sheet } from '../components/Sheet';
import { useI18n } from '../i18n';
import { markSize, shiftDate } from '../timeline/model';
import * as act from './actions';
import { defaultUnitFor, groupOf, type KindGroup } from './amount';
import { AmountFields, FlavourPicker, ItemPicker, OTHER, amountValue, type AmountValue } from './fields';
import { useFormat } from './format';
import { useLog } from './LogProvider';
import { changeFrom, removeFrom, sameValues } from './plan';

type Length = 'none' | '7' | '14' | 'date';

interface Form {
  /** Picked item, or OTHER with the group the new item belongs to. */
  itemId: string | null;
  otherGroup: KindGroup;
  otherName: string;
  flavour: string;
  amount: AmountValue;
  from: PlainDate;
  length: Length;
  to: PlainDate | null;
  err: 'item' | 'amount' | null;
}

const endFor = (from: PlainDate, length: Length, to: PlainDate | null): PlainDate | null =>
  length === 'none' ? null : length === 'date' ? (to && to >= from ? to : from) : shiftDate(from, Number(length) - 1);

/** Usual day: add an item to a part, or change it from a date (amount, course length), or remove it from a date on. */
export function SlotSheet({ date, part, slot }: { date: PlainDate; part: DayPart; slot?: ScheduleSlot }) {
  const { t } = useI18n();
  const f = useFormat();
  const { records, repository, run, close } = useLog();
  const [form, setForm] = useState<Form>(() => {
    const item = slot && records?.items.find((i) => i.id === slot.itemId);
    const group = item ? groupOf(item.kind) : 'med';
    const unit = slot?.unit ?? item?.defaultUnit ?? defaultUnitFor(group);
    const from = slot && slot.activeFrom > date ? slot.activeFrom : date;
    return {
      itemId: slot?.itemId ?? null,
      otherGroup: 'med',
      otherName: '',
      flavour: slot?.flavour ?? '',
      amount: amountValue(slot ? slot.amount : null, unit),
      from,
      length: slot?.activeTo ? 'date' : 'none',
      to: slot?.activeTo ?? null,
      err: null,
    };
  });
  if (!records) return null;
  const set = (patch: Partial<Form>) => setForm((x) => ({ ...x, ...patch }));

  const item = records.items.find((i) => i.id === form.itemId) ?? null;
  const group: KindGroup = item ? groupOf(item.kind) : form.otherGroup;
  const pick = (id: string, g: KindGroup) => {
    if (id === OTHER) return set({ itemId: OTHER, otherGroup: g, flavour: '', err: null, amount: amountValue(1, defaultUnitFor(g)) });
    const it = records.items.find((i) => i.id === id);
    const unit = it?.defaultUnit ?? defaultUnitFor(g);
    set({ itemId: id, otherName: '', flavour: it?.flavours?.[0] ?? '', amount: amountValue(unit === 'ml' || unit === 'g' ? null : 1, unit), err: null });
  };
  const groupItems = (g: KindGroup) => records.items.filter((i) => groupOf(i.kind) === g);

  const save = async () => {
    const isOther = form.itemId === OTHER;
    if (!form.itemId || (isOther && !form.otherName.trim())) return set({ err: 'item' });
    if (form.amount.amount === null) return set({ err: 'amount' });
    const newItem: Item | null = isOther
      ? {
          id: act.newId(),
          dogId: records.dogId,
          kind: form.otherGroup === 'food' ? 'food' : 'medication',
          name: form.otherName.trim(),
          colour: 'mark-neutral',
          defaultDayPart: part,
          activeFrom: form.from,
          activeTo: null,
          defaultUnit: form.amount.unit,
          flavours: [],
          position: Math.max(0, ...records.items.map((i) => i.position ?? 0)) + 10,
        }
      : null;
    const values = {
      itemId: newItem?.id ?? (form.itemId as string),
      dayPart: part,
      flavour: (item?.flavours ?? []).includes(form.flavour) ? form.flavour : '',
      amount: form.amount.amount,
      unit: form.amount.unit,
    };
    // Same item and amount: only the course length changed. The slot keeps its start and
    // "7 days" / "14 days" count from it, so a running course reads "day 2 of 14".
    const lengthOnly = !!slot && sameValues(slot, values);
    const end = endFor(lengthOnly && slot ? slot.activeFrom : form.from, form.length, form.to);
    const change =
      lengthOnly && slot
        ? { save: end === slot.activeTo ? [] : [{ ...slot, activeTo: end && end < slot.activeFrom ? slot.activeFrom : end }], remove: [] }
        : changeFrom(records.slots, slot ?? null, values, form.from, end, act.newId, records.dogId);
    if (!change.save.length && !newItem) return close();
    if (
      await run(async () => {
        if (newItem) await repository.saveItem(newItem);
        return act.applySlotChange(repository, change, records.slots);
      }, t('toastUsual'))
    )
      close();
  };

  const remove = async () => {
    if (!slot) return;
    const change = removeFrom(slot, form.from);
    if (await run(() => act.applySlotChange(repository, change, records.slots), t('toastUsual'))) close();
  };

  const partLine = `${f.part(part)} · ${records.times[part]}`;
  return (
    <Sheet
      title={t(slot ? 'editUsualTitle' : 'addUsualTitle')}
      onClose={close}
      footer={
        <>
          {slot && (
            <button type="button" className="btn btn--ghost btn--lg btn--danger" onClick={remove}>
              {t('removeUsual')}
            </button>
          )}
          <button type="button" className="btn btn--primary btn--lg" onClick={save}>
            {t('save')}
          </button>
        </>
      }
    >
      {slot && item ? (
        <div className="dateline dateline--item">
          <span className="dateline__item">
            <span className="chip__mark">
              <DoseMark colour={item.colour} size={markSize(item)} state="given" />
            </span>
            {item.name}
          </span>
          <span>{partLine}</span>
        </div>
      ) : (
        <>
          <div className="dateline">
            <span>{partLine}</span>
          </div>
          {(['food', 'med'] as const).map((g) => (
            <ItemPicker
              key={g}
              label={t(g === 'food' ? 'title.104' : 'dose.133')}
              items={groupItems(g)}
              value={form.itemId === OTHER ? (form.otherGroup === g ? OTHER : null) : form.itemId}
              onPick={(id) => pick(id, g)}
              otherName={form.otherName}
              onOtherName={(s) => set({ otherName: s, err: null })}
              otherPlaceholder={t(g === 'food' ? 'otherFoodPh' : 'otherMedPh')}
              error={form.err === 'item' && g === 'med' ? t('pickMed') : undefined}
            />
          ))}
        </>
      )}
      {form.itemId && (
        <>
          <FlavourPicker flavours={item?.flavours ?? []} value={form.flavour} onPick={(x) => set({ flavour: x })} />
          <AmountFields
            group={group}
            value={form.amount}
            onChange={(v) => set({ amount: v, err: null })}
            error={form.err === 'amount' ? t('pickAmount') : undefined}
          />
          <Field label={t('startsOn')} htmlFor="slot-from">
            <input id="slot-from" className="input" type="date" value={form.from} onChange={(e) => e.target.value && set({ from: e.target.value })} />
          </Field>
          <Field label={t('howLong')}>
            <Chips label={t('howLong')}>
              {(
                [
                  ['none', 'noEnd'],
                  ['7', 'days7'],
                  ['14', 'days14'],
                  ['date', 'endsOn'],
                ] as const
              ).map(([len, label]) => (
                <Chip
                  key={len}
                  on={form.length === len}
                  onClick={() => set({ length: len, to: len === 'date' ? (form.to ?? shiftDate(form.from, 6)) : form.to })}
                >
                  {t(label)}
                </Chip>
              ))}
            </Chips>
            {form.length === 'date' && (
              <input
                className="input"
                type="date"
                aria-label={t('endsOn')}
                min={form.from}
                value={form.to ?? ''}
                onChange={(e) => e.target.value && set({ to: e.target.value })}
              />
            )}
          </Field>
        </>
      )}
    </Sheet>
  );
}
