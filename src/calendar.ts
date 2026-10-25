import { Modal, Setting, requestUrl } from "obsidian";
import type { App } from "obsidian";
import { formatTime } from "./time";
import { dateAtLocation, hijriAdjustmentForNow, minutesAtLocation, shiftGregorianDate } from "./hijri-date";
import type { Settings } from "./types";
import { calculateLastThird, fastingMarkers, mapCalendarDates } from "./calendar-data";
import type { CalendarApiDate, CalendarEntry } from "./calendar-data";

type CalendarMode = "hijri" | "gregorian";
type CalendarResponse = { code: number; data: CalendarApiDate[] };

const HIJRI_MONTHS = ["Muharram", "Safar", "Rabi 1", "Rabi 2", "Jumada 1", "Jumada 2", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];
const GREGORIAN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const responseCache = new Map<string, CalendarEntry[]>();

/** Compare API Gregorian dates by numeric components so padded/unpadded DD-MM-YYYY forms match. */
function sameCalendarDate(left: string, right: string): boolean {
  const parse = (value: string) => {
    const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(value);
    return match ? `${Number(match[3])}-${Number(match[2])}-${Number(match[1])}` : value;
  };
  return parse(left) === parse(right);
}

/** Format API time values consistently with the user's time-format preference. */
function displayTime(value: string, use24Hour: boolean): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return value;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (use24Hour) return formatTime(minutes);
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hour >= 12 ? "pm" : "am"}`;
}

/**
 * Calendar modal with both Hijri-month and Gregorian-month navigation.
 * Calendar dates and prayer calculations use the same saved location and method
 * as the daily schedule; the API supplies the authoritative Hijri month length.
 */
export class PrayerCalendarModal extends Modal {
  private mode: CalendarMode = "gregorian";
  private currentHijriYear = 0;
  private currentHijriMonth = 1;
  private year: number;
  private month: number;
  private loadSequence = 0;

  constructor(app: App, private readonly settings: Settings, currentHijriDate?: string) {
    super(app);
    const today = new Date();
    this.year = today.getFullYear();
    this.month = today.getMonth() + 1;
    this.mode = settings.calendarMonthStyle || "hijri";
    this.seedHijriMonth(currentHijriDate);
    if (this.mode === "gregorian") {
      this.year = today.getFullYear();
      this.month = today.getMonth() + 1;
    }
  }

  /** Open the calendar and only fetch a conversion when no daily schedule exists yet. */
  async onOpen() {
    this.modalEl.addClass("salah-calendar-modal");
    if (!this.currentHijriYear) await this.findCurrentHijriMonth();
    if (this.modalEl.isConnected) void this.render();
  }

  /** Seed the current Hijri month from the already loaded daily schedule. */
  private seedHijriMonth(numericDate?: string) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(numericDate || "");
    if (!match) return;
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (month < 1 || month > 12 || year < 1) return;
    this.currentHijriMonth = month;
    this.currentHijriYear = year;
    this.month = month;
    this.year = year;
  }

  /** Look up the current Hijri month only for an early command invocation. */
  private async findCurrentHijriMonth() {
    const requestedMode = this.mode;
    const today = new Date();
    this.mode = "gregorian";
    this.year = today.getFullYear();
    this.month = today.getMonth() + 1;
    try {
      const entries = await this.loadMonth();
      const todayEntry = entries.find(entry => this.isToday(entry.gregorian));
      if (todayEntry) {
        this.currentHijriYear = todayEntry.hijriYear;
        this.currentHijriMonth = todayEntry.hijriMonth;
      }
    } catch (error) {
      console.warn("Salah calendar could not determine the current Hijri month.", error);
    }
    // Restore the user's preferred initial view even if the lookup fails or omits today.
    this.mode = requestedMode;
    if (requestedMode === "hijri" && this.currentHijriYear) {
      this.year = this.currentHijriYear;
      this.month = this.currentHijriMonth;
    } else {
      this.year = today.getFullYear();
      this.month = today.getMonth() + 1;
    }
  }

  /** Change month style while returning the view to the current month in that style. */
  private async selectMode(value: string) {
    this.mode = value as CalendarMode;
    if (this.mode === "gregorian") {
      const today = new Date();
      this.year = today.getFullYear();
      this.month = today.getMonth() + 1;
    } else if (!this.currentHijriYear) {
      await this.findCurrentHijriMonth();
    } else {
      this.year = this.currentHijriYear;
      this.month = this.currentHijriMonth;
    }
    if (this.modalEl.isConnected) void this.render();
  }

  /** Rebuild the modal controls and draw the selected API month. */
  private async render() {
    const sequence = ++this.loadSequence;
    this.contentEl.empty();
    const controls = this.contentEl.createDiv({ cls: "salah-calendar-controls" });
    new Setting(controls).setName("Calendar month style").addDropdown(dropdown => dropdown
      .addOption("hijri", "Hijri months")
      .addOption("gregorian", "Gregorian months")
      .setValue(this.mode)
      .onChange(value => void this.selectMode(value)));

    const navigation = controls.createDiv({ cls: "salah-calendar-navigation" });
    const previous = navigation.createEl("button", { text: "‹", attr: { "aria-label": "Previous month" } });
    const title = navigation.createEl("strong", { text: "Loading calendar…" });
    const next = navigation.createEl("button", { text: "›", attr: { "aria-label": "Next month" } });
    previous.addEventListener("click", () => { this.shiftMonth(-1); void this.render(); });
    next.addEventListener("click", () => { this.shiftMonth(1); void this.render(); });

    const legend = this.contentEl.createDiv({ cls: "salah-calendar-legend" });
    legend.createSpan({ cls: "salah-calendar-legend-monthly", text: "13–15: monthly fast" });
    legend.createSpan({ cls: "salah-calendar-legend-weekly", text: "Mon / Thu: weekly fast" });
    legend.createSpan({ cls: "salah-calendar-legend-friday", text: "Friday: Jummah" });
    const grid = this.contentEl.createDiv({ cls: "salah-calendar-grid" });
    for (const day of WEEKDAYS) grid.createDiv({ cls: "salah-calendar-weekday", text: day });
    const detail = this.contentEl.createDiv({ cls: "salah-calendar-detail", text: "Select a day to view its prayer times." });

    try {
      const entries = await this.loadMonth();
      // Ignore a slow response after the user navigates to another month or closes the modal.
      if (sequence !== this.loadSequence || !this.contentEl.isConnected) return;
      if (!entries.length) throw new Error("No calendar dates were returned.");
      title.setText(this.monthTitle());
      this.renderDays(grid, entries, detail);
    } catch (error) {
      if (sequence !== this.loadSequence || !this.contentEl.isConnected) return;
      title.setText("Calendar unavailable");
      detail.setText(error instanceof Error ? error.message : "Unable to load this calendar month.");
      console.warn("Salah calendar could not be loaded.", error);
    }
  }

  /** Move one calendar month, wrapping the year as required. */
  private shiftMonth(amount: number) {
    if (this.mode === "gregorian") {
      const date = new Date(this.year, this.month - 1 + amount, 1);
      this.year = date.getFullYear();
      this.month = date.getMonth() + 1;
      return;
    }
    this.month += amount;
    if (this.month > 12) { this.month = 1; this.year++; }
    if (this.month < 1) { this.month = 12; this.year--; }
  }

  /** Provide a stable English month label in either supported calendar system. */
  private monthTitle(): string {
    if (this.mode === "hijri") return `${HIJRI_MONTHS[this.month - 1]} ${this.year} AH`;
    return `${GREGORIAN_MONTHS[this.month - 1]} ${this.year}`;
  }

  /** Resolve the current location-day and Maghrib rollover exactly like the daily schedule. */
  private async getCurrentRolloverContext(): Promise<{ locationDate: string; rollover: number }> {
    if (this.settings.hijriRollover !== "maghrib") return { locationDate: "", rollover: 0 };

    const now = new Date();
    const deviceDate = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
    const { latitude, longitude } = this.settings.coordinates || {};
    if (latitude === undefined || longitude === undefined) return { locationDate: deviceDate, rollover: 0 };

    const makeUrl = (date: string) => {
      const url = new URL(`https://api.aladhan.com/v1/timings/${date}`);
      url.searchParams.set("latitude", String(latitude));
      url.searchParams.set("longitude", String(longitude));
      url.searchParams.set("method", String(this.settings.calculationMethod));
      return url;
    };

    let payload: any;
    try {
      const response = await requestUrl({
        url: makeUrl(deviceDate).toString(),
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (response.status < 200 || response.status >= 300) return { locationDate: deviceDate, rollover: 0 };
      payload = response.json;
      if (payload?.code !== 200 || !payload?.data?.timings) return { locationDate: deviceDate, rollover: 0 };

      const timeZone = payload.data.meta?.timezone || payload.data.meta?.timezonestring;
      const locationDate = dateAtLocation(now, timeZone);
      if (locationDate !== deviceDate) {
        const refetch = await requestUrl({
          url: makeUrl(locationDate).toString(),
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (refetch.status < 200 || refetch.status >= 300) return { locationDate, rollover: 0 };
        payload = refetch.json;
        if (payload?.code !== 200 || !payload?.data?.timings) return { locationDate, rollover: 0 };
      }

      const maghrib = payload.data.timings.Maghrib;
      if (typeof maghrib !== "string") return { locationDate, rollover: 0 };
      const base = maghrib.match(/^(\d{1,2}):(\d{2})/);
      if (!base) return { locationDate, rollover: 0 };
      const baseMinutes = Number(base[1]) * 60 + Number(base[2]);
      const prayerOffset = this.settings.prayerTimeOffsets?.Maghrib || 0;
      const adjustedMaghrib = formatTime(baseMinutes + prayerOffset);
      const nowMinutes = minutesAtLocation(now, payload.data.meta?.timezone || payload.data.meta?.timezonestring || undefined);
      const rollover = hijriAdjustmentForNow(0, "maghrib", nowMinutes, adjustedMaghrib);
      return { locationDate, rollover };
    } catch {
      return { locationDate: deviceDate, rollover: 0 };
    }
  }

  /** Apply the configured Hijri offset plus today's location-time rollover. */
  private effectiveHijriOffset(
    baseOffset: number,
    date: Date,
    context: { locationDate: string; rollover: number },
    hijriTargetMode = false,
  ): number {
    if (!context.locationDate || !context.rollover) return baseOffset;
    const entryDate = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
    // In Hijri-month mode, targetEntry T normally appears at T - baseOffset.
    // After Maghrib the current day must instead show the next Hijri day, so the
    // target entry that should move onto today is the one whose normal displayed
    // date is tomorrow. This matters at Hijri month boundaries.
    const rolloverDate = hijriTargetMode
      ? shiftGregorianDate(context.locationDate, 1)
      : context.locationDate;
    return sameCalendarDate(entryDate, rolloverDate) ? baseOffset + context.rollover : baseOffset;
  }

  /** Load a month and apply the configured Hijri offset without relying on API adjustment. */
  private async loadMonth(): Promise<CalendarEntry[]> {
    if (!this.settings.coordinates) throw new Error("Set a location in plugin settings to view the calendar.");

    const offset = this.settings.hijriOffset || 0;
    const rolloverContext = await this.getCurrentRolloverContext();

    if (this.mode === "hijri") {
      // The selected month/year are a Hijri month. With an offset, the Gregorian
      // days that should display that month are the provider's target Hijri dates
      // shifted backward by the configured number of days.
      const targetEntries = await this.fetchCalendarMonth("hijriCalendar", this.year, this.month);
      if (!offset && !rolloverContext.rollover) return targetEntries;

      const shiftedMonths = new Map<string, CalendarEntry[]>();
      const shiftedDates = targetEntries.map(target => {
        const effectiveOffset = this.effectiveHijriOffset(offset, target.gregorian, rolloverContext, true);
        return {
          target,
          date: shiftGregorianDate(target.api.date.gregorian.date, -effectiveOffset),
        };
      });

      const needed = new Set<string>();
      for (const item of shiftedDates) {
        const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(item.date);
        if (match) needed.add(`${Number(match[3])}-${Number(match[2])}`);
      }
      for (const key of needed) {
        const [year, month] = key.split("-").map(Number);
        shiftedMonths.set(key, await this.fetchCalendarMonth("calendar", year, month));
      }

      return shiftedDates.map(({ target, date }) => {
        const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(date);
        if (!match) return target;
        const key = `${Number(match[3])}-${Number(match[2])}`;
        const shiftedEntry = shiftedMonths.get(key)?.find(candidate => sameCalendarDate(candidate.api.date.gregorian.date, date));
        if (!shiftedEntry) return target;

        // Keep the prayer times/Gregorian date of the actual displayed day while
        // assigning the target Hijri label for the selected month.
        return {
          ...shiftedEntry,
          hijriDay: target.hijriDay,
          hijriMonth: target.hijriMonth,
          hijriYear: target.hijriYear,
        };
      });
    }

    // Gregorian view: keep each day's prayer times, but resolve its Hijri label
    // from the Gregorian day after applying the configured offset.
    const baseEntries = await this.fetchCalendarMonth("calendar", this.year, this.month);
    if (!offset && !rolloverContext.rollover) return baseEntries;

    const shiftedMonths = new Map<string, CalendarEntry[]>();
    const needed = new Set<string>();
    for (const entry of baseEntries) {
      const effectiveOffset = this.effectiveHijriOffset(offset, entry.gregorian, rolloverContext);
      const shifted = shiftGregorianDate(entry.api.date.gregorian.date, effectiveOffset);
      const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(shifted);
      if (match) needed.add(`${Number(match[3])}-${Number(match[2])}`);
    }
    for (const key of needed) {
      const [year, month] = key.split("-").map(Number);
      shiftedMonths.set(key, await this.fetchCalendarMonth("calendar", year, month));
    }

    return baseEntries.map(entry => {
      const effectiveOffset = this.effectiveHijriOffset(offset, entry.gregorian, rolloverContext);
      const shifted = shiftGregorianDate(entry.api.date.gregorian.date, effectiveOffset);
      const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(shifted);
      if (!match) return entry;
      const key = `${Number(match[3])}-${Number(match[2])}`;
      const shiftedEntry = shiftedMonths.get(key)?.find(candidate => sameCalendarDate(candidate.api.date.gregorian.date, shifted));
      if (!shiftedEntry) return entry;
      return {
        ...entry,
        hijriDay: shiftedEntry.hijriDay,
        hijriMonth: shiftedEntry.hijriMonth,
        hijriYear: shiftedEntry.hijriYear,
      };
    });
  }

  /** Fetch/cache one provider calendar month with no Hijri adjustment. */
  private async fetchCalendarMonth(endpoint: string, year: number, month: number): Promise<CalendarEntry[]> {
    const query = new URLSearchParams({
      latitude: String(this.settings.coordinates?.latitude),
      longitude: String(this.settings.coordinates?.longitude),
      method: String(this.settings.calculationMethod),
      adjustment: "0",
    });
    const key = `${endpoint}/${year}/${month}?${query}`;
    const cached = responseCache.get(key);
    if (cached) return cached;

    const response = await requestUrl({
      url: `https://api.aladhan.com/v1/${endpoint}/${year}/${month}?${query}`,
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (response.status < 200 || response.status >= 300) throw new Error(`Calendar service HTTP ${response.status}.`);
    const payload = response.json as CalendarResponse;
    if (payload.code !== 200 || !Array.isArray(payload.data)) throw new Error("The calendar service returned invalid data.");

    const entries = mapCalendarDates(payload.data);
    responseCache.set(key, entries);
    if (responseCache.size > 24) responseCache.delete(responseCache.keys().next().value as string);
    return entries;
  }

  /** Draw a Monday-first grid with independent fast/Jummah markers. */
  private renderDays(grid: HTMLElement, entries: CalendarEntry[], detail: HTMLElement) {
    const firstDay = entries[0].gregorian.getDay();
    const mondayFirstOffset = (firstDay + 6) % 7;
    for (let index = 0; index < mondayFirstOffset; index++) grid.createDiv({ cls: "salah-calendar-empty" });

    for (const entry of entries) {
      const cell = grid.createEl("button", {
        cls: "salah-calendar-day",
        attr: { "aria-label": `${entry.api.date.gregorian.weekday.en}, ${entry.api.date.gregorian.date}; Hijri ${entry.hijriDay} ${HIJRI_MONTHS[entry.hijriMonth - 1]} ${entry.hijriYear}` },
      });
      cell.createSpan({ cls: "salah-calendar-gregorian", text: String(entry.gregorian.getDate()) });
      cell.createSpan({ cls: "salah-calendar-hijri", text: String(entry.hijriDay) });
      const markers = fastingMarkers(entry.gregorian, entry.hijriDay);
      if (markers.monthly) cell.addClass("salah-calendar-monthly-fast");
      if (markers.weekly) cell.addClass("salah-calendar-weekly-fast");
      if (markers.jummah) cell.addClass("salah-calendar-friday");
      if (this.isToday(entry.gregorian)) cell.addClass("salah-calendar-today");
      cell.addEventListener("click", () => {
        grid.querySelectorAll(".salah-calendar-day.is-selected").forEach(selected => selected.removeClass("is-selected"));
        cell.addClass("is-selected");
        this.renderDetails(entry, detail);
      });
    }
  }

  /** Compare local calendar components so device timezone changes do not shift today. */
  private isToday(date: Date): boolean {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  }

  /** Apply the same per-prayer offsets used by the daily schedule to calendar details. */
  private adjustedPrayerTime(name: string, value: string): string {
    const match = /^(\d{1,2}):(\d{2})(.*)$/.exec(value);
    if (!match) return value;
    const base = Number(match[1]) * 60 + Number(match[2]);
    if (!Number.isInteger(base) || base < 0 || base >= 1440) return value;
    const offset = this.settings.prayerTimeOffsets?.[name] || 0;
    return formatTime(base + offset) + match[3];
  }

  /** Show the selected day prayer times with the same label colors as the schedule modal. */
  private renderDetails(entry: CalendarEntry, detail: HTMLElement) {
    detail.empty();
    detail.createEl("h3", { text: `${entry.api.date.gregorian.weekday.en}, ${entry.api.date.gregorian.date} · ${entry.hijriDay} ${HIJRI_MONTHS[entry.hijriMonth - 1]} ${entry.hijriYear}` });
    const rows = detail.createDiv({ cls: "salah-calendar-times" });
    for (const name of ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"]) {
      const time = entry.api.timings[name];
      if (!time) continue;
      const adjusted = this.adjustedPrayerTime(name, time);
      const row = rows.createDiv({ cls: "salah-calendar-time-row" });
      row.createSpan({ cls: `salah-prayer-${name.toLowerCase()}`, text: name });
      row.createSpan({ text: displayTime(adjusted, this.settings.use24HourTime) });
    }

    const maghrib = entry.api.timings.Maghrib;
    const fajr = entry.api.timings.Fajr;
    if (!maghrib || !fajr) return;
    const lastThird = calculateLastThird(this.adjustedPrayerTime("Maghrib", maghrib), this.adjustedPrayerTime("Fajr", fajr));
    if (!lastThird) return;
    const row = rows.createDiv({ cls: "salah-calendar-time-row" });
    row.createSpan({ text: "Last Third" });
    row.createSpan({ text: displayTime(lastThird, this.settings.use24HourTime) });
  }
}
