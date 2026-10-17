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
export const CrossIcon = ({ size = 12 }: { size?: number }) => (
  <svg {...stroke(size, 2.6)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const CheckIcon = ({ size = 14 }: { size?: number }) => (
  <svg {...stroke(size, 2.8)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const CHEVRON = { left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6', up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6' };
export const ChevronIcon = ({ dir = 'right', size = 14 }: { dir?: keyof typeof CHEVRON; size?: number }) => (
  <svg {...stroke(size, 2.4)}>
    <path d={CHEVRON[dir]} />
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
/** A camera: photo pick tiles and the + Add sheet's Photo (same shape as the photo EventBadge). */
export const CameraIcon = ({ size = 22 }: { size?: number }) => (
  <svg {...stroke(size)}>
    <path d="M3 8h4l2-3h6l2 3h4v12H3z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </svg>
);
export const DotsIcon =({ size = 15 }: { size?: number }) => (
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
/** Pinned: a map pin (NavBar tab, empty state). */
export const PinIcon = ({ active = false, size = 22 }: { active?: boolean; size?: number }) => (
  <svg {...stroke(size, active ? 2.1 : 1.8)}>
    <path d="M9 3.5h6l-1 5.5 3.5 3.5v2h-11v-2L10 9z" />
    <path d="M12 14.5V21" />
  </svg>
);
/** Tracked: a target (NavBar tab, empty state). */
export const TrackedIcon = ({ active = false, size = 22 }: { active?: boolean; size?: number }) => (
  <svg {...stroke(size, active ? 2.1 : 1.8)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
  </svg>
);
/** The small target glyph of a ConditionTag. */
export const TargetIcon = ({ size = 11 }: { size?: number }) => (
  <svg {...stroke(size, 2.6)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
  </svg>
);
