// Tracked conditions (JCB-6): pure derivations for the Tracked list, the condition page and the
// condition picker. No React, no I/O: unit-tested in tests/tracked.test.ts.
import type { Condition, HealthEvent, PlainDate } from '../data';
import { EVENT_ORDER } from '../day/model';

export const isOpen = (c: Pick<Condition, 'resolvedOn'>) => c.resolvedOn === null;

const byStart = (a: Condition, b: Condition) =>
  b.startedOn.localeCompare(a.startedOn) || a.position - b.position || a.id.localeCompare(b.id);

/** Open conditions, the most recently started first. */
export function openConditions(all: Condition[]): Condition[] {
  return all.filter(isOpen).sort(byStart);
}

/** Resolved conditions, the most recently resolved first. */
export function resolvedConditions(all: Condition[]): Condition[] {
  return all
    .filter((c) => !isOpen(c))
    .sort((a, b) => (b.resolvedOn ?? '').localeCompare(a.resolvedOn ?? '') || byStart(a, b));
}

/** Open first, then resolved: the order of the Tracked list, of tags and of picker chips. */
export function orderConditions(all: Condition[]): Condition[] {
  return [...openConditions(all), ...resolvedConditions(all)];
}

/** The conditions an event is linked to, in list order (unknown ids are left out). */
export function conditionsOf(event: Pick<HealthEvent, 'conditionIds'>, all: Condition[]): Condition[] {
  const ids = new Set(event.conditionIds);
  return orderConditions(all).filter((c) => ids.has(c.id));
}

/** Events linked to a condition, newest day first; within a day in the Day view's card order. */
export function linkedEvents(conditionId: string, events: HealthEvent[]): HealthEvent[] {
  return events
    .filter((e) => e.conditionIds.includes(conditionId))
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || EVENT_ORDER.indexOf(a.type) - EVENT_ORDER.indexOf(b.type) || a.id.localeCompare(b.id),
    );
}

/** Linked events grouped under their date, newest first. */
export function historyGroups(conditionId: string, events: HealthEvent[]): { date: PlainDate; events: HealthEvent[] }[] {
  const groups: { date: PlainDate; events: HealthEvent[] }[] = [];
  for (const e of linkedEvents(conditionId, events)) {
    const last = groups[groups.length - 1];
    if (last?.date === e.date) last.events.push(e);
    else groups.push({ date: e.date, events: [e] });
  }
  return groups;
}

/** "N events" on a condition card counts linked events other than photos (photos get their own count, JCB-7). */
export function eventCount(conditionId: string, events: HealthEvent[]): number {
  return events.filter((e) => e.type !== 'photo' && e.conditionIds.includes(conditionId)).length;
}

/**
 * Dates of a condition as saved: never resolved before it started. A "Resolved on" earlier than the
 * start (possible in Safari, whose date input does not enforce `min` on typed dates) becomes the start.
 */
export function normaliseDates(c: Condition): Condition {
  return c.resolvedOn !== null && c.resolvedOn < c.startedOn ? { ...c, resolvedOn: c.startedOn } : c;
}
