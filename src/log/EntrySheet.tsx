import { useMemo, useState } from 'react';
import type { DayPart, Entry, EntryState, Item, PlainDate, RemovedSlot, ScheduleSlot } from '../data';
import { Field, Sheet } from '../components/Sheet';
import { fill, useI18n } from '../i18n';
import { markSize } from '../timeline/model';
import * as act from './actions';
import { defaultUnitFor, groupOf, sameAmount, type KindGroup } from './amount';
import { AmountFields, ColourPicker, DateLine, FlavourPicker, ItemPicker, OTHER, StatePicker, amountValue, type AmountValue } from './fields';
import { lastUsed, nextColourFor, withFlavour } from './items';
import { ItemSheet } from './ItemSheet';
import { useFormat } from './format';
import { useBusy } from './useBusy';
import { useLog, type Records } from './LogProvider';
import { activeOn, changeFrom, matchDay, slotsOn } from './plan';

interface Form {
  date: PlainDate;
  part: DayPart;
  itemId: string | null;
  otherName: string;
  /** Colour picked for a new item typed under Other; null: the next unused one, worked out when shown and saved. */
  colour: string | null;
  flavour: string;
  amount: AmountValue;
  state: EntryState;
  note: string;
  toUsual: boolean;
  ctxOpen: boolean;
  err: 'item' | 'amount' | null;
}

/** Slots of `date` taken by other entries or removed for the day; `selfId` (the entry or marker being edited) does not count. */
function takenSlots(records: Records, date: PlainDate, selfId?: string): Set<string> {
  const others = records.entries.filter((e) => e.id !== selfId);
  const removed = records.removed.filter((r) => r.id !== selfId);
  return matchDay(date, records.slots, others, removed).filled;
}

/** The usual-day slot an entry for (date, part, item) would fill: active, same item, not filled by another entry. */
export function slotFor(records: Records, date: PlainDate, part: DayPart, itemId: string | null, entryId?: string): ScheduleSlot | null {
  if (!itemId || itemId === OTHER) return null;
  const filled = takenSlots(records, date, entryId);
  return slotsOn(records.slots, date, part).find((s) => s.itemId === itemId && !filled.has(s.id)) ?? null;
}

/**
 * The slot a saved entry fills. Its own item's open slot in that part comes first; otherwise the
 * slot it was opened from (the planned row, or the slot the edited entry filled) keeps it, as long as
 * the date is the same: logging something else in its place (another food, another part) is still
 * that slot's entry, and the slot must not turn back into "not logged".
 */
export function slotOnSave(
  records: Records,
  values: { date: PlainDate; part: DayPart; itemId: string },
  anchor: { slot: ScheduleSlot; date: PlainDate } | null,
  selfId: string,
): ScheduleSlot | null {
  const own = slotFor(records, values.date, values.part, values.itemId, selfId);
  if (own) return own;
  if (!anchor || anchor.date !== values.date || !activeOn(anchor.slot, values.date)) return null;
  return takenSlots(records, values.date, selfId).has(anchor.slot.id) ? null : anchor.slot;
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
  replaces,
  ctxOpen = false,
  onShowDay,
}: {
  group: KindGroup;
  date: PlainDate;
  part: DayPart;
  entry?: Entry;
  slot?: ScheduleSlot;
  replaces?: RemovedSlot;
  ctxOpen?: boolean;
  onShowDay: (date: PlainDate) => void;
}) {
  const { t } = useI18n();
  const f = useFormat();
  const { records, repository, run, close } = useLog();
  const { busy, guard } = useBusy();
  const edit = !!entry;

  const [form, setForm] = useState<Form>(() => {
    if (entry) {
      const unit = entry.unit ?? records?.items.find((i) => i.id === entry.itemId)?.defaultUnit ?? defaultUnitFor(group);
      return {
        date: entry.date,
        part: entry.dayPart,
        itemId: entry.itemId,
        otherName: '',
        colour: null,
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
      colour: null,
      flavour: '',
      amount: amountValue(null, defaultUnitFor(group)),
      state: 'given',
      note: '',
      toUsual: false,
      ctxOpen,
      err: null,
    };
    if (slot && records) return withItem(base, slot.itemId, records, group, replaces?.id);
    // A new entry starts from the last one of its kind: item, amount, unit and flavour.
    const last = records ? lastUsed(records, group) : null;
    if (!last || !records?.items.some((i) => i.id === last.itemId)) return base;
    const unit = last.unit ?? records.items.find((i) => i.id === last.itemId)?.defaultUnit ?? defaultUnitFor(group);
    return { ...base, itemId: last.itemId, flavour: last.flavour, amount: amountValue(last.amount, unit) };
  });

  // The item being edited ("Edit item"): its sheet shows in place of this one, which keeps its form.
  const [editing, setEditing] = useState<Item | null>(null);
  const items = useMemo(
    () => (records ? pickerItems(records, group, form.date, form.part) : []),
    [records, group, form.date, form.part],
  );
  if (!records) return null;
  if (editing) return <ItemSheet item={editing} onDone={() => setEditing(null)} />;

  const item = records.items.find((i) => i.id === form.itemId) ?? null;
  // A new item's colour: the one picked, else the next unused one for the items as they are now (JCB-59).
  const newColour = form.colour ?? nextColourFor(records.items, group);
  const selfId = entry?.id ?? replaces?.id;
  // The slot this sheet was opened for: a planned or removed row's slot, or the one the edited entry fills.
  const anchorSlot = entry ? (matchDay(entry.date, records.slots, records.entries).slotOf.get(entry.id) ?? null) : (slot ?? null);
  const anchor = anchorSlot ? { slot: anchorSlot, date: entry?.date ?? date } : null;
  const usual = slotFor(records, form.date, form.part, form.itemId, selfId);
  const usualText = usual && usual.amount !== null && usual.unit ? f.amount(usual.amount, usual.unit, item?.conversion) : '';
  const differs =
    !!usual && (!sameAmount(usual.amount, form.amount.amount) || usual.unit !== form.amount.unit || usual.flavour !== form.flavour);
  const offer = !form.itemId || form.itemId === OTHER ? null : !usual ? 'addToUsual' : differs ? 'makeUsual' : null;

  const set = (patch: Partial<Form>) => setForm((x) => ({ ...x, ...patch }));
  const reslot = (patch: Partial<Form>) =>
    setForm((x) => {
      const next = { ...x, ...patch };
      // A new date or part takes that part's usual values when adding; an edit keeps what was logged.
      return !edit && next.itemId && next.itemId !== OTHER ? withItem(next, next.itemId, records, group, selfId) : next;
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
          colour: newColour,
          defaultDayPart: form.part,
          activeFrom: form.date,
          activeTo: null,
          defaultUnit: unit,
          flavours: group === 'food' && form.flavour.trim() ? [form.flavour.trim()] : [],
          position: Math.max(0, ...records.items.map((i) => i.position ?? 0)) + 10,
        }
      : null;
    const itemId = newItem?.id ?? (form.itemId as string);
    // Food takes any flavour (a new one joins the item's list); other kinds only one of the item's own.
    const typed = form.flavour.trim();
    const flavour = group === 'food' || (item?.flavours ?? []).includes(typed) ? typed : '';
    const flavoured = group === 'food' ? withFlavour(item, flavour) : null;
    const change =
      form.toUsual && offer
        ? changeFrom(records.slots, null, { itemId, dayPart: form.part, flavour, amount: form.amount.amount, unit }, form.date, undefined, act.newId, dog.id)
        : null;
    const slotId = change?.slot.id ?? slotOnSave(records, { date: form.date, part: form.part, itemId }, anchor, selfId ?? '')?.id ?? null;
    // Logging a removed slot again takes the marker's row; anything else is a row of its own.
    const replacing = replaces && slotId === replaces.scheduleSlotId ? replaces : null;
    const next: Entry = {
      id: entry?.id ?? replacing?.id ?? act.newId(),
      dogId: dog.id,
      date: form.date,
      dayPart: form.part,
      itemId,
      scheduleSlotId: slotId,
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
      if (flavoured && item) {
        await repository.saveItem(flavoured);
        undos.push(() => repository.saveItem(item));
      }
      if (change) undos.push(await act.applySlotChange(repository, change, records.slots));
      undos.push(await act.saveEntry(repository, next, entry ?? null, replacing));
      return act.undoAll(...undos);
    }, t(change ? 'toastUsual' : 'toastSaved'));
    if (ok) {
      close();
      onShowDay(next.date);
    }
  };

  const remove = async () => {
    if (!entry) return;
    if (await run(() => act.deleteEntry(repository, entry, anchorSlot), t('toastDeleted'))) close();
  };

  const title = edit ? t('editEntry') : t(group === 'food' ? 'addFood' : 'addMed');
  return (
    <Sheet
      title={title}
      onClose={close}
      footer={
        <>
          {edit && (
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
        onPick={(id) => setForm((x) => withItem(x, id, records, group, selfId))}
        otherName={form.otherName}
        onOtherName={(s) => set({ otherName: s, err: null })}
        otherPlaceholder={t(group === 'food' ? 'otherFoodPh' : 'otherMedPh')}
        error={form.err === 'item' ? t(group === 'food' ? 'pickFood' : 'pickMed') : undefined}
        onEdit={setEditing}
      />
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
function withItem(form: Form, itemId: string, records: Records, group: KindGroup, selfId?: string): Form {
  const next: Form = { ...form, itemId, err: null, toUsual: false };
  if (itemId === OTHER) return { ...next, flavour: '' };
  const item = records.items.find((i) => i.id === itemId);
  const s = slotFor(records, form.date, form.part, itemId, selfId);
  const unit = s?.unit ?? item?.defaultUnit ?? defaultUnitFor(group);
  const amount = s ? s.amount : unit === 'ml' || unit === 'g' ? null : 1;
  return {
    ...next,
    flavour: s?.flavour || item?.flavours?.[0] || '',
    amount: amountValue(amount, unit),
    state: group === 'food' || form.state !== 'partial' ? form.state : 'given',
  };
}
