// Fixed timeline geometry (docs/DESIGN.md "Fixed geometry in the timeline").
// The scroll maths in model.ts and the CSS in timeline.css both derive from these numbers;
// change them together or not at all.

/** Height of one day row, px. */
export const DAY_ROW_H = 44;
/** Height of a month band for a month that has data, px. */
export const MONTH_BAND_H = 28;
/** Empty space after the oldest day, px. The oldest day is reached by the focus, not by scrolling it to the top (model.ts focusOffset). */
export const LIST_TAIL_H = 16;
/** Width of the date column on the left of each row, px. */
export const DATE_COL_W = 44;
/** Left inset of each row before the date column, px. */
export const ROW_INSET = 4;
/** Width of the tick rail, px. */
export const RAIL_W = 20;
/** Minimum width of the Events column, px. */
export const EVENTS_MIN_W = 48;

/** Circle diameters (PRODUCT.md "Reading the circles"). */
export const FOOD_MARK = 16;
export const SMALL_MARK = 11;
/** A lane is the circle plus 2px on each side. */
export const LANE_PAD = 4;
/** Horizontal breathing room inside a day-part column. */
export const COLUMN_PAD = 8;
/** Minimum column widths: meals, the last part of the day, the other parts. */
export const MEAL_COL_MIN = 44;
export const LAST_PART_COL_MIN = 36;
export const OTHER_COL_MIN = 24;

/** Rail tick thickness, px; ticks are kept inside the rail at both ends. */
export const TICK_H = 2;
/** Rail tick lengths and right offsets, px. */
export const TICK = {
  active: { w: 16, right: 2 },
  year: { w: 14, right: 3 },
  month: { w: 11, right: 4 },
  week: { w: 7, right: 4 },
} as const;

/** Underline under each meal icon in the day-parts bar: at most this wide, and this much narrower than its column. */
export const PART_TICK_MAX = 30;
export const PART_TICK_INSET = 14;
/** Scrub bubble: lifted above the finger, and kept this far left of the rail, px. */
export const SCRUB_LIFT = 18;
export const SCRUB_GAP = 8;
