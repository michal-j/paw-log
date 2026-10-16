/** A failed database call. `code` is the Postgres/PostgREST code when there is one (42501 = not allowed). */
export class RepositoryError extends Error {
  constructor(
    readonly operation: string,
    readonly code: string | undefined,
    message: string,
  ) {
    super(`${operation}: ${message}`);
    this.name = 'RepositoryError';
  }
}

/** The signed-in user is not a member of any household with a dog (bootstrap not run, or wrong account). */
export class NoDogError extends Error {
  constructor() {
    super('No dog is visible to this account.');
    this.name = 'NoDogError';
  }
}

/**
 * Another entry already fills this schedule slot on this date (for example, the other household
 * member logged it a moment earlier). Reload the day and edit that entry instead.
 */
export class DuplicateSlotEntryError extends Error {
  constructor(readonly date: string, readonly scheduleSlotId: string) {
    super(`Slot ${scheduleSlotId} already has an entry on ${date}.`);
    this.name = 'DuplicateSlotEntryError';
  }
}
