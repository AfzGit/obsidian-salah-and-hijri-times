/** Pick the service adjustment for a Hijri date without assuming month lengths locally. */
export function hijriAdjustmentForNow(
  configuredOffset: number,
  rollover: "maghrib" | "midnight",
  currentMinutes: number,
  maghribTime: string,
): number {
  if (rollover !== "maghrib") return configuredOffset;
  const match = /^(\d{1,2}):(\d{2})/.exec(maghribTime);
  if (!match) return configuredOffset;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return configuredOffset;
  const maghribMinutes = hour * 60 + minute;
  return currentMinutes >= maghribMinutes ? configuredOffset + 1 : configuredOffset;
}

/** Read the current wall-clock minute in a target location, falling back to the device zone. */
export function minutesAtLocation(date: Date, timeZone?: string): number {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
      const hour = Number(parts.find(part => part.type === "hour")?.value);
      const minute = Number(parts.find(part => part.type === "minute")?.value);
      if (Number.isInteger(hour) && hour >= 0 && hour < 24 && Number.isInteger(minute) && minute >= 0 && minute < 60) return hour * 60 + minute;
    } catch { /* An unavailable or invalid timezone falls back to the device clock. */ }
  }
  return date.getHours() * 60 + date.getMinutes();
}

/** Format a Gregorian request date using the target location's calendar day. */
export function dateAtLocation(date: Date, timeZone?: string): string {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(date);
      const get = (type: string) => parts.find(part => part.type === type)?.value;
      const day = get("day");
      const month = get("month");
      const year = get("year");
      if (day && month && year) return `${Number(day)}-${Number(month)}-${year}`;
    } catch { /* An unavailable or invalid timezone falls back to the device calendar. */ }
  }
  return `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
}

/** Shift a location-local Gregorian API date by whole days without month-length assumptions. */
export function shiftGregorianDate(value: string, offset: number): string {
  const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(value);
  if (!match || !Number.isInteger(offset)) throw new Error("Invalid Gregorian date adjustment.");
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const source = new Date(Date.UTC(year, month - 1, day));
  if (source.getUTCFullYear() !== year || source.getUTCMonth() !== month - 1 || source.getUTCDate() !== day) {
    throw new Error("Invalid Gregorian date adjustment.");
  }
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return `${date.getUTCDate()}-${date.getUTCMonth() + 1}-${date.getUTCFullYear()}`;
}
