// The launch cover (JCB-82) is plain HTML in index.html, painted before any JS runs. It stays until the
// first data has loaded or failed (or the app has nothing to load: sign-in, setup problems), then fades out.

/** Never keep the cover longer than this, whatever happens (a hung request must not hide the app). */
export const LAUNCH_MAX_MS = 8000;
const FADE_MS = 220;

let done = false;

export function dismissLaunch(): void {
  if (done) return;
  done = true;
  const cover = document.getElementById('launch');
  document.documentElement.classList.remove('launching');
  if (!cover) return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return cover.remove();
  cover.classList.add('launch--out');
  setTimeout(() => cover.remove(), FADE_MS);
}

/** Arms the safety net; called once from main.tsx. */
export function armLaunchTimeout(): void {
  setTimeout(dismissLaunch, LAUNCH_MAX_MS);
}

/** Test helper: allow the cover to be dismissed again. */
export function resetLaunchForTests(): void {
  done = false;
}
