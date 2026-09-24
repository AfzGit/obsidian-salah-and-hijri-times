import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countdown, formatTime, nextEvent, parseTime } from "../src/time";
import { dateAtLocation, hijriAdjustmentForNow, minutesAtLocation, shiftGregorianDate } from "../src/hijri-date";
import { calculateLastThird, fastingMarkers, mapCalendarDates, parseCalendarDate, type CalendarApiDate } from "../src/calendar-data";
import { buildConfiguredEvents } from "../src/schedule-events";
import { validCoordinates } from "../src/coordinates";
import type { Schedule, Settings } from "../src/types";

describe("clock and countdown math", () => {
  it("validates 24-hour times", () => {
    assert.equal(parseTime("0:05"), 5);
    assert.equal(parseTime("23:59"), 1439);
    assert.equal(parseTime("24:00"), null);
    assert.equal(parseTime("12:60"), null);
    assert.equal(parseTime("noon"), null);
  });
  it("normalizes minute offsets around midnight", () => {
    assert.equal(formatTime(-1), "23:59");
    assert.equal(formatTime(1440), "00:00");
    assert.equal(formatTime(1501), "01:01");
  });
  it("formats countdown hours and clamps expired values", () => {
    assert.equal(countdown(3660000), "1h 01m");
    assert.equal(countdown(59999), "0m");
    assert.equal(countdown(-1), "0m");
  });
  it("selects the next valid event and rolls passed times to tomorrow", () => {
    const now = new Date(2026, 8, 23, 23, 50, 0);
    const event = nextEvent([{ name: "invalid", time: "24:00" }, { name: "Isha", time: "22:00" }, { name: "Fajr", time: "05:00" }], now);
    assert.equal(event?.name, "Fajr");
    assert.equal(event?.delta, 18600000);
    assert.equal(nextEvent([], now), null);
  });
});

describe("Hijri rollover policy", () => {
  it("applies the configured offset and increments at Maghrib", () => {
    assert.equal(hijriAdjustmentForNow(2, "maghrib", 1079, "18:00"), 2);
    assert.equal(hijriAdjustmentForNow(2, "maghrib", 1080, "18:00"), 3);
  });
  it("does not apply Maghrib rollover in midnight mode", () => {
    assert.equal(hijriAdjustmentForNow(-1, "midnight", 1439, "18:00"), -1);
  });
  it("ignores an invalid Maghrib time", () => {
    assert.equal(hijriAdjustmentForNow(4, "maghrib", 1380, "unknown"), 4);
  });
  it("uses the saved location's clock and date rather than the device timezone", () => {
    const instant = new Date("2026-09-23T02:30:00.000Z");
    assert.equal(minutesAtLocation(instant, "America/New_York"), 22 * 60 + 30);
    assert.equal(dateAtLocation(instant, "America/New_York"), "22-9-2026");
    assert.equal(dateAtLocation(instant, "Asia/Kolkata"), "23-9-2026");
  });
  it("shifts Gregorian conversion requests across month, year, and leap-day boundaries", () => {
    assert.equal(shiftGregorianDate("23-9-2026", 1), "24-9-2026");
    assert.equal(shiftGregorianDate("31-12-2026", 1), "1-1-2027");
    assert.equal(shiftGregorianDate("1-3-2024", -1), "29-2-2024");
    assert.throws(() => shiftGregorianDate("31-2-2026", 1), /Invalid Gregorian/);
  });
});

function apiDate(gregorianDay: number, hijriDay: number, hijriMonth: number): CalendarApiDate {
  const gregorian = new Date(2026, 2, gregorianDay);
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    timings: { Fajr: "05:00", Sunrise: "06:00", Dhuhr: "12:00", Asr: "15:00", Maghrib: "18:00", Isha: "20:00" },
    date: {
      gregorian: { date: `${pad(gregorian.getDate())}-${pad(gregorian.getMonth() + 1)}-${gregorian.getFullYear()}`, weekday: { en: "Sunday" }, month: { number: 3, en: "March" }, year: "2026" },
      hijri: { date: `${pad(hijriDay)}-${pad(hijriMonth)}-1447`, day: String(hijriDay), month: { number: hijriMonth, en: "Sha'ban" }, year: "1447" },
    },
  };
}

describe("calendar data and fasting markers", () => {
  it("preserves both 29-day and 30-day service month lengths", () => {
    const shortMonth = mapCalendarDates(Array.from({ length: 29 }, (_, index) => apiDate(index + 1, index + 1, 8)));
    assert.equal(shortMonth.length, 29);
    assert.equal(shortMonth[shortMonth.length - 1].hijriDay, 29);
    const longMonth = mapCalendarDates(Array.from({ length: 30 }, (_, index) => apiDate(index + 1, index + 1, 9)));
    assert.equal(longMonth.length, 30);
    assert.equal(longMonth[longMonth.length - 1].hijriDay, 30);
  });
  it("accepts month transitions from day 29 directly to day 1", () => {
    const entries = mapCalendarDates([apiDate(29, 29, 8), apiDate(30, 1, 9)]);
    assert.deepEqual(entries.map(entry => [entry.hijriDay, entry.hijriMonth]), [[29, 8], [1, 9]]);
  });
  it("rejects impossible Gregorian dates", () => {
    assert.throws(() => parseCalendarDate("31-02-2026"), /Invalid calendar date/);
  });
  it("calculates Last Third from annotated API times and rejects invalid values", () => {
    assert.equal(calculateLastThird("18:12 (IST)", "04:53 (IST)"), "01:19");
    assert.equal(calculateLastThird("18:12", "04:53"), "01:19");
    assert.equal(calculateLastThird("bad", "04:53"), null);
  });
  it("marks monthly fasting, Monday/Thursday, and Friday separately", () => {
    assert.deepEqual(fastingMarkers(new Date(2026, 6, 20), 13), { monthly: true, weekly: true, jummah: false });
    assert.deepEqual(fastingMarkers(new Date(2026, 6, 23), 10), { monthly: false, weekly: true, jummah: false });
    assert.deepEqual(fastingMarkers(new Date(2026, 6, 24), 14), { monthly: true, weekly: false, jummah: true });
  });
});

describe("configured prayer events", () => {
  const schedule: Schedule = {
    prayers: [{ name: "Fajr", time: "05:00" }, { name: "Sunrise", time: "06:00" }, { name: "Dhuhr", time: "12:00" }, { name: "Asr", time: "15:00" }, { name: "Maghrib", time: "18:00" }, { name: "Isha", time: "20:00" }, { name: "Tahajjud", time: "02:00" }],
    hijriDate: "1 Ramadan 1447 AH", hijriNumeric: "01/09/1447", hijriMonth: "09", maghrib: "18:00", locationName: "Test",
  };
  const settings: Settings = {
    coordinates: null, locationName: "Test", calculationMethod: 1, hijriOffset: 0, hijriRollover: "maghrib", calendarMonthStyle: "hijri", refreshMinutes: 30,
    statusTemplate: "{next}", use24HourTime: false, statusBarVisible: true, notificationsEnabled: true,
    eventNotifications: {}, notificationSound: false, notificationVolume: 0, notifiedTimeKeys: [],
    prayerReminderMinutes: 0, iqamaReminderMinutes: 0, countdownRedMinutes: 5, countdownNormalMinutes: 20,
    countdownRedColor: "#ff0000", countdownOrangeColor: "#ffa500", countdownNormalColor: "#ffffff",
    countdownNormalUsesTheme: true,
    iqama: {
      Fajr: { mode: "disabled" }, Sunrise: { mode: "offset", minutes: 20 }, Maghrib: { mode: "disabled" },
      Sunset: { mode: "offset", minutes: 5 }, Tahajjud: { mode: "offset", minutes: -5, from: "Fajr" },
      Isha: { mode: "fixed", time: "20:30" },
    },
    customTimes: [{ name: " Midnight ", time: "00:00" }, { name: "Bad", time: "24:00" }],
  };
  it("builds configured Iqama and custom events without a separate Sunset Iqama", () => {
    const events = buildConfiguredEvents(schedule, settings);
    assert.ok(events.some(event => event.name === "Last Third" && event.time === "02:00"));
    assert.ok(events.some(event => event.name === "Duha prayer" && event.time === "06:20"));
    assert.equal(events.some(event => event.name === "Sunset Iqama"), false);
    assert.ok(events.some(event => event.name === "Tahajjud Qiyam" && event.time === "04:55"));
    assert.ok(events.some(event => event.name === "Isha Iqama" && event.time === "20:30"));
    assert.ok(events.some(event => event.name === "Midnight" && event.time === "00:00"));
    assert.equal(events.some(event => event.name === "Bad"), false);
  });
});
describe("coordinate validation", () => {
  it("accepts New York coordinates and geographic extremes", () => {
    assert.equal(validCoordinates({ latitude: 40.7128, longitude: -74.006 }), true);
    assert.equal(validCoordinates({ latitude: 90, longitude: 180 }), true);
    assert.equal(validCoordinates({ latitude: -90, longitude: -180 }), true);
  });
  it("rejects missing, non-finite, and out-of-range coordinates", () => {
    assert.equal(validCoordinates({ latitude: Number.NaN, longitude: 0 }), false);
    assert.equal(validCoordinates({ latitude: 91, longitude: 0 }), false);
    assert.equal(validCoordinates({ latitude: 0, longitude: -181 }), false);
  });
});
