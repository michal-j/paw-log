import { useEffect, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react';

type Save = (v: string) => Promise<boolean> | boolean | void;

/**
 * A date or time input that saves on commit, not per keystroke: when it loses focus (on iPhone,
 * when the picker closes), on Enter, and when it unmounts with a change pending (the sheet closed
 * with Escape). Typing "0", "8" on a desktop time field would otherwise save 00:… and then 08:…,
 * and on iPhone every turn of the wheel would save, reload and reset the field under the finger.
 * What is typed is never overwritten by a reload; a saved value stays shown until the reloaded
 * value arrives (or the save fails, which puts the stored value back).
 */
export function CommitInput({
  value,
  valid,
  onCommit,
  ...rest
}: {
  value: string;
  /** A complete value worth saving ("07:30", "2026-10-01"). */
  valid: (v: string) => boolean;
  /** Save; resolve false when it failed. */
  onCommit: Save;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur'>) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ text: string; over: string } | null>(null);
  // What the handlers (and the unmount) read: always the last rendered values.
  const latest = useRef({ draft, value, onCommit, valid });
  useLayoutEffect(() => {
    latest.current = { draft, value, onCommit, valid };
  });

  const commit = () => {
    const { draft: d, value: v, onCommit: save, valid: ok } = latest.current;
    latest.current.draft = null;
    setDraft(null);
    if (d === null || d === v || !ok(d)) return;
    setSaved({ text: d, over: v });
    void Promise.resolve(save(d)).then((done) => done === false && setSaved(null));
  };

  // Closing the sheet without a blur (Escape) still saves what was typed.
  useEffect(
    () => () => {
      const { draft: d, value: v, onCommit: save, valid: ok } = latest.current;
      if (d !== null && d !== v && ok(d)) void save(d);
    },
    [],
  );

  // The reloaded value has arrived: show it from now on (also if an Undo later brings the old one back).
  if (saved && saved.over !== value) setSaved(null);
  const shownSaved = saved && saved.over === value ? saved.text : null;
  return (
    <input
      {...rest}
      value={draft ?? shownSaved ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
    />
  );
}
