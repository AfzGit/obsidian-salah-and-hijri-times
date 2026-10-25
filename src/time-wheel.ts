/**
 * Geometry helpers for the visual time picker.
 *
 * The picker is a native scroll container ("wheel") with a fixed row height.
 * Two empty spacer rows above and below the values let the first and last value
 * reach the vertical centre, and five rows are visible at once. With an odd
 * number of visible rows and `spacerRows = (visibleRows - 1) / 2`, the exact
 * scroll offset for item `i` is `i * rowHeight`.
 *
 * That simple relationship is the whole alignment contract: the wheel never
 * rests between two values. Keep this file, `styles.css`, and
 * `.salah-wheel-picker` in sync when changing the row height or row count.
 *
 * The module is deliberately DOM-free so the arithmetic can be unit-tested in
 * Node; the UI code in `main.ts` only reads/writes `scrollTop` and classes.
 */

/** Rows visible at once: up2, up1, middle, down1, down2. */
export const TIME_WHEEL_VISIBLE_ROWS = 5;

/** Empty rows above and below the list, so edge values can sit in the middle. */
export const TIME_WHEEL_SPACER_ROWS = 2;

/** Default row height in CSS pixels; mirrored by `--salah-time-row-height`. */
export const TIME_WHEEL_ROW_HEIGHT = 38;

/**
 * Scroll offset that places `index` exactly on the centre row.
 *
 * Derived from the row-centre position minus half the viewport height:
 * `spacer + index * row + row / 2 - visible * row / 2`.
 * With the defaults this reduces to `index * rowHeight`.
 */
export function timeWheelScrollTop(index: number, rowHeight = TIME_WHEEL_ROW_HEIGHT): number {
  const spacerHeight = TIME_WHEEL_SPACER_ROWS * rowHeight;
  const viewportHeight = TIME_WHEEL_VISIBLE_ROWS * rowHeight;
  const centreOffset = spacerHeight + index * rowHeight + rowHeight / 2 - viewportHeight / 2;
  return Math.round(centreOffset);
}

/**
 * Convert an arbitrary scroll offset (trackpad, touch, scrollbar, programmatic)
 * into the nearest row index. Results are clamped to `itemCount` when it is a
 * positive finite number, so callers can safely use the result as an index.
 */
export function timeWheelIndexFromScroll(scrollTop: number, rowHeight = TIME_WHEEL_ROW_HEIGHT, itemCount = Number.POSITIVE_INFINITY): number {
  const raw = Math.round(scrollTop / rowHeight);
  if (!Number.isFinite(itemCount) || itemCount < 1) return Math.max(0, raw);
  return Math.max(0, Math.min(itemCount - 1, raw));
}

/** Clamp an index to a wheel that currently renders `itemCount` values. */
export function clampTimeWheelIndex(index: number, itemCount: number): number {
  if (!Number.isFinite(itemCount) || itemCount < 1) return 0;
  return Math.max(0, Math.min(itemCount - 1, Math.trunc(index)));
}
