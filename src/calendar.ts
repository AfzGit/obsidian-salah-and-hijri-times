import { Modal, Setting, requestUrl } from "obsidian";
import type { App } from "obsidian";
import { formatTime } from "./time";
import type { Settings } from "./types";
import { calculateLastThird, fastingMarkers, mapCalendarDates } from "./calendar-data";
import type { CalendarApiDate, CalendarEntry } from "./calendar-data";

type CalendarMode = "hijri" | "gregorian";
type CalendarResponse = { code: number; data: CalendarApiDate[] };

const HIJRI_MONTHS = ["Muharram", "Safar", "Rabi 1", "Rabi 2", "Jumada 1", "Jumada 2", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];
const GREGORIAN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const responseCache = new Map<string, CalendarEntry[]>();

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
      const entries = await this.loadMonth(0);
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

  /** Load/cache a single API calendar month; cap the in-memory cache to 12 results. */
  private async loadMonth(adjustment = this.settings.hijriOffset): Promise<CalendarEntry[]> {
    if (!this.settings.coordinates) throw new Error("Set a location in plugin settings to view the calendar.");
    const endpoint = this.mode === "hijri" ? "hijriCalendar" : "calendar";
    const query = new URLSearchParams({
      latitude: String(this.settings.coordinates.latitude),
      longitude: String(this.settings.coordinates.longitude),
      method: String(this.settings.calculationMethod),
      adjustment: String(adjustment),
    });
    const key = `${endpoint}/${this.year}/${this.month}?${query}`;
    const cached = responseCache.get(key);
    if (cached) return cached;

    const response = await requestUrl({
      url: `https://api.aladhan.com/v1/${endpoint}/${this.year}/${this.month}?${query}`,
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (response.status < 200 || response.status >= 300) throw new Error(`Calendar service HTTP ${response.status}.`);
    const payload = response.json as CalendarResponse;
    if (payload.code !== 200 || !Array.isArray(payload.data)) throw new Error("The calendar service returned invalid data.");

    const entries = mapCalendarDates(payload.data);
    responseCache.set(key, entries);
    if (responseCache.size > 12) responseCache.delete(responseCache.keys().next().value as string);
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
        attr: { "aria-label": `${entry.api.date.gregorian.weekday.en}, ${entry.api.date.gregorian.date}; Hijri ${entry.api.date.hijri.date}` },
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

  /** Show the selected day prayer times with the same label colors as the schedule modal. */
  private renderDetails(entry: CalendarEntry, detail: HTMLElement) {
    detail.empty();
    detail.createEl("h3", { text: `${entry.api.date.gregorian.weekday.en}, ${entry.api.date.gregorian.date} · ${entry.hijriDay} ${HIJRI_MONTHS[entry.hijriMonth - 1]} ${entry.hijriYear}` });
    const rows = detail.createDiv({ cls: "salah-calendar-times" });
    for (const name of ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"]) {
      const time = entry.api.timings[name];
      if (!time) continue;
      const row = rows.createDiv({ cls: "salah-calendar-time-row" });
      row.createSpan({ cls: `salah-prayer-${name.toLowerCase()}`, text: name });
      row.createSpan({ text: displayTime(time, this.settings.use24HourTime) });
    }

    const maghrib = entry.api.timings.Maghrib;
    const fajr = entry.api.timings.Fajr;
    if (!maghrib || !fajr) return;
    const lastThird = calculateLastThird(maghrib, fajr);
    if (!lastThird) return;
    const row = rows.createDiv({ cls: "salah-calendar-time-row" });
    row.createSpan({ text: "Last Third" });
    row.createSpan({ text: displayTime(lastThird, this.settings.use24HourTime) });
  }
}
