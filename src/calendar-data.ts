export interface CalendarApiDate {
  timings: Record<string, string>;
  date: {
    gregorian: { date: string; weekday: { en: string }; month: { number: number; en: string }; year: string };
    hijri: { date: string; day: string; month: { number: number; en: string }; year: string };
  };
}
export interface CalendarEntry {
  api: CalendarApiDate;
  gregorian: Date;
  hijriDay: number;
  hijriMonth: number;
  hijriYear: number;
}

/** Parse the API's DD-MM-YYYY date into a local date, avoiding UTC day shifts. */
export function parseCalendarDate(value: string): Date {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) throw new Error(`Invalid calendar date: ${value}`);
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return date;
}

/** Preserve precisely the API's returned month length; never synthesize day 30. */
export function mapCalendarDates(dates: CalendarApiDate[]): CalendarEntry[] {
  return dates.map(api => {
    const hijriDay = Number(api.date.hijri.day);
    const hijriMonth = api.date.hijri.month.number;
    const hijriYear = Number(api.date.hijri.year);
    if (!Number.isInteger(hijriDay) || hijriDay < 1 || hijriDay > 30 || !Number.isInteger(hijriMonth) || hijriMonth < 1 || hijriMonth > 12 || !Number.isInteger(hijriYear)) {
      throw new Error("Calendar service returned an invalid Hijri date.");
    }
    return { api, gregorian: parseCalendarDate(api.date.gregorian.date), hijriDay, hijriMonth, hijriYear };
  }).sort((left, right) => left.gregorian.getTime() - right.gregorian.getTime());
}

export interface FastingMarkers { monthly: boolean; weekly: boolean; jummah: boolean }

/** Return overlapping fasting/Jummah markers for one Gregorian and Hijri calendar cell. */
export function fastingMarkers(date: Date, hijriDay: number): FastingMarkers {
  const weekday = date.getDay();
  return {
    monthly: hijriDay >= 13 && hijriDay <= 15,
    weekly: weekday === 1 || weekday === 4,
    jummah: weekday === 5,
  };
}

/** Compute Last Third from API clock values, allowing timezone annotations after HH:mm. */
export function calculateLastThird(maghrib: string, fajr: string): string | null {
  const minutes = (value: string): number | null => {
    const match = /^(\d{1,2}):(\d{2})(?:\s|$)/.exec(value);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return hour < 24 && minute < 60 ? hour * 60 + minute : null;
  };
  const evening = minutes(maghrib);
  const morning = minutes(fajr);
  if (evening === null || morning === null) return null;
  // The night crosses midnight; Last Third begins after two thirds of its duration.
  const nextMorning = morning + (morning <= evening ? 1440 : 0);
  return formatClock(Math.floor(evening + (nextMorning - evening) * 2 / 3));
}

/** Keep this tiny formatter local to the pure calendar-data module. */
function formatClock(totalMinutes: number): string {
  const wrapped = (totalMinutes % 1440 + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}
