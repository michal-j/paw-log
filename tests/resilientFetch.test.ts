// JCB-71: the Supabase client's fetch always settles, and every repository call has a time limit.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resilientFetch } from '../src/auth/resilientFetch';
import { RepositoryError } from '../src/data/errors';
import { TIMEOUT_CODE, withTimeout } from '../src/data/timeout';

/** A page whose visibility the test switches, like iOS sending the PWA to the background and back. */
function fakePage() {
  const page = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState };
  page.visibilityState = 'visible';
  const set = (state: DocumentVisibilityState) => {
    page.visibilityState = state;
    page.dispatchEvent(new Event('visibilitychange'));
  };
  return { doc: page as unknown as Document, hide: () => set('hidden'), show: () => set('visible') };
}

/** A request iOS lost: never answers and ignores aborts. Counts the calls. */
function lostRequests() {
  const calls: (RequestInit | undefined)[] = [];
  const base: typeof fetch = (_input, init) => {
    calls.push(init);
    return new Promise<Response>(() => {});
  };
  return { base, calls };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('resilientFetch', () => {
  it('passes answers through', async () => {
    const f = resilientFetch(async () => new Response('ok'), { doc: fakePage().doc });
    expect(await (await f('https://x.test/a')).text()).toBe('ok');
  });

  it('gives up on a request that never answers after the time limit, even if it ignores the abort', async () => {
    vi.useFakeTimers();
    const { base, calls } = lostRequests();
    const f = resilientFetch(base, { timeoutMs: 1000, doc: fakePage().doc });
    const done = f('https://x.test/a').then(
      () => 'answered',
      (e: Error) => e.name,
    );
    await vi.advanceTimersByTimeAsync(999);
    expect(calls[0]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await done).toBe('AbortError');
    expect(calls[0]?.signal?.aborted).toBe(true);
  });

  it('on return from the background, drops the requests that ran meanwhile, not the new ones', async () => {
    const page = fakePage();
    const { base } = lostRequests();
    const f = resilientFetch(base, { timeoutMs: 60_000, doc: page.doc });
    const settled: string[] = [];
    const track = (name: string, p: Promise<Response>) => p.catch((e: Error) => settled.push(`${name}:${e.name}`));
    const before = track('before', f('https://x.test/a'));
    page.hide();
    const whileHidden = track('whileHidden', f('https://x.test/b'));
    await Promise.resolve();
    expect(settled).toEqual([]);
    page.show();
    const after = track('after', f('https://x.test/c'));
    await Promise.all([before, whileHidden]);
    expect(settled.sort()).toEqual(['before:AbortError', 'whileHidden:AbortError']);
    await new Promise((r) => setTimeout(r, 10));
    expect(settled).not.toContain('after:AbortError');
    void after;
  });

  it('a request that answered before the app went to the background is not touched', async () => {
    const page = fakePage();
    const f = resilientFetch(async () => new Response('ok'), { doc: page.doc });
    const res = await f('https://x.test/a');
    page.hide();
    page.show();
    expect(await res.text()).toBe('ok');
  });

  it("follows the caller's abort signal", async () => {
    const { base } = lostRequests();
    const f = resilientFetch(base, { timeoutMs: 60_000, doc: fakePage().doc });
    const controller = new AbortController();
    const p = f('https://x.test/a', { signal: controller.signal });
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('withTimeout', () => {
  const repo = {
    value: 7,
    today: () => '2026-10-15',
    fast: async (x: number) => x * 2,
    fails: async () => {
      throw new RepositoryError('fails', '42501', 'no');
    },
    hangs: () => new Promise<void>(() => {}),
  };

  it('keeps answers, errors, plain values and sync methods as they are', async () => {
    const timed = withTimeout(repo, 1000);
    expect(timed.value).toBe(7);
    expect(timed.today()).toBe('2026-10-15');
    expect(await timed.fast(2)).toBe(4);
    await expect(timed.fails()).rejects.toMatchObject({ code: '42501' });
  });

  it('rejects a call that does not settle in time with a timeout RepositoryError', async () => {
    vi.useFakeTimers();
    const timed = withTimeout(repo, 15_000);
    const p = timed.hangs();
    const caught = p.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(15_000);
    const err = await caught;
    expect(err).toBeInstanceOf(RepositoryError);
    expect(err).toMatchObject({ operation: 'hangs', code: TIMEOUT_CODE });
  });
});
