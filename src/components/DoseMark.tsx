import type { CSSProperties } from 'react';
import type { MarkSize, MarkState } from '../timeline/model';
import './marks.css';

/** Only token-shaped names reach CSS; anything else falls back to the neutral mark colour. */
const TOKEN_NAME = /^[a-z0-9-]+$/;
export const colourVar = (token: string) => `var(--color-${TOKEN_NAME.test(token) ? token : 'mark-neutral'})`;

/**
 * The circle for one meal, medication or treat (docs/design-system/components/DoseMark).
 * Size is meaning (food = big), state is shape (filled, hollow, half from the bottom), colour is the item.
 */
export function DoseMark({ colour, size, state }: { colour: string; size: MarkSize; state: MarkState }) {
  const style = { '--mark': colourVar(colour) } as CSSProperties;
  return <span className={`dose-mark dose-mark--${size} dose-mark--${state}`} style={style} aria-hidden="true" />;
}
