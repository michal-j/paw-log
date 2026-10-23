The search field of the Search tab: a text field with a leading Search glyph, a clear button, and beside it the Filters button with a count pill.

The field is the Sheet's input (50px high, 16px text so iOS does not zoom, `radius-md`, `line-strong` border, the 3px `mint` focus glow) on a `surface` fill, with a 18px Search glyph in `mint-deep` at the left (42px left padding) and a 44px clear target at the right, a 20px `line` circle holding a `ink-2` cross, shown only while there is text. Its accessible name and placeholder are the same short phrase ("Search the log"). It sits on a `surface-tint` bar with a `line` bottom border and `shadow-bar-top`, 8px above and 12px below.

The Filters button is the ghost Button (50px high so it lines up with the field, 44px hit area) with the Sliders glyph in `mint-deep`. When filters are on it carries a **count pill** after the label: at least 20px wide and 20px high, `radius-full`, `mint-bg` fill, 1px `mint-line` border, `mint-deep` number in the `badge` style at 12px. The button's accessible name then says how many are on ("Filters, 2 on"). The pill is for a count on a button; a state that has no count does not use it.

Search text a result shows is highlighted with `mark`: `mint-bg` behind `ink` text, a 2px `mint-line` underline inset, `radius-xs`. Never mint as text colour. Every text of a result goes through one highlighter, so what is marked is exactly what matched.

The consumer provides the label, the text, the filter count and the handlers.
