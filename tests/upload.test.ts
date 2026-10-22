// Photo upload limits (JCB-7 QA): slow but moving uploads finish; stalled ones give up after 20 s
// without progress; nothing runs past 120 s; without progress events the limit scales with size.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_UPLOAD_MS, STALL_MS, UploadError, fetchUploader, uploadLimitMs, xhrUploader } from '../src/data/upload';
import { OWN_LIMITS, withTimeout } from '../src/data/timeout';

type Listener = (e?: unknown) => void;
/** A stand-in XMLHttpRequest whose progress and end the test drives. */
class FakeXhr {
  static last: FakeXhr | null = null;
  status = 0;
  responseText = '';
  aborted = false;
  sent: unknown = null;
  private on = new Map<string, Listener[]>();
  private onUpload = new Map<string, Listener[]>();
  upload = { addEventListener: (type: string, fn: Listener) => this.onUpload.set(type, [...(this.onUpload.get(type) ?? []), fn]) };
  constructor() {
    FakeXhr.last = this;
  }
  addEventListener(type: string, fn: Listener) {
    this.on.set(type, [...(this.on.get(type) ?? []), fn]);
  }
  open() {}
  setRequestHeader() {}
  send(body: unknown) {
    this.sent = body;
  }
  abort() {
    this.aborted = true;
  }
  progress(event?: unknown) {
    this.onUpload.get('progress')?.forEach((fn) => fn(event));
  }
  finish(status: number, text = '{}') {
    this.status = status;
    this.responseText = text;
    this.on.get('load')?.forEach((fn) => fn());
  }
}

const request = (bytes = 400 * 1024) => ({ url: 'https://example.test/upload', headers: { 'content-type': 'image/jpeg' }, body: new Blob([new Uint8Array(bytes)]) });

describe('upload limits', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a slow upload that keeps moving finishes, even after a minute', async () => {
    const upload = xhrUploader({ XHR: FakeXhr as never })(request());
    const xhr = FakeXhr.last!;
    // ~400 KB at ~6 KB/s: progress every 15 s for 75 s.
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(15_000);
      xhr.progress();
    }
    xhr.finish(200);
    await expect(upload).resolves.toEqual({ status: 200, text: '{}' });
    expect(xhr.aborted).toBe(false);
  });

  it('reports how much of the body went (0 to 1) while it is sent (PDF rows show it, JCB-76)', async () => {
    const seen: number[] = [];
    const upload = xhrUploader({ XHR: FakeXhr as never })({ ...request(), onProgress: (f) => seen.push(f) });
    const xhr = FakeXhr.last!;
    xhr.progress({ lengthComputable: true, loaded: 100, total: 400 });
    xhr.progress({ lengthComputable: false, loaded: 0, total: 0 });
    xhr.progress({ lengthComputable: true, loaded: 400, total: 400 });
    xhr.finish(200);
    await upload;
    expect(seen).toEqual([0.25, 1]);
  });

  it('fetch uploads report done once the answer is good', async () => {
    const seen: number[] = [];
    await fetchUploader(async () => new Response('{}', { status: 200 }))({ ...request(), onProgress: (f) => seen.push(f) });
    await fetchUploader(async () => new Response('{}', { status: 500 }))({ ...request(), onProgress: (f) => seen.push(f) });
    expect(seen).toEqual([1]);
  });

  it(`an upload with no progress for ${STALL_MS / 1000} s gives up`, async () => {
    const upload = xhrUploader({ XHR: FakeXhr as never })(request());
    const xhr = FakeXhr.last!;
    const caught = upload.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    xhr.progress();
    await vi.advanceTimersByTimeAsync(STALL_MS - 1);
    expect(xhr.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const err = await caught;
    expect(err).toBeInstanceOf(UploadError);
    expect((err as UploadError).kind).toBe('stalled');
    expect(xhr.aborted).toBe(true);
  });

  it(`no upload runs past ${MAX_UPLOAD_MS / 1000} s, however it moves`, async () => {
    const upload = xhrUploader({ XHR: FakeXhr as never })(request());
    const xhr = FakeXhr.last!;
    const caught = upload.catch((e: unknown) => e);
    for (let t = 0; t < MAX_UPLOAD_MS; t += 10_000) {
      xhr.progress();
      await vi.advanceTimersByTimeAsync(10_000);
    }
    expect(((await caught) as UploadError).kind).toBe('timeout');
  });

  it('without progress events the limit is 15 s + 1 s per 20 KB, at most 120 s', () => {
    expect(uploadLimitMs(0)).toBe(15_000);
    expect(uploadLimitMs(400 * 1024)).toBe(35_000);
    expect(uploadLimitMs(30 * 1024 * 1024)).toBe(MAX_UPLOAD_MS);
  });

  it('fetch uploads: within the size limit it finishes, past it it gives up', async () => {
    const slow = (ms: number): typeof fetch => () => new Promise((r) => setTimeout(() => r(new Response('{}', { status: 200 })), ms));
    const ok = fetchUploader(slow(30_000))(request());
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(ok).resolves.toMatchObject({ status: 200 });
    const late = fetchUploader(slow(40_000))(request()).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(35_000);
    expect(((await late) as UploadError).kind).toBe('timeout');
  });

  it("the repository's 15 s call limit leaves uploads to their own limits", async () => {
    expect(OWN_LIMITS.has('uploadPhotoFiles')).toBe(true);
    expect(OWN_LIMITS.has('uploadDocumentFile')).toBe(true);
    const repo = withTimeout({ uploadPhotoFiles: () => new Promise((r) => setTimeout(() => r('done'), 60_000)), other: () => new Promise(() => {}) }, 15_000);
    const upload = repo.uploadPhotoFiles();
    const other = repo.other().catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(upload).resolves.toBe('done');
    expect(await other).toMatchObject({ code: 'timeout' });
  });
});
