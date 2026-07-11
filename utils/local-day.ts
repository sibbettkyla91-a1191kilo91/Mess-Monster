/**
 * Local-timezone day helpers.
 *
 * All day-based mechanics (streaks, active days, daily roll, tap limit,
 * "done today") must use the device's LOCAL calendar day. Using
 * toISOString() (UTC) makes the day roll over at 4–8pm local time in the
 * US, corrupting streak and active-day tracking.
 */

/** YYYY-MM-DD for the given date (default: now) in the device's local timezone. */
export function localDayString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD for the local calendar day before today (DST-safe). */
export function localYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDayString(d);
}
