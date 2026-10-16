// Small inline glyphs from the R10 prototype and the JCB-25 add/edit proposal. 24px grid, currentColor.
const stroke = (size: number, width = 2) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: width,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const PlusIcon = ({ size = 13 }: { size?: number }) => (
  <svg {...stroke(size, 2.8)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const CheckIcon = ({ size = 14 }: { size?: number }) => (
  <svg {...stroke(size, 2.8)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const ChevronIcon = ({ dir = 'right', size = 14 }: { dir?: 'left' | 'right'; size?: number }) => (
  <svg {...stroke(size, 2.4)}>
    <path d={dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
  </svg>
);
/** The usual day: a clock with a return arrow. */
export const RoutineIcon = ({ size = 16 }: { size?: number }) => (
  <svg {...stroke(size)}>
    <path d="M20 12a8 8 0 1 1-2.3-5.7" />
    <path d="M20 4v4h-4" />
    <path d="M12 8v4l3 2" />
  </svg>
);
export const BowlIcon = () => (
  <svg {...stroke(15)}>
    <path d="M3 11h18a9 9 0 0 1-18 0z" />
    <path d="M8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4" />
  </svg>
);
export const PillIcon = () => (
  <svg {...stroke(15)}>
    <rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)" />
    <path d="M9.5 8.3l5 7.4" />
  </svg>
);
export const NoteIcon = ({ size = 15 }: { size?: number }) => (
  <svg {...stroke(size)}>
    <path d="M5 4h10l4 4v12H5z" />
    <path d="M9 12h6M9 16h6" />
  </svg>
);
export const DotsIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);
export const MenuIcon = ({ size = 18 }: { size?: number }) => (
  <svg {...stroke(size, 2.1)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const TimelineIcon = ({ active }: { active: boolean }) => (
  <svg {...stroke(22, active ? 2.1 : 1.8)}>
    <path d="M9.5 6.5H20M9.5 12H20M9.5 17.5H20" />
    <circle cx="4.8" cy="6.5" r="1.1" />
    <circle cx="4.8" cy="12" r="1.1" />
    <circle cx="4.8" cy="17.5" r="1.1" />
  </svg>
);
