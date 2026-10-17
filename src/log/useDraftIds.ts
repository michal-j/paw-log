import { useCallback, useMemo, useRef } from 'react';
import { newId } from './actions';

/**
 * Ids for the rows a sheet creates: made once per open sheet and kept across Save attempts (JCB-71).
 * A save that failed or got no answer in time may still have reached the database, so trying again
 * must update those rows (same ids, the writes are upserts), never add copies.
 * `id('entry')` is always the same id; `seq('slot')` returns a generator (slot 1, slot 2, …) that
 * starts over on every call, for code that asks for a varying number of new ids.
 */
export function useDraftIds() {
  const ids = useRef(new Map<string, string>());
  const id = useCallback((key: string) => {
    let value = ids.current.get(key);
    if (!value) {
      value = newId();
      ids.current.set(key, value);
    }
    return value;
  }, []);
  return useMemo(
    () => ({
      id,
      seq: (key: string) => {
        let n = 0;
        return () => id(`${key}#${n++}`);
      },
    }),
    [id],
  );
}
