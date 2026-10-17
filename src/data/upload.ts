// Photo uploads (JCB-7, QA fix): a resized photo is a few hundred KB, which on slow mobile data takes
// longer than the 10 s every other request gets (resilientFetch) or the 15 s every repository call
// gets (withTimeout). Uploads therefore have their own limits, still so that none can hang:
// - with upload progress (XMLHttpRequest): give up when no bytes moved for STALL_MS, or after
//   MAX_UPLOAD_MS in all;
// - without (fetch): a limit that grows with the size, uploadLimitMs(bytes).
// An upload goes to a signed upload URL for its fixed path, so trying again replaces the same file.

/** No upload progress for this long: the upload is taken as lost (offline, or iOS suspended the app). */
export const STALL_MS = 20_000;
/** No single file upload runs longer than this. */
export const MAX_UPLOAD_MS = 120_000;
const BASE_MS = 15_000;
const MS_PER_20_KB = 1_000;

/** Limit for an upload whose progress cannot be seen: 15 s plus 1 s per 20 KB, at most 120 s. */
export function uploadLimitMs(bytes: number): number {
  return Math.min(MAX_UPLOAD_MS, BASE_MS + MS_PER_20_KB * Math.ceil(bytes / 20_480));
}

export interface UploadRequest {
  url: string;
  headers: Record<string, string>;
  body: Blob;
}
export interface UploadResponse {
  status: number;
  text: string;
}
/** PUTs `body` to `url`; resolves with the HTTP answer, rejects with UploadError when it gives up. */
export type Uploader = (request: UploadRequest) => Promise<UploadResponse>;

export class UploadError extends Error {
  constructor(
    /** `stalled`: no progress for STALL_MS; `timeout`: over the time limit; `network`: the connection failed. */
    readonly kind: 'stalled' | 'timeout' | 'network',
    message: string,
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

type XhrLike = Pick<XMLHttpRequest, 'open' | 'setRequestHeader' | 'send' | 'abort' | 'status' | 'responseText'> & {
  upload: Pick<XMLHttpRequestUpload, 'addEventListener'>;
  addEventListener: XMLHttpRequest['addEventListener'];
};

/** Uploads with XMLHttpRequest, whose upload progress shows a slow upload apart from a dead one. */
export function xhrUploader({
  XHR = globalThis.XMLHttpRequest as unknown as new () => XhrLike,
  stallMs = STALL_MS,
  maxMs = MAX_UPLOAD_MS,
}: { XHR?: new () => XhrLike; stallMs?: number; maxMs?: number } = {}): Uploader {
  return (request) =>
    new Promise<UploadResponse>((resolve, reject) => {
      const xhr = new XHR();
      let stall: ReturnType<typeof setTimeout> | undefined;
      let done = false;
      const finish = (fn: () => void) => {
        if (done) return;
        done = true;
        clearTimeout(stall);
        clearTimeout(cap);
        fn();
      };
      const fail = (kind: UploadError['kind'], message: string) => {
        finish(() => {
          xhr.abort();
          reject(new UploadError(kind, message));
        });
      };
      const alive = () => {
        clearTimeout(stall);
        stall = setTimeout(() => fail('stalled', `no upload progress for ${stallMs / 1000} s`), stallMs);
      };
      const cap = setTimeout(() => fail('timeout', `upload took longer than ${maxMs / 1000} s`), maxMs);
      xhr.upload.addEventListener('progress', alive);
      xhr.addEventListener('progress', alive);
      xhr.addEventListener('load', () => finish(() => resolve({ status: xhr.status, text: xhr.responseText })));
      xhr.addEventListener('error', () => fail('network', 'the upload failed'));
      xhr.addEventListener('abort', () => fail('network', 'the upload was aborted'));
      xhr.addEventListener('timeout', () => fail('timeout', 'the upload timed out'));
      xhr.open('PUT', request.url);
      for (const [k, v] of Object.entries(request.headers)) xhr.setRequestHeader(k, v);
      alive();
      xhr.send(request.body);
    });
}

/** Uploads with fetch (no progress): limited by the size of the file, uploadLimitMs. */
export function fetchUploader(fetchImpl: typeof fetch, limitMs: (bytes: number) => number = uploadLimitMs): Uploader {
  return async (request) => {
    const ms = limitMs(request.body.size);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new UploadError('timeout', `upload took longer than ${ms / 1000} s`));
      }, ms);
    });
    try {
      const res = await Promise.race([
        fetchImpl(request.url, { method: 'PUT', headers: request.headers, body: request.body, signal: controller.signal }),
        late,
      ]);
      return { status: res.status, text: await Promise.race([res.text(), late]) };
    } catch (err) {
      throw err instanceof UploadError ? err : new UploadError('network', String((err as Error)?.message ?? err));
    } finally {
      clearTimeout(timer);
    }
  };
}

/** XMLHttpRequest where there is one (browsers), else fetch. */
export function defaultUploader(): Uploader {
  return typeof XMLHttpRequest === 'function' ? xhrUploader() : fetchUploader((input, init) => fetch(input, init));
}
