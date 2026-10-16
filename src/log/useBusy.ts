import { useCallback, useRef, useState } from 'react';

/**
 * In-flight guard for writes: while one runs, further calls are ignored (a double tap on Save,
 * Delete or Given writes once). `busy` disables the buttons meanwhile.
 */
export function useBusy() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const guard = useCallback(
    <A extends unknown[]>(fn: (...args: A) => Promise<unknown>) =>
      async (...args: A) => {
        if (running.current) return;
        running.current = true;
        setBusy(true);
        try {
          await fn(...args);
        } finally {
          running.current = false;
          setBusy(false);
        }
      },
    [],
  );
  return { busy, guard };
}
