import { RepositoryError } from './errors';

/** How long one repository call (a read or a write, all its requests together) may take (JCB-71). */
export const OPERATION_TIMEOUT_MS = 15_000;
/**
 * How long a repository write may take (JCB-74): "Couldn't save" should show within about 6 s. A healthy
 * write answers in well under a second; the stuck-write retry (resilientFetch) fits inside this limit.
 */
export const WRITE_TIMEOUT_MS = 6_000;
/** Repository methods that change data: save…, delete…, remove…, add…, restore…, reorder…, link…, purge…. */
const WRITE_CALL = /^(save|delete|remove|add|restore|reorder|link|purge)[A-Z]/;
/** `RepositoryError.code` of a call that took longer than that. */
export const TIMEOUT_CODE = 'timeout';
/** Calls not limited here because they limit themselves: each file upload stops when stalled (20 s) or at 120 s. */
export const OWN_LIMITS: ReadonlySet<string> = new Set(['uploadPhotoFiles']);

function limit<T>(work: Promise<T>, ms: number, operation: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RepositoryError(operation, TIMEOUT_CODE, `no answer within ${ms / 1000} s`)), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/**
 * The same repository, but every call that returns a promise rejects with a RepositoryError
 * (code `timeout`) when it has not settled within `ms` (`WRITE_TIMEOUT_MS` for writes, JCB-74). Whatever waits on it (the Save button's
 * in-flight guard, the write queue, a reload) is then released instead of waiting forever.
 * Calls the repository makes on itself are not limited separately.
 */
export function withTimeout<R extends object>(repository: R, ms: number = OPERATION_TIMEOUT_MS): R {
  return new Proxy(repository, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      // Photo uploads have their own limits (src/data/upload.ts): slow but moving is fine, stalled is not.
      if (typeof prop === 'string' && OWN_LIMITS.has(prop)) return (value as (...a: unknown[]) => unknown).bind(target);
      return (...args: unknown[]) => {
        const result: unknown = (value as (...a: unknown[]) => unknown).apply(target, args);
        return result instanceof Promise ? limit(result, WRITE_CALL.test(String(prop)) ? Math.min(ms, WRITE_TIMEOUT_MS) : ms, String(prop)) : result;
      };
    },
  });
}
