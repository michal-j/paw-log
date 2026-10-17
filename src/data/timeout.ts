import { RepositoryError } from './errors';

/** How long one repository call (a read or a write, all its requests together) may take (JCB-71). */
export const OPERATION_TIMEOUT_MS = 15_000;
/** `RepositoryError.code` of a call that took longer than that. */
export const TIMEOUT_CODE = 'timeout';

function limit<T>(work: Promise<T>, ms: number, operation: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RepositoryError(operation, TIMEOUT_CODE, `no answer within ${ms / 1000} s`)), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/**
 * The same repository, but every call that returns a promise rejects with a RepositoryError
 * (code `timeout`) when it has not settled within `ms`. Whatever waits on it (the Save button's
 * in-flight guard, the write queue, a reload) is then released instead of waiting forever.
 * Calls the repository makes on itself are not limited separately.
 */
export function withTimeout<R extends object>(repository: R, ms: number = OPERATION_TIMEOUT_MS): R {
  return new Proxy(repository, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        const result: unknown = (value as (...a: unknown[]) => unknown).apply(target, args);
        return result instanceof Promise ? limit(result, ms, String(prop)) : result;
      };
    },
  });
}
