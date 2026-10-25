// JCB-71: after a request with no answer, two probes say which host still answers; only status and time are logged.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROBE_EVERY_MS, probeStall, resetProbeForTests } from '../src/diag/probe';
import { resilientFetch } from '../src/auth/resilientFetch';
import { diagRows, resetDiagForTests, startDiag } from '../src/diag/requestLog';

const lines = () => diagRows().flatMap((r) => (r.kind === 'action' ? [r.text] : []));
const settle = () => new Promise((r) => setTimeout(r, 40));

beforeEach(() => {
  localStorage.clear();
  resetDiagForTests();
  resetProbeForTests();
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  resetDiagForTests();
});

describe('probe after a stall', () => {
  it('does nothing until the real app has started the log', async () => {
    const f = vi.fn(async () => new Response('', { status: 200 }));
    probeStall('https://p.test/rest/v1/event', f as never);
    await settle();
    expect(f).not.toHaveBeenCalled();
  });

  it('asks the app host and the Supabase host, counts any status as an answer, and logs no URL', async () => {
    startDiag(window);
    const f = vi.fn(async (url: string) => new Response('', { status: String(url).includes('/auth/v1/health') ? 401 : 200 }));
    probeStall('https://p.test/rest/v1/event?id=eq.50000000-0000-4000-8000-000000000001', f as never, 200);
    await settle();
    const text = lines().join('\n');
    expect(text).toMatch(/probe after no answer \(browser says online: (yes|no)\)/);
    expect(text).toMatch(/probe app host: answered 200 in \d+ ms/);
    expect(text).toMatch(/probe Supabase host: answered 401 in \d+ ms/);
    expect(text).not.toContain('p.test');
    expect(text).not.toContain('5000000');
    expect(f.mock.calls.map((c) => c[0] as string).some((u) => u === 'https://p.test/auth/v1/health')).toBe(true);
  });

  it('says no answer for a silent host and network error for a refused one, and runs at most once per 20 s', async () => {
    startDiag(window);
    const f = vi.fn((url: string, init?: RequestInit) =>
      String(url).includes('/auth/v1/health')
        ? new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))))
        : Promise.reject(new TypeError('Load failed')),
    );
    probeStall('https://p.test/rest/v1/event', f as never, 60);
    await new Promise((r) => setTimeout(r, 150));
    const text = lines().join('\n');
    expect(text).toMatch(/probe app host: network error in \d+ ms/);
    expect(text).toMatch(/probe Supabase host: no answer in \d+ ms/);
    probeStall('https://p.test/rest/v1/event', f as never, 60); // too soon
    expect(f).toHaveBeenCalledTimes(2);
    expect(PROBE_EVERY_MS).toBe(20_000);
  });
});

describe('resilientFetch calls the probe only for a request with no answer', () => {
  const never = () => new Promise<Response>(() => undefined);
  const quiet = { doc: undefined, log: () => () => undefined };

  it('on a timeout, with the failed request\'s URL', async () => {
    const probe = vi.fn();
    const f = resilientFetch(never, { ...quiet, timeoutMs: 30, probe });
    await expect(f('https://p.test/rest/v1/entry')).rejects.toBeTruthy();
    expect(probe).toHaveBeenCalledWith('https://p.test/rest/v1/entry');
  });

  it('not for an answered request or a refused one', async () => {
    const probe = vi.fn();
    await resilientFetch(async () => new Response('', { status: 500 }), { ...quiet, probe })('https://p.test/rest/v1/entry');
    await expect(resilientFetch(async () => Promise.reject(new TypeError('Load failed')), { ...quiet, probe })('https://p.test/rest/v1/entry')).rejects.toBeTruthy();
    expect(probe).not.toHaveBeenCalled();
  });
});
