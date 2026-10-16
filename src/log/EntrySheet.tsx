import { useMemo, useState } from 'react';
import type { DayPart, Entry, EntryState, Item, PlainDate, ScheduleSlot } from '../data';
import { Field, Sheet } from '../components/Sheet';
import { fill, useI18n } from '../i18n';
import { markSize } from '../timeline/model';
import * as act from './actions';
import { defaultUnitFor, groupOf, sameAmount, type KindGroup } from './amount';
import { AmountFields, DateLine, FlavourPicker, ItemPicker, OTHER, StatePicker, amountValue, type AmountValue } from './fields';
import { useFormat } from './format';
import { useLog, type Records } from './LogProvider';
import { changeFrom, matchDay, slotsOn } from './plan';

interface Form {
  date: PlainDate;
  part: DayPart;
  itemId: string | null;
  otherName: string;
  flavour: string;
  amount: AmountValue;
  state: EntryState;
  note: string;
  toUsual: boolean;
  ctxOpen: boolean;
  err: 'item' | 'amount' | null;
}

/** The usual-day slot an entry for (date, part, item) would fill: active, same item, not filled by another entry. */
export function slotFor(records: Records, date: PlainDate, part: DayPart, itemId: string | null, entryId?: string): ScheduleSlot | null {
  if (!itemId || itemId === OTHER) return null;
  const others = records.entries.filter((e) => e.id !== entryId);
  const { filled } = matchDay(date, records.slots, others);
  return slotsOn(records.slots, date, part).find((s) => s.itemId === itemId && !filled.has(s.id)) ?? null;
}

/** Items of the group, ordered: in this part of the usual day, then active on the date, then the rest. */
function pickerItems(records: Records, group: KindGroup, date: PlainDate, part: DayPart) {
  const inPart = new Set(slotsOn(records.slots, date, part).map((s) => s.itemId));
  const live = (i: Item) => i.activeFrom <= date && (!i.activeTo || i.activeTo >= date);
  const rank = (i: Item) => (inPart.has(i.id) ? 0 : live(i) ? 1 : 2);
  return records.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => groupOf(item.kind) === group)
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)
    .map(({ item }) => item);
}

/** Food and medication: add (from + Add, a part's +, or a planned row) and edit, including changing the item. */
export function EntrySheet({
  group,
  date,
  part,
  entry,
  slot,
  ctxOpen = false,
  onShowDay,
}: {
  group: KindGroup;
  date: PlainDate;
  part: DayPart;
  entry?: Entry;
  slot?: ScheduleSlot;
  ctxOpen?: boolean;
  onShowDay: (date: PlainDate) => void;
}) {
  const { t } = useI18n();
  const f = useFormat();
  const { records, repository, run, close } = useLog();
  const edit = !!entry;

  const [form, setForm] = useState<Form>(() => {
    if (entry) {
      const unit = entry.unit ?? records?.items.find((i) => i.id === entry.itemId)?.defaultUnit ?? defaultUnitFor(group);
      return {
        date: entry.date,
        part: entry.dayPart,
        itemId: entry.itemId,
        otherName: '',
        flavour: entry.flavour,
        amount: amountValue(entry.amount, unit),
        state: entry.state,
        note: entry.note,
        toUsual: false,
        ctxOpen,
        err: null,
      };
    }
    const base: Form = {
      date,
      part,
      itemId: null,
      otherName: '',
      flavour: '',
      amount: amountValue(null, defaultUnitFor(group)),
      state: 'given',
      note: '',
      toUsual: false,
      ctxOpen,
      err: null,
    };
    return slot && records ? withItem(base, slot.itemId, records, group) : base;
  });

  const items = useMemo(
    () => (records ? pickerItems(records, group, form.date, form.part) : []),
    [records, group, form.date, form.part],
  );
  if (!records) return null;

  const item = records.items.find((i) => i.id === form.itemId) ?? null;
  const usual = slotFor(records, form.date, form.part, form.itemId, entry?.id);
  const usualText = usual && usual.amount !== null && usual.unit ? f.amount(usual.amount, usual.unit, item?.conversion) : '';
  const differs =
    !!usual && (!sameAmount(usual.amount, form.amount.amount) || usual.unit !== form.amount.unit || usual.flavour !== form.flavour);
  const offer = !form.itemId || form.itemId === OTHER ? null : !usual ? 'addToUsual' : differs ? 'makeUsual' : null;

  const set = (patch: Partial<Form>) => setForm((x) => ({ ...x, ...patch }));
  const reslot = (patch: Partial<Form>) =>
    setForm((x) => {
      const next = { ...x, ...patch };
      // A new date or part takes that part's usual values when adding; an edit keeps what was logged.
      return !edit && next.itemId && next.itemId !== OTHER ? withItem(next, next.itemId, records, group) : next;
    });

  const save = async () => {
    const isOther = form.itemId === OTHER;
    if (!form.itemId || (isOther && !form.otherName.trim())) return set({ err: 'item' });
    if (form.amount.amount === null) return set({ err: 'amount' });
    const dog = { id: records.dogId };
    const unit = form.amount.unit;
    const newItem: Item | null = isOther
      ? {
          id: act.newId(),
          dogId: dog.id,
          kind: group === 'food' ? 'food' : 'medication',
          name: form.otherName.trim(),
          colour: 'mark-neutral',
          defaultDayPart: form.part,
          activeFrom: form.date,
          activeTo: null,
          defaultUnit: unit,
          flavours: [],
          position: Math.max(0, ...records.items.map((i) => i.position ?? 0)) + 10,
        }
      : null;
    const itemId = newItem?.id ?? (form.itemId as string);
    const flavour = (item?.flavours ?? []).includes(form.flavour) ? form.flavour : '';
    const change =
      form.toUsual && offer
        ? changeFrom(records.slots, null, { itemId, dayPart: form.part, flavour, amount: form.amount.amount, unit }, form.date, undefined, act.newId, dog.id)
        : null;
    const next: Entry = {
      id: entry?.id ?? act.newId(),
      dogId: dog.id,
      date: form.date,
      dayPart: form.part,
      itemId,
      scheduleSlotId: change?.slot.id ?? slotFor(records, form.date, form.part, itemId, entry?.id)?.id ?? null,
      amount: form.amount.amount,
      unit,
      flavour,
      doseText: '',
      state: group === 'food' || form.state !== 'partial' ? form.state : 'given',
      note: form.note.trim(),
      createdBy: entry?.createdBy ?? '',
    };
    const ok = await run(async () => {
      if (newItem) await repository.saveItem(newItem);
      const undos: act.Undo[] = [];
      if (change) undos.push(await act.applySlotChange(repository, change, records.slots));
      undos.push(await act.saveEntry(repository, next, entry ?? null));
      return act.undoAll(...undos);
    }, t(change ? 'toastUsual' : 'toastSaved'));
    if (ok) {
      close();
      onShowDay(next.date);
    }
  };

  const remove = async () => {
    if (!entry) return;
    if (await run(() => act.deleteEntry(repository, entry), t('toastDeleted'))) close();
  };

  const title = edit ? t('editEntry') : t(group === 'food' ? 'addFood' : 'addMed');
  return (
    <Sheet
      title={title}
      onClose={close}
      footer={
        <>
          {edit && (
            <button type="button" className="btn btn--ghost btn--lg btn--danger" onClick={remove}>
              {t('delete')}
            </button>
          )}
          <button type="button" className="btn btn--primary btn--lg" onClick={save}>
            {t('save')}
          </button>
        </>
      }
    >
      <DateLine
        date={form.date}
        part={form.part}
        open={form.ctxOpen}
        today={records.today}
        onOpen={() => set({ ctxOpen: true })}
        onDate={(d) => reslot({ date: d })}
        onPart={(p) => reslot({ part: p })}
      />
      <ItemPicker
        label={t(group === 'food' ? 'title.104' : 'dose.133')}
        items={items}
        value={form.itemId}
        onPick={(id) => setForm((x) => withItem(x, id, records, group))}
        otherName={form.otherName}
        onOtherName={(s) => set({ otherName: s, err: null })}
        otherPlaceholder={t(group === 'food' ? 'otherFoodPh' : 'otherMedPh')}
        error={form.err === 'item' ? t(group === 'food' ? 'pickFood' : 'pickMed') : undefined}
      />
      {form.itemId && (
        <>
          <FlavourPicker flavours={item?.flavours ?? []} value={form.flavour} onPick={(x) => set({ flavour: x })} />
          <AmountFields
            group={group}
            value={form.amount}
            onChange={(v) => set({ amount: v, err: null })}
            hint={usualText ? fill(t('usualIs'), { x: usualText }) : undefined}
            error={form.err === 'amount' ? t('pickAmount') : undefined}
          />
          <StatePicker
            group={group}
            colour={item?.colour ?? 'mark-neutral'}
            size={item ? markSize(item) : group === 'food' ? 'food' : 'small'}
            value={form.state}
            onPick={(s) => set({ state: s })}
          />
          <Field label={t('note.154')} hint={t('optional')} htmlFor="entry-note">
            <textarea
              id="entry-note"
              className="input"
              rows={2}
              placeholder={t('note.155')}
              value={form.note}
              onChange={(e) => set({ note: e.target.value })}
            />
          </Field>
          {offer && (
            <label className="check">
              <input type="checkbox" checked={form.toUsual} onChange={(e) => set({ toUsual: e.target.checked })} />
              <span>{t(offer)}</span>
            </label>
          )}
        </>
      )}
    </Sheet>
  );
}

/** Pick an item: take its usual-day values for this part (or its defaults), keep the date and part. */
function withItem(form: Form, itemId: string, records: Records, group: KindGroup): Form {
  const next: Form = { ...form, itemId, err: null, toUsual: false };
  if (itemId === OTHER) return { ...next, flavour: '' };
  const item = records.items.find((i) => i.id === itemId);
  const s = slotFor(records, form.date, form.part, itemId);
  const unit = s?.unit ?? item?.defaultUnit ?? defaultUnitFor(group);
  const amount = s ? s.amount : unit === 'ml' || unit === 'g' ? null : 1;
  return {
    ...next,
    flavour: s?.flavour || item?.flavours?.[0] || '',
    amount: amountValue(amount, unit),
    state: group === 'food' || form.state !== 'partial' ? form.state : 'given',
  };
}
