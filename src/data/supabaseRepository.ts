import type { Repository } from './repository';

const notReady = (): never => {
  throw new Error('SupabaseRepository is a stub until slice 2b (schema and auth).');
};

/** Stub: the real implementation arrives with the Supabase schema and auth (slice 2b). */
export class SupabaseRepository implements Repository {
  today = notReady;
  getDog = notReady;
  listItems = notReady;
  listEntries = notReady;
  listEvents = notReady;
  saveEntry = notReady;
  deleteEntry = notReady;
  saveEvent = notReady;
  deleteEvent = notReady;
}
