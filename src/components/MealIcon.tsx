/** Breakfast (sunrise), dinner (sun), supper (sunset); glyphs from the R10 prototype. Used by the Timeline and the Day view. */
export function MealIcon({ part, size = 22 }: { part: number; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 40 40', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, 'aria-hidden': true };
  if (part === 2)
    return (
      <svg {...common}>
        <path d="M11 28a9 9 0 0 1 18 0z" fill="currentColor" />
        <path d="M5 31h30M20 8v5M8.5 14l3.5 3.5M31.5 14L28 17.5M3 24h4M33 24h4" />
      </svg>
    );
  if (part === 4)
    return (
      <svg {...common}>
        <circle cx="20" cy="20" r="7" fill="currentColor" />
        <path d="M20 4v5M20 31v5M4 20h5M31 20h5M8.7 8.7l3.5 3.5M27.8 27.8l3.5 3.5M31.3 8.7l-3.5 3.5M12.2 27.8l-3.5 3.5" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M7 22a13 13 0 0 1 26 0z" fill="currentColor" stroke="none" />
      <path d="M7 26.5h26M10 30.5h20M14 34.5h12" />
    </svg>
  );
}
