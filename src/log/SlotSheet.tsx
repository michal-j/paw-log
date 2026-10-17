import { useState } from 'react';
import type { DayPart, Item, PlainDate, ScheduleSlot } from '../data';
import { DoseMark } from '../components/DoseMark';
import { Chip, Chips, Field, Sheet } from '../components/Sheet';
import { useI18n } from '../i18n';
import { markSize, shiftDate } from '../timeline/model';
import * as act from './actions';
import { defaultUnitFor, groupOf, type KindGroup } from './amount';
import { AmountFields, ColourPicker, FlavourPicker, ItemPicker, OTHER, amountValue, type AmountValue } from './fields';
import { nextColourFor, withFlavour } from './items';
import { ItemSheet } from './ItemSheet';
import { useFormat } from './format';
import { useBusy } from './useBusy';
import { useLog } from './LogProvider';
import { backfillDays, changeFrom, removeFrom, sameValues, slotsAfter } from './plan';

type Length = 'none' | '7' | '14' | 'date';

interface Form {
  /** Picked item, or OTHER with the group the new item belongs to. */
  itemId: string | null;
  otherGroup: KindGroup;
  otherName: string;
  /** A new item's colour if picked; null: the next unused one, worked out when shown and saved (an existing item's is changed under Edit item). */
  colour: string | null;
  flavour: string;
  amount: AmountValue;
  /** The item's start. */
  from: PlainDate;
  /** A running item with a new amount: the day the new amount begins. */
  doseFrom: PlainDate;
  length: Length;
  to: PlainDate | null;
  err: 'item' | 'amount' | 'overlap' | null;
}

const endFor = (from: PlainDate, length: Length, to: PlainDate | null): PlainDate | null =>
  length === 'none' ? null : length === 'date' ? (to && to >= from ? to : from) : shiftDate(from, Number(length) - 1);

/**
 * Usual day: add an item to a part (after choosing Food or Medication, `group`: only that kind is
 * listed), or change it from a date (amount, course length), or remove it from a date on. Edit item
 * (name, colour, default unit, flavours) opens the item editor.
 */
export function SlotSheet({ date, part, slot, group: onlyGroup }: { date: PlainDate; part: DayPart; slot?: ScheduleSlot; group?: KindGroup }) {
  const { t } = useI18n();
  const f = useFormat();
  const { records, repository, run, close, open } = useLog();
  const { busy, guard } = useBusy();
  const [form, setForm] = useState<Form>(() => {
    const item = slot && records?.items.find((i) => i.id === slot.itemId);
    const group = item ? groupOf(item.kind) : (onlyGroup ?? 'med');
    const unit = slot?.unit ?? item?.defaultUnit ?? defaultUnitFor(group);
    const from = slot ? slot.activeFrom : date;
    return {
      itemId: slot?.itemId ?? null,
      otherGroup: onlyGroup ?? 'med',
      otherName: '',
      colour: null,
      flavour: slot?.flavour ?? '',
      amount: amountValue(slot ? slot.amount : null, unit),
      from,
      doseFrom: date,
      length: slot?.course && slot.activeTo ? 'date' : 'none',
      to: slot?.activeTo ?? null,
      err: null,
    };
  });
  // "Edit item": the item editor shows in place of this sheet, which keeps its form.
  const [editing, setEditing] = useState<Item | null>(null);
  if (!records) return null;
  if (editing) return <ItemSheet item={editing} onDone={() => setEditing(null)} />;
  const set = (patch: Partial<Form>) => setForm((x) => ({ ...x, ...patch }));

  const item = records.items.find((i) => i.id === form.itemId) ?? null;
  const group: KindGroup = item ? groupOf(item.kind) : form.otherGroup;
  // A new item's colour: the one picked, else the next unused one for the items as they are now (JCB-59).
  const newColour = form.colour ?? nextColourFor(records.items, form.otherGroup);
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
          colour: newColour,
          defaultDayPart: part,
          activeFrom: form.from,
          activeTo: null,
          defaultUnit: form.amount.unit,
          flavours: form.otherGroup === 'food' && form.flavour.trim() ? [form.flavour.trim()] : [],
          position: Math.max(0, ...records.items.map((i) => i.position ?? 0)) + 10,
        }
      : null;
    const values = {
      itemId: newItem?.id ?? (form.itemId as string),
      dayPart: part,
      flavour: group === 'food' || (item?.flavours ?? []).includes(form.flavour.trim()) ? form.flavour.trim() : '',
      amount: form.amount.amount,
      unit: form.amount.unit,
    };
    const same = !!slot && sameValues(slot, values);
    // "How long" set to a length or an end date makes a course ("day n of m"); No end does not.
    const course = form.length !== 'none';
    const startMoved = !!slot && form.from !== slot.activeFrom;
    // The new amount begins on "New dose from" (a running item) or on the start (one that has not started).
    const effective = slot && slot.activeFrom <= date ? (form.doseFrom > form.from ? form.doseFrom : form.from) : form.from;
    // Same item and amount: the course length and/or the start changed. The slot keeps its start
    // and "7 days" / "14 days" count from it, so a running course reads "day 2 of 14".
    const lengthOnly = same && !startMoved;
    // A slot that ended because of an earlier change (not a course) keeps that end under "No end".
    const keepEnd = form.length === 'none' && !!slot && !slot.course && slot.activeTo;
    const end = keepEnd && slot ? slot.activeTo : endFor(lengthOnly && slot ? slot.activeFrom : same ? form.from : effective, form.length, form.to);
    // "Starts on" always moves the item's start: the slot itself starts then (JCB-72).
    const restart = slot && startMoved ? { ...slot, activeFrom: form.from, activeTo: slot.activeTo && slot.activeTo < form.from ? form.from : slot.activeTo } : slot;
    // An earlier slot of the same item and part must not overlap the new start: it ends the day before.
    const before =
      slot && form.from < slot.activeFrom
        ? records.slots.filter((x) => x.id !== slot.id && x.itemId === slot.itemId && x.dayPart === slot.dayPart && x.activeFrom < slot.activeFrom && (x.activeTo === null || x.activeTo >= form.from))
        : [];
    if (before.some((x) => x.activeFrom >= form.from)) return set({ err: 'overlap' });
    const trimmed = before.map((x) => ({ ...x, activeTo: shiftDate(form.from, -1), course: false }));
    const base = same
      ? {
          save:
            lengthOnly && end === slot!.activeTo && course === !!slot!.course
              ? []
              : [{ ...restart!, activeTo: end && end < restart!.activeFrom ? restart!.activeFrom : end, course: course && end !== null }],
          remove: [] as string[],
        }
      : changeFrom(records.slots, restart ?? null, { ...values, course }, effective, end, act.newId, records.dogId);
    const change = { ...base, save: [...trimmed, ...base.save], ...('slot' in base ? { slot: base.slot } : {}) } as Pick<typeof base, 'save' | 'remove'> & { slot?: ScheduleSlot };
    // A new flavour joins a food's list (the colour of an existing item is changed under Edit item).
    const itemChange = group === 'food' ? withFlavour(item, values.flavour) : null;
    if (!change.save.length && !newItem && !itemChange) return close();
    if (
      await run(async () => {
        if (newItem) await repository.saveItem(newItem);
        const undos: act.Undo[] = [];
        if (itemChange && item) {
          await repository.saveItem(itemChange);
          undos.push(() => repository.saveItem(item));
        }
        undos.push(await act.applySlotChange(repository, change, records.slots));
        return act.undoAll(...undos);
      }, t('toastUsual'))
    ) {
      // Added or changed from a past date: offer once to log it on the past days where it is open.
      // Moved earlier: the slot that now starts there; else the slot the change leaves holding the values.
      const saved = (startMoved && slot && form.from < slot.activeFrom ? change.save.find((x) => x.id === slot.id) : change.slot) ?? null;
      const past = saved && !lengthOnly && saved.activeFrom < records.today;
      const pastDays = past ? backfillDays(saved, slotsAfter(records.slots, change), records.entries, records.removed, records.today) : null;
      if (saved && pastDays?.days.length) open({ kind: 'backfill', slot: saved });
      else close();
    }
  };

  const remove = async () => {
    if (!slot) return;
    const change = removeFrom(slot, slot.activeFrom > date ? slot.activeFrom : date);
    if (await run(() => act.applySlotChange(repository, change, records.slots), t('toastUsual'))) close();
  };

  const partLine = `${f.part(part)} · ${records.times[part]}`;
  return (
    <Sheet
      title={t(slot ? 'editUsualTitle' : onlyGroup ? (onlyGroup === 'food' ? 'addUsualFood' : 'addUsualMed') : 'addUsualTitle')}
      onClose={close}
      footer={
        <>
          {slot && (
            <button type="button" className="btn btn--ghost btn--lg btn--danger" disabled={busy} onClick={guard(remove)}>
              {t('removeUsual')}
            </button>
          )}
          <button type="button" className="btn btn--primary btn--lg" disabled={busy} onClick={guard(save)}>
            {t('save')}
          </button>
        </>
      }
    >
      {slot && item ? (
        <>
          <div className="dateline dateline--item">
            <span className="dateline__item">
              <span className="chip__mark">
                <DoseMark colour={item.colour} size={markSize(item)} state="given" />
              </span>
              {item.name}
            </span>
            <button type="button" className="link-btn" onClick={() => setEditing(item)}>
              {t('editItem')}
            </button>
          </div>
          <div className="dateline">
            <span>{partLine}</span>
          </div>
        </>
      ) : (
        <>
          <div className="dateline">
            <span>{partLine}</span>
          </div>
          {(onlyGroup ? [onlyGroup] : (['food', 'med'] as const)).map((g) => (
            <ItemPicker
              key={g}
              label={t(g === 'food' ? 'title.104' : 'dose.133')}
              items={groupItems(g)}
              value={form.itemId === OTHER ? (form.otherGroup === g ? OTHER : null) : form.itemId}
              onPick={(id) => pick(id, g)}
              otherName={form.otherName}
              onOtherName={(s) => set({ otherName: s, err: null })}
              otherPlaceholder={t(g === 'food' ? 'otherFoodPh' : 'otherMedPh')}
              error={form.err === 'item' && g === (onlyGroup ?? 'med') ? t(g === 'food' ? 'pickFood' : 'pickMed') : undefined}
              onEdit={setEditing}
            />
          ))}
        </>
      )}
      {form.itemId && (
        <>
          {form.itemId === OTHER && (
            <ColourPicker value={newColour} size={group === 'food' ? 'food' : 'small'} onPick={(c) => set({ colour: c })} />
          )}
          <FlavourPicker flavours={item?.flavours ?? []} value={form.flavour} canAdd={group === 'food'} onPick={(x) => set({ flavour: x })} />
          <AmountFields
            group={group}
            value={form.amount}
            onChange={(v) => set({ amount: v, err: null })}
            error={form.err === 'amount' ? t('pickAmount') : undefined}
          />
          {slot && slot.activeFrom <= date && form.amount.amount !== null && !sameValues(slot, { itemId: slot.itemId, dayPart: part, flavour: form.flavour.trim(), amount: form.amount.amount, unit: form.amount.unit }) && (
            <Field label={t('newDoseFrom')} htmlFor="slot-dose-from">
              <input id="slot-dose-from" className="input" type="date" value={form.doseFrom} onChange={(e) => e.target.value && set({ doseFrom: e.target.value })} />
            </Field>
          )}
          <Field label={t('startsOn')} htmlFor="slot-from" error={form.err === 'overlap' ? t('startsOverlap') : undefined}>
            <input id="slot-from" className="input" type="date" value={form.from} onChange={(e) => e.target.value && set({ from: e.target.value, err: null })} />
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
