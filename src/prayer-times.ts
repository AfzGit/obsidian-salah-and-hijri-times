import { requestUrl } from "obsidian";
import type { Settings, Schedule } from "./types";
import { formatTime, parseTime } from "./time";
import { dateAtLocation, hijriAdjustmentForNow, minutesAtLocation, shiftGregorianDate } from "./hijri-date";

const HIJRI_MONTHS = ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];

type PrayerResponse = {
  code: number;
  data: {
    timings: Record<string, string>;
    date: { hijri: { day: string; year: string; month: { number: number } } };
    meta?: { timezone?: string; timezonestring?: string };
  };
};

/** Fetch a date using Obsidian's native HTTP bridge, which also works on mobile. */
async function requestSchedule(url: URL): Promise<PrayerResponse> {
  const response = await requestUrl({ url: url.toString(), method: "GET", headers: { Accept: "application/json" } });
  if (response.status < 200 || response.status >= 300) throw new Error(`Prayer service HTTP ${response.status}.`);
  const payload = response.json as PrayerResponse;
  if (payload.code !== 200) throw new Error("No prayer timings returned.");
  return payload;
}

/** Load one local day's prayer schedule and service-adjusted Hijri date. */
export async function loadSchedule(settings: Settings, now = new Date()): Promise<Schedule> {
  if (!settings.coordinates) throw new Error("Set location in plugin settings.");
  const { latitude, longitude } = settings.coordinates;
  const date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
  let url = new URL(`https://api.aladhan.com/v1/timings/${date}`);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("method", String(settings.calculationMethod));
  let payload = await requestSchedule(url);
  // The API determines timezone from coordinates. If device and location are on
  // different calendar days, refetch using the location's date before using timings.
  const timeZone = payload.data.meta?.timezone || payload.data.meta?.timezonestring;
  const locationDate = dateAtLocation(now, timeZone);
  if (locationDate !== date) {
    url = new URL(`https://api.aladhan.com/v1/timings/${locationDate}`);
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("method", String(settings.calculationMethod));
    payload = await requestSchedule(url);
  }
  const timings = payload.data.timings;
  const adjustedTime = (name: string): string => {
    const base = parseTime(timings[name]);
    const offset = settings.prayerTimeOffsets?.[name] || 0;
    return base === null ? timings[name] : formatTime(base + offset);
  };
  // Compare the location's current wall clock to that location's Maghrib.
  const nowMinutes = minutesAtLocation(now, payload.data.meta?.timezone || payload.data.meta?.timezonestring);
  const hijriDayOffset = hijriAdjustmentForNow(settings.hijriOffset, settings.hijriRollover, nowMinutes, adjustedTime("Maghrib"));
  let hijri = payload.data.date.hijri;
  if (hijriDayOffset !== 0) {
    // Some API deployments ignore the documented adjustment query parameter. Requesting
    // the converted Hijri date for a shifted Gregorian day works consistently while the
    // prayer rows continue to use timings from the actual location-local date.
    const hijriDate = shiftGregorianDate(locationDate, hijriDayOffset);
    const hijriUrl = new URL(`https://api.aladhan.com/v1/timings/${hijriDate}`);
    hijriUrl.searchParams.set("latitude", String(latitude));
    hijriUrl.searchParams.set("longitude", String(longitude));
    hijriUrl.searchParams.set("method", String(settings.calculationMethod));
    hijri = (await requestSchedule(hijriUrl)).data.date.hijri;
  }

  // Maghrib is the sunset prayer and is the only evening prayer row.
  const prayers: Record<string, string> = {
    Fajr: adjustedTime("Fajr"),
    Sunrise: adjustedTime("Sunrise"),
    Dhuhr: adjustedTime("Dhuhr"),
    Asr: adjustedTime("Asr"),
    Maghrib: adjustedTime("Maghrib"),
    Isha: adjustedTime("Isha"),
  };
  const maghrib = parseTime(adjustedTime("Maghrib"));
  const fajr = parseTime(adjustedTime("Fajr"));
  if (maghrib !== null && fajr !== null) {
    // Last Third begins two-thirds through the night from Maghrib until the next Fajr.
    prayers.Tahajjud = formatTime(Math.floor(maghrib + (fajr + 1440 - maghrib) * 2 / 3));
  }

  const day = Number(hijri.day);
  const month = hijri.month.number;
  const year = Number(hijri.year);
  return {
    prayers: Object.entries(prayers).map(([name, time]) => ({ name, time })),
    hijriDate: `${day} ${HIJRI_MONTHS[month - 1]} ${year} AH`,
    hijriNumeric: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
    hijriMonth: String(month).padStart(2, "0"),
    maghrib: adjustedTime("Maghrib"),
    locationName: settings.locationName,
  };
}

export { buildConfiguredEvents as addIqama } from "./schedule-events";
