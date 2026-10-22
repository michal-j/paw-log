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

describe('stalled writes are sent once more (JCB-71, stall recovery)', () => {
  const REST = 'https://x.test/rest/v1/event?on_conflict=id';
  const write = (init: RequestInit = {}): RequestInit => ({ method: 'POST', body: '{"id":"x"}', ...init });
  const quiet = () => () => {};

  /** The first `lost` requests never answer (and ignore aborts); later ones answer 201. */
  function stuckThenFine(lost = 1) {
    const calls: (RequestInit | undefined)[] = [];
    const base: typeof fetch = (_input, init) => {
      calls.push(init);
      return calls.length <= lost ? new Promise<Response>(() => {}) : Promise.resolve(new Response(null, { status: 201 }));
    };
    return { base, calls };
  }

  it('a write with no answer after the stall limit goes again as a new high-priority request, and succeeds', async () => {
    vi.useFakeTimers();
    const { base, calls } = stuckThenFine();
    const f = resilientFetch(base, { stallMs: 2500, retryMs: 3000, doc: fakePage().doc, log: quiet });
    const p = f(REST, write());
    await vi.advanceTimersByTimeAsync(2499);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await p).status).toBe(201);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.signal?.aborted).toBe(true);
    expect(calls[1]?.signal).not.toBe(calls[0]?.signal);
    expect(calls[1]).toMatchObject({ method: 'POST', body: '{"id":"x"}', cache: 'no-store', keepalive: false, priority: 'high' });
  });

  it('tries only once more: a second stall rejects after 2.5 s + 3 s, under the 6 s limit of a repository write (JCB-74)', async () => {
    vi.useFakeTimers();
    const { base, calls } = stuckThenFine(2);
    const f = resilientFetch(base, { doc: fakePage().doc, log: quiet });
    const p = f(REST, write()).then(
      () => 'answered',
      (e: Error) => e.name,
    );
    await vi.advanceTimersByTimeAsync(5_499);
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toBe('AbortError');
    expect(calls).toHaveLength(2);
  });

  it('a network error on a write is retried once', async () => {
    let n = 0;
    const f = resilientFetch(
      async () => {
        if (++n === 1) throw new TypeError('Load failed');
        return new Response(null, { status: 204 });
      },
      { doc: fakePage().doc, log: quiet },
    );
    expect((await f(REST, { method: 'DELETE' })).status).toBe(204);
    expect(n).toBe(2);
  });

  it('a write lost in the background is sent again on return', async () => {
    const page = fakePage();
    const { base, calls } = stuckThenFine();
    const f = resilientFetch(base, { stallMs: 60_000, doc: page.doc, log: quiet });
    const p = f(REST, write());
    page.hide();
    page.show();
    expect((await p).status).toBe(201);
    expect(calls).toHaveLength(2);
  });

  it('reads, auth, storage and caller-aborted writes are never repeated', async () => {
    vi.useFakeTimers();
    const cases: [string, RequestInit][] = [
      ['https://x.test/rest/v1/event?select=*', { method: 'GET' }],
      ['https://x.test/auth/v1/token?grant_type=refresh_token', write()],
      ['https://x.test/storage/v1/object/sign/photos', write()],
    ];
    for (const [url, init] of cases) {
      const { base, calls } = stuckThenFine();
      const f = resilientFetch(base, { stallMs: 1000, timeoutMs: 2000, doc: fakePage().doc, log: quiet });
      const p = f(url, init).catch((e: Error) => e.name);
      await vi.advanceTimersByTimeAsync(2000);
      expect(await p).toBe('AbortError');
      expect(calls, url).toHaveLength(1);
    }
    const { base, calls } = stuckThenFine();
    const f = resilientFetch(base, { doc: fakePage().doc, log: quiet });
    const controller = new AbortController();
    const p = f(REST, write({ signal: controller.signal })).catch((e: Error) => e.name);
    controller.abort();
    expect(await p).toBe('AbortError');
    await vi.advanceTimersByTimeAsync(20_000);
    expect(calls).toHaveLength(1);
  });

  it('notes every attempt with its outcome for the request log', async () => {
    vi.useFakeTimers();
    const notes: string[] = [];
    const log = (method: string, url: string, attempt = 1) => (outcome: unknown) =>
      void notes.push(`${method} ${url.split('?')[0]} #${attempt} ${String(outcome)}`);
    const f = resilientFetch(stuckThenFine().base, { doc: fakePage().doc, log });
    const p = f(REST, write());
    await vi.advanceTimersByTimeAsync(6000);
    await p;
    expect(notes).toEqual(['POST https://x.test/rest/v1/event #1 timeout', 'POST https://x.test/rest/v1/event #2 201']);
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

  it('gives writes a shorter limit than reads, so "Couldn\'t save" shows within about 6 s (JCB-74)', async () => {
    vi.useFakeTimers();
    const timed = withTimeout({ saveEvent: () => new Promise<void>(() => {}), listEvents: () => new Promise<void>(() => {}) });
    const save = timed.saveEvent().catch((e: unknown) => e);
    const list = timed.listEvents().then(
      () => 'answered',
      (e: unknown) => e,
    );
    await vi.advanceTimersByTimeAsync(5_999);
    let saveDone = false;
    void save.then(() => (saveDone = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(saveDone).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await save).toMatchObject({ operation: 'saveEvent', code: TIMEOUT_CODE });
    await vi.advanceTimersByTimeAsync(9_000);
    expect(await list).toMatchObject({ operation: 'listEvents', code: TIMEOUT_CODE });
  });
});
