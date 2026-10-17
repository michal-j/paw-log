import { useEffect } from 'react';
import type { ScheduleSlot } from '../data';
import { Sheet } from '../components/Sheet';
import { fill, useI18n } from '../i18n';
import * as act from './actions';
import { useFormat } from './format';
import { useBusy } from './useBusy';
import { useLog } from './LogProvider';
import { shiftDate } from '../timeline/model';
import { backfillDays, plannedEntry, slotsAfter } from './plan';

/**
 * Asked once after a usual-day item is added or changed from a past date: log it as given on the
 * past days where it is still open? Yes fills them (days logged meanwhile, here or on the other
 * phone, are skipped and counted), No leaves them. Undo takes the filled days back. The days are
 * worked out from the records as they reload, so entries the other phone added are counted.
 */
export function BackfillSheet({ slot }: { slot: ScheduleSlot }) {
  const { t, lang } = useI18n();
  const f = useFormat();
  const { records, repository, run, close } = useLog();
  const { busy, guard } = useBusy();
  const { days, total } = records
    ? backfillDays(slot, slotsAfter(records.slots, { save: [slot], remove: [] }), records.entries, records.removed, records.today)
    : { days: [], total: 0 };
  const nothing = !!records && days.length === 0;
  useEffect(() => {
    if (nothing && !busy) close();
  }, [nothing, busy, close]);
  const item = records?.items.find((i) => i.id === slot.itemId);
  const name = f.name(item?.name ?? '', slot.flavour);
  const from = days[0] ?? slot.activeFrom;
  const last = days[days.length - 1] ?? from;
  const isYesterday = !!records && last === shiftDate(records.today, -1);
  // The real last day, not always "yesterday": the item may end earlier or days may have been logged.
  const to = isYesterday ? t('copy.114').toLocaleLowerCase(lang) : f.dayMonth(last);
  const text =
    days.length === 1
      ? fill(t(isYesterday ? 'backfillAskOne' : 'backfillAskOneOn'), { item: name, from: f.dayMonth(from) })
      : fill(t('backfillAsk'), { item: name, n: days.length, from: f.dayMonth(from), to });

  const yes = async () => {
    let added = 0;
    const ok = await run(
      async () => {
        const res = await act.addPlanned(
          repository,
          days.map((d) => plannedEntry(slot, d, act.newId())),
        );
        added = res.added;
        return res.undo;
      },
      () => {
        const skipped = total - added;
        if (skipped > 0) return fill(t('toastBackfilledSkip'), { n: added, t: total, m: skipped });
        return added === 1 ? t('toastBackfilledOne') : fill(t('toastBackfilled'), { n: added });
      },
    );
    if (ok) close();
  };

  return (
    <Sheet
      title={t('backfillTitle')}
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn--ghost btn--lg" disabled={busy} onClick={close}>
            {t(days.length === 1 ? 'backfillNoOne' : 'backfillNo')}
          </button>
          <button type="button" className="btn btn--primary btn--lg" disabled={busy} onClick={guard(yes)}>
            {t(days.length === 1 ? 'backfillYesOne' : 'backfillYes')}
          </button>
        </>
      }
    >
      <p className="sheet__text sheet__text--toast-room">{text}</p>
    </Sheet>
  );
}
