var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => main_default
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = __toESM(require("obsidian"));

// src/calculation-methods.ts
var CALCULATION_METHODS = [
  { id: 0, label: "Shia Ithna-Ashari / Ja'fari \u2014 Fajr 16\xB0, Maghrib 4\xB0, Isha 14\xB0" },
  { id: 1, label: "University of Islamic Sciences, Karachi \u2014 Fajr 18\xB0, Isha 18\xB0" },
  { id: 2, label: "Islamic Society of North America (ISNA) \u2014 Fajr 15\xB0, Isha 15\xB0" },
  { id: 3, label: "Muslim World League \u2014 Fajr 18\xB0, Isha 17\xB0" },
  { id: 4, label: "Umm Al-Qura University, Makkah \u2014 Fajr 18.5\xB0, Isha 90 min after Maghrib" },
  { id: 5, label: "Egyptian General Authority of Survey \u2014 Fajr 19.5\xB0, Isha 17.5\xB0" },
  { id: 7, label: "University of Tehran \u2014 Fajr 17.7\xB0, Maghrib 4.5\xB0, Isha 14\xB0" },
  { id: 8, label: "Gulf Region \u2014 Fajr 19.5\xB0, Isha 90 min after Maghrib" },
  { id: 9, label: "Kuwait \u2014 Fajr 18\xB0, Isha 17.5\xB0" },
  { id: 10, label: "Qatar \u2014 Fajr 18\xB0, Isha 90 min after Maghrib" },
  { id: 11, label: "Singapore (MUIS) \u2014 Fajr 20\xB0, Isha 18\xB0" },
  { id: 12, label: "France (UOIF) \u2014 Fajr 12\xB0, Isha 12\xB0" },
  { id: 13, label: "Turkey (Diyanet) \u2014 Fajr 18\xB0, Isha 17\xB0" },
  { id: 14, label: "Russia \u2014 Fajr 16\xB0, Isha 15\xB0" },
  { id: 15, label: "Moonsighting Committee Worldwide \u2014 seasonal moonsighting method" },
  { id: 16, label: "Dubai \u2014 Fajr 18.2\xB0, Isha 18.2\xB0" },
  { id: 17, label: "Malaysia (JAKIM) \u2014 Fajr 20\xB0, Isha 18\xB0" },
  { id: 18, label: "Tunisia \u2014 Fajr 18\xB0, Isha 18\xB0" },
  { id: 19, label: "Algeria \u2014 Fajr 18\xB0, Isha 17\xB0" },
  { id: 20, label: "Indonesia (Kemenag) \u2014 Fajr 20\xB0, Isha 18\xB0" },
  { id: 21, label: "Morocco \u2014 Fajr 19\xB0, Isha 17\xB0" },
  { id: 22, label: "Lisbon, Portugal \u2014 Fajr 18\xB0, Maghrib 3 min after sunset, Isha 77 min after Maghrib" },
  { id: 23, label: "Jordan \u2014 Fajr 18\xB0, Maghrib 5 min after sunset, Isha 18\xB0" }
];

// src/calendar.ts
var import_obsidian = require("obsidian");

// src/time.ts
function parseTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}
function formatTime(totalMinutes) {
  const wrapped = (totalMinutes % 1440 + 1440) % 1440;
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function clock(value) {
  const totalMinutes = parseTime(value);
  if (totalMinutes === null) return value;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")}${hour >= 12 ? " pm" : " am"}`;
}
function nextEvent(events, now) {
  let nearest = null;
  for (const event of events) {
    const minutes = parseTime(event.time);
    if (minutes === null) continue;
    const eventDate = new Date(now);
    eventDate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    if (eventDate <= now) eventDate.setDate(eventDate.getDate() + 1);
    const delta = eventDate.getTime() - now.getTime();
    if (!nearest || delta < nearest.delta) nearest = { ...event, delta };
  }
  return nearest;
}
function countdown(milliseconds) {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 6e4));
  const hours = Math.floor(totalMinutes / 60);
  return hours ? `${hours}h ${String(totalMinutes % 60).padStart(2, "0")}m` : `${totalMinutes}m`;
}

// src/calendar-data.ts
function parseCalendarDate(value) {
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
function mapCalendarDates(dates) {
  return dates.map((api) => {
    const hijriDay = Number(api.date.hijri.day);
    const hijriMonth = api.date.hijri.month.number;
    const hijriYear = Number(api.date.hijri.year);
    if (!Number.isInteger(hijriDay) || hijriDay < 1 || hijriDay > 30 || !Number.isInteger(hijriMonth) || hijriMonth < 1 || hijriMonth > 12 || !Number.isInteger(hijriYear)) {
      throw new Error("Calendar service returned an invalid Hijri date.");
    }
    return { api, gregorian: parseCalendarDate(api.date.gregorian.date), hijriDay, hijriMonth, hijriYear };
  }).sort((left, right) => left.gregorian.getTime() - right.gregorian.getTime());
}
function fastingMarkers(date, hijriDay) {
  const weekday = date.getDay();
  return {
    monthly: hijriDay >= 13 && hijriDay <= 15,
    weekly: weekday === 1 || weekday === 4,
    jummah: weekday === 5
  };
}
function calculateLastThird(maghrib, fajr) {
  const minutes = (value) => {
    const match = /^(\d{1,2}):(\d{2})(?:\s|$)/.exec(value);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return hour < 24 && minute < 60 ? hour * 60 + minute : null;
  };
  const evening = minutes(maghrib);
  const morning = minutes(fajr);
  if (evening === null || morning === null) return null;
  const nextMorning = morning + (morning <= evening ? 1440 : 0);
  return formatClock(Math.floor(evening + (nextMorning - evening) * 2 / 3));
}
function formatClock(totalMinutes) {
  const wrapped = (totalMinutes % 1440 + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

// src/calendar.ts
var HIJRI_MONTHS = ["Muharram", "Safar", "Rabi 1", "Rabi 2", "Jumada 1", "Jumada 2", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];
var GREGORIAN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
var WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
var responseCache = /* @__PURE__ */ new Map();
function displayTime(value, use24Hour) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return value;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (use24Hour) return formatTime(minutes);
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hour >= 12 ? "pm" : "am"}`;
}
var PrayerCalendarModal = class extends import_obsidian.Modal {
  constructor(app, settings, currentHijriDate) {
    super(app);
    this.settings = settings;
    this.mode = "gregorian";
    this.currentHijriYear = 0;
    this.currentHijriMonth = 1;
    this.loadSequence = 0;
    const today = /* @__PURE__ */ new Date();
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
  seedHijriMonth(numericDate) {
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
  async findCurrentHijriMonth() {
    const requestedMode = this.mode;
    const today = /* @__PURE__ */ new Date();
    this.mode = "gregorian";
    this.year = today.getFullYear();
    this.month = today.getMonth() + 1;
    try {
      const entries = await this.loadMonth(0);
      const todayEntry = entries.find((entry) => this.isToday(entry.gregorian));
      if (todayEntry) {
        this.currentHijriYear = todayEntry.hijriYear;
        this.currentHijriMonth = todayEntry.hijriMonth;
      }
    } catch (error) {
      console.warn("Salah calendar could not determine the current Hijri month.", error);
    }
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
  async selectMode(value) {
    this.mode = value;
    if (this.mode === "gregorian") {
      const today = /* @__PURE__ */ new Date();
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
  async render() {
    const sequence = ++this.loadSequence;
    this.contentEl.empty();
    const controls = this.contentEl.createDiv({ cls: "salah-calendar-controls" });
    new import_obsidian.Setting(controls).setName("Calendar month style").addDropdown((dropdown) => dropdown.addOption("hijri", "Hijri months").addOption("gregorian", "Gregorian months").setValue(this.mode).onChange((value) => void this.selectMode(value)));
    const navigation = controls.createDiv({ cls: "salah-calendar-navigation" });
    const previous = navigation.createEl("button", { text: "\u2039", attr: { "aria-label": "Previous month" } });
    const title = navigation.createEl("strong", { text: "Loading calendar\u2026" });
    const next = navigation.createEl("button", { text: "\u203A", attr: { "aria-label": "Next month" } });
    previous.addEventListener("click", () => {
      this.shiftMonth(-1);
      void this.render();
    });
    next.addEventListener("click", () => {
      this.shiftMonth(1);
      void this.render();
    });
    const legend = this.contentEl.createDiv({ cls: "salah-calendar-legend" });
    legend.createSpan({ cls: "salah-calendar-legend-monthly", text: "13\u201315: monthly fast" });
    legend.createSpan({ cls: "salah-calendar-legend-weekly", text: "Mon / Thu: weekly fast" });
    legend.createSpan({ cls: "salah-calendar-legend-friday", text: "Friday: Jummah" });
    const grid = this.contentEl.createDiv({ cls: "salah-calendar-grid" });
    for (const day of WEEKDAYS) grid.createDiv({ cls: "salah-calendar-weekday", text: day });
    const detail = this.contentEl.createDiv({ cls: "salah-calendar-detail", text: "Select a day to view its prayer times." });
    try {
      const entries = await this.loadMonth();
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
  shiftMonth(amount) {
    if (this.mode === "gregorian") {
      const date = new Date(this.year, this.month - 1 + amount, 1);
      this.year = date.getFullYear();
      this.month = date.getMonth() + 1;
      return;
    }
    this.month += amount;
    if (this.month > 12) {
      this.month = 1;
      this.year++;
    }
    if (this.month < 1) {
      this.month = 12;
      this.year--;
    }
  }
  /** Provide a stable English month label in either supported calendar system. */
  monthTitle() {
    if (this.mode === "hijri") return `${HIJRI_MONTHS[this.month - 1]} ${this.year} AH`;
    return `${GREGORIAN_MONTHS[this.month - 1]} ${this.year}`;
  }
  /** Load/cache a single API calendar month; cap the in-memory cache to 12 results. */
  async loadMonth(adjustment = this.settings.hijriOffset) {
    if (!this.settings.coordinates) throw new Error("Set a location in plugin settings to view the calendar.");
    const endpoint = this.mode === "hijri" ? "hijriCalendar" : "calendar";
    const query = new URLSearchParams({
      latitude: String(this.settings.coordinates.latitude),
      longitude: String(this.settings.coordinates.longitude),
      method: String(this.settings.calculationMethod),
      adjustment: String(adjustment)
    });
    const key = `${endpoint}/${this.year}/${this.month}?${query}`;
    const cached = responseCache.get(key);
    if (cached) return cached;
    const response = await (0, import_obsidian.requestUrl)({
      url: `https://api.aladhan.com/v1/${endpoint}/${this.year}/${this.month}?${query}`,
      method: "GET",
      headers: { Accept: "application/json" }
    });
    if (response.status < 200 || response.status >= 300) throw new Error(`Calendar service HTTP ${response.status}.`);
    const payload = response.json;
    if (payload.code !== 200 || !Array.isArray(payload.data)) throw new Error("The calendar service returned invalid data.");
    const entries = mapCalendarDates(payload.data);
    responseCache.set(key, entries);
    if (responseCache.size > 12) responseCache.delete(responseCache.keys().next().value);
    return entries;
  }
  /** Draw a Monday-first grid with independent fast/Jummah markers. */
  renderDays(grid, entries, detail) {
    const firstDay = entries[0].gregorian.getDay();
    const mondayFirstOffset = (firstDay + 6) % 7;
    for (let index = 0; index < mondayFirstOffset; index++) grid.createDiv({ cls: "salah-calendar-empty" });
    for (const entry of entries) {
      const cell = grid.createEl("button", {
        cls: "salah-calendar-day",
        attr: { "aria-label": `${entry.api.date.gregorian.weekday.en}, ${entry.api.date.gregorian.date}; Hijri ${entry.api.date.hijri.date}` }
      });
      cell.createSpan({ cls: "salah-calendar-gregorian", text: String(entry.gregorian.getDate()) });
      cell.createSpan({ cls: "salah-calendar-hijri", text: String(entry.hijriDay) });
      const markers = fastingMarkers(entry.gregorian, entry.hijriDay);
      if (markers.monthly) cell.addClass("salah-calendar-monthly-fast");
      if (markers.weekly) cell.addClass("salah-calendar-weekly-fast");
      if (markers.jummah) cell.addClass("salah-calendar-friday");
      if (this.isToday(entry.gregorian)) cell.addClass("salah-calendar-today");
      cell.addEventListener("click", () => {
        grid.querySelectorAll(".salah-calendar-day.is-selected").forEach((selected) => selected.removeClass("is-selected"));
        cell.addClass("is-selected");
        this.renderDetails(entry, detail);
      });
    }
  }
  /** Compare local calendar components so device timezone changes do not shift today. */
  isToday(date) {
    const today = /* @__PURE__ */ new Date();
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  }
  /** Show the selected day prayer times with the same label colors as the schedule modal. */
  renderDetails(entry, detail) {
    detail.empty();
    detail.createEl("h3", { text: `${entry.api.date.gregorian.weekday.en}, ${entry.api.date.gregorian.date} \xB7 ${entry.hijriDay} ${HIJRI_MONTHS[entry.hijriMonth - 1]} ${entry.hijriYear}` });
    const rows = detail.createDiv({ cls: "salah-calendar-times" });
    for (const name of ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"]) {
      const time = entry.api.timings[name];
      if (!time) continue;
      const row2 = rows.createDiv({ cls: "salah-calendar-time-row" });
      row2.createSpan({ cls: `salah-prayer-${name.toLowerCase()}`, text: name });
      row2.createSpan({ text: displayTime(time, this.settings.use24HourTime) });
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
};

// src/location.ts
var import_obsidian2 = require("obsidian");

// src/coordinates.ts
function validCoordinates2(coordinates) {
  return Number.isFinite(coordinates.latitude) && coordinates.latitude >= -90 && coordinates.latitude <= 90 && Number.isFinite(coordinates.longitude) && coordinates.longitude >= -180 && coordinates.longitude <= 180;
}

// src/location.ts
function asLocation(data) {
  var _a, _b;
  const coordinates = { latitude: (_a = data.latitude) != null ? _a : NaN, longitude: (_b = data.longitude) != null ? _b : NaN };
  if (!validCoordinates2(coordinates)) throw new Error("The provider returned invalid coordinates.");
  const place = data;
  const name = [place.city, place.region, place.country || place.country_name].filter(Boolean).join(", ");
  return { coordinates, name: name || "Approximate IP location" };
}
async function detectLocation(announceSuccess = true) {
  const providers = [
    async () => {
      const response = await (0, import_obsidian2.requestUrl)({ url: "https://ipwho.is/", method: "GET" });
      const data = response.json;
      if (data.success === false) throw new Error("IPWho could not locate this network.");
      return asLocation(data);
    },
    async () => {
      const response = await (0, import_obsidian2.requestUrl)({ url: "https://ipapi.co/json/", method: "GET" });
      const data = response.json;
      if (data.error) throw new Error("ipapi could not locate this network.");
      return asLocation(data);
    }
  ];
  for (const provider of providers) {
    try {
      const result = await provider();
      if (announceSuccess) new import_obsidian2.Notice("Approximate location detected: " + result.name + ". Review it in settings.", 1e4);
      return result;
    } catch (error) {
      console.warn("Salah & Hijri Times IP location provider failed.", error);
    }
  }
  new import_obsidian2.Notice("Automatic location detection failed. Enter latitude and longitude in plugin settings.", 1e4);
  throw new Error("No IP location provider returned valid coordinates.");
}

// src/location-picker.ts
var import_obsidian3 = require("obsidian");
var LocationSearchModal = class extends import_obsidian3.SuggestModal {
  constructor(app, onChoose) {
    super(app);
    this.onChoose = onChoose;
    this.searchVersion = 0;
    this.setPlaceholder("Search for a city, town, or postal code");
    this.emptyStateText = "Type at least two characters to search.";
  }
  /** Debounce the remote search, then validate its results before displaying them. */
  async getSuggestions(query) {
    const term = query.trim();
    const version = ++this.searchVersion;
    if (term.length < 2) return [];
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    if (version !== this.searchVersion) return [];
    const params = new URLSearchParams({ name: term, count: "12", language: "en", format: "json" });
    try {
      const response = await (0, import_obsidian3.requestUrl)({
        url: "https://geocoding-api.open-meteo.com/v1/search?" + params.toString(),
        method: "GET"
      });
      if (version !== this.searchVersion) return [];
      const result = response.json;
      return (result.results || []).filter(
        (place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
      );
    } catch (error) {
      console.warn("Location search failed.", error);
      return [];
    }
  }
  renderSuggestion(place, element) {
    element.createEl("div", { text: place.name });
    const context = [place.admin1, place.country].filter(Boolean).join(", ");
    if (context) element.createEl("small", { text: context });
  }
  onChooseSuggestion(place) {
    this.onChoose(place);
  }
};

// src/prayer-times.ts
var import_obsidian4 = require("obsidian");

// src/hijri-date.ts
function hijriAdjustmentForNow(configuredOffset, rollover, currentMinutes, maghribTime) {
  if (rollover !== "maghrib") return configuredOffset;
  const match = /^(\d{1,2}):(\d{2})/.exec(maghribTime);
  if (!match) return configuredOffset;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return configuredOffset;
  const maghribMinutes = hour * 60 + minute;
  return currentMinutes >= maghribMinutes ? configuredOffset + 1 : configuredOffset;
}
function minutesAtLocation(date, timeZone) {
  var _a, _b;
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
      const hour = Number((_a = parts.find((part) => part.type === "hour")) == null ? void 0 : _a.value);
      const minute = Number((_b = parts.find((part) => part.type === "minute")) == null ? void 0 : _b.value);
      if (Number.isInteger(hour) && hour >= 0 && hour < 24 && Number.isInteger(minute) && minute >= 0 && minute < 60) return hour * 60 + minute;
    } catch (e) {
    }
  }
  return date.getHours() * 60 + date.getMinutes();
}
function dateAtLocation(date, timeZone) {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(date);
      const get = (type) => {
        var _a;
        return (_a = parts.find((part) => part.type === type)) == null ? void 0 : _a.value;
      };
      const day = get("day");
      const month = get("month");
      const year = get("year");
      if (day && month && year) return `${Number(day)}-${Number(month)}-${year}`;
    } catch (e) {
    }
  }
  return `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
}
function shiftGregorianDate(value, offset) {
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

// src/schedule-events.ts
function buildConfiguredEvents(schedule, settings) {
  var _a;
  const events = schedule.prayers.map((prayer) => ({
    ...prayer,
    name: prayer.name === "Tahajjud" ? "Last Third" : prayer.name,
    kind: "prayer"
  }));
  for (const [name, rule] of Object.entries(settings.iqama)) {
    if (rule.mode === "disabled") continue;
    const baseName = rule.mode === "offset" && name === "Tahajjud" && rule.from === "Fajr" ? "Fajr" : name === "Sunset" ? "Maghrib" : name;
    const base = schedule.prayers.find((prayer) => prayer.name === baseName);
    const time = rule.mode === "fixed" ? rule.time : rule.mode === "offset" && base ? formatTime(((_a = parseTime(base.time)) != null ? _a : 0) + rule.minutes) : "";
    if (time) events.push({ name: name === "Sunrise" ? "Duha prayer" : name === "Tahajjud" ? "Tahajjud Qiyam" : `${name} Iqama`, time, kind: "iqama" });
  }
  for (const custom of settings.customTimes || []) {
    if (custom.name.trim() && parseTime(custom.time) !== null) events.push({ name: custom.name.trim(), time: custom.time, kind: "custom" });
  }
  return events;
}

// src/prayer-times.ts
var HIJRI_MONTHS2 = ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];
async function requestSchedule(url) {
  const response = await (0, import_obsidian4.requestUrl)({ url: url.toString(), method: "GET", headers: { Accept: "application/json" } });
  if (response.status < 200 || response.status >= 300) throw new Error(`Prayer service HTTP ${response.status}.`);
  const payload = response.json;
  if (payload.code !== 200) throw new Error("No prayer timings returned.");
  return payload;
}
async function loadSchedule(settings, now = /* @__PURE__ */ new Date()) {
  var _a, _b, _c, _d;
  if (!settings.coordinates) throw new Error("Set location in plugin settings.");
  const { latitude, longitude } = settings.coordinates;
  const date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
  let url = new URL(`https://api.aladhan.com/v1/timings/${date}`);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("method", String(settings.calculationMethod));
  let payload = await requestSchedule(url);
  const timeZone = ((_a = payload.data.meta) == null ? void 0 : _a.timezone) || ((_b = payload.data.meta) == null ? void 0 : _b.timezonestring);
  const locationDate = dateAtLocation(now, timeZone);
  if (locationDate !== date) {
    url = new URL(`https://api.aladhan.com/v1/timings/${locationDate}`);
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("method", String(settings.calculationMethod));
    payload = await requestSchedule(url);
  }
  const timings = payload.data.timings;
  const nowMinutes = minutesAtLocation(now, ((_c = payload.data.meta) == null ? void 0 : _c.timezone) || ((_d = payload.data.meta) == null ? void 0 : _d.timezonestring));
  const hijriDayOffset = hijriAdjustmentForNow(settings.hijriOffset, settings.hijriRollover, nowMinutes, timings.Maghrib);
  let hijri = payload.data.date.hijri;
  if (hijriDayOffset !== 0) {
    const hijriDate = shiftGregorianDate(locationDate, hijriDayOffset);
    const hijriUrl = new URL(`https://api.aladhan.com/v1/timings/${hijriDate}`);
    hijriUrl.searchParams.set("latitude", String(latitude));
    hijriUrl.searchParams.set("longitude", String(longitude));
    hijriUrl.searchParams.set("method", String(settings.calculationMethod));
    hijri = (await requestSchedule(hijriUrl)).data.date.hijri;
  }
  const prayers = {
    Fajr: timings.Fajr,
    Sunrise: timings.Sunrise,
    Dhuhr: timings.Dhuhr,
    Asr: timings.Asr,
    Maghrib: timings.Maghrib,
    Isha: timings.Isha
  };
  const maghrib = parseTime(timings.Maghrib);
  const fajr = parseTime(timings.Fajr);
  if (maghrib !== null && fajr !== null) {
    prayers.Tahajjud = formatTime(Math.floor(maghrib + (fajr + 1440 - maghrib) * 2 / 3));
  }
  const day = Number(hijri.day);
  const month = hijri.month.number;
  const year = Number(hijri.year);
  return {
    prayers: Object.entries(prayers).map(([name, time]) => ({ name, time })),
    hijriDate: `${day} ${HIJRI_MONTHS2[month - 1]} ${year} AH`,
    hijriNumeric: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
    hijriMonth: String(month).padStart(2, "0"),
    maghrib: timings.Maghrib,
    locationName: settings.locationName
  };
}

// src/status-template.ts
var TOKEN = /\{([a-z]+(?::[a-z/]+)?)\}/gi;
function renderStatusTemplate(container, template, next, schedule, countdownColor, use24Hour = false) {
  const values = {
    next: next.name,
    time: use24Hour && parseTime(next.time) !== null ? formatTime(parseTime(next.time)) : clock(next.time),
    countdown: countdown(next.delta),
    hijri: schedule.hijriNumeric,
    "hijri:dd/mm/yyyy": schedule.hijriNumeric,
    "hijri:month": schedule.hijriMonth,
    "hijri:long": schedule.hijriDate,
    location: schedule.locationName
  };
  const fragment = document.createDocumentFragment();
  let offset = 0;
  TOKEN.lastIndex = 0;
  let match;
  while ((match = TOKEN.exec(template)) !== null) {
    const index = match.index;
    fragment.append(document.createTextNode(template.slice(offset, index)));
    const key = match[1].toLowerCase();
    const value = values[key];
    if (value === void 0) {
      fragment.append(document.createTextNode(match[0]));
    } else if (key === "countdown") {
      const countdownNode = document.createElement("span");
      countdownNode.className = "salah-hijri-countdown";
      countdownNode.textContent = value;
      countdownNode.style.setProperty("--salah-countdown-color", countdownColor);
      fragment.append(countdownNode);
    } else {
      fragment.append(document.createTextNode(value));
    }
    offset = index + match[0].length;
  }
  fragment.append(document.createTextNode(template.slice(offset)));
  container.replaceChildren(fragment);
}

// main.ts
var DEFAULTS = {
  coordinates: null,
  locationName: "",
  calculationMethod: 1,
  hijriOffset: 0,
  hijriRollover: "maghrib",
  calendarMonthStyle: "hijri",
  refreshMinutes: 30,
  statusTemplate: "{next}: {time} ({countdown}) \xB7 {hijri}",
  use24HourTime: false,
  statusBarVisible: true,
  notificationsEnabled: true,
  eventNotifications: {},
  notificationSound: false,
  notificationVolume: 35,
  notifiedTimeKeys: [],
  prayerReminderMinutes: 0,
  iqamaReminderMinutes: 0,
  countdownRedMinutes: 5,
  countdownNormalMinutes: 20,
  countdownRedColor: "#dc5082",
  countdownOrangeColor: "#ffa500",
  countdownNormalColor: "#cdd6f4",
  countdownNormalUsesTheme: true,
  customTimes: [],
  iqama: {
    Fajr: { mode: "disabled" },
    Sunrise: { mode: "offset", minutes: 20 },
    Dhuhr: { mode: "disabled" },
    Asr: { mode: "disabled" },
    Maghrib: { mode: "offset", minutes: 5 },
    Sunset: { mode: "disabled" },
    Isha: { mode: "disabled" },
    Tahajjud: { mode: "disabled" }
  }
};
function prayerDisplayName(prayer) {
  return prayer === "Tahajjud" ? "Last Third" : prayer;
}
function iqamaEventName(prayer) {
  return prayer === "Sunrise" ? "Duha prayer" : prayer === "Tahajjud" ? "Tahajjud Qiyam" : prayer + " Iqama";
}
function addIqamaRuleOptions(dropdown, prayer) {
  dropdown.addOption("disabled", "Disabled").addOption("fixed", "Fixed time");
  if (prayer === "Tahajjud") {
    dropdown.addOption("offset-last-third", "Offset from Last Third").addOption("offset-fajr", "Offset from Fajr");
  } else {
    const base = prayer === "Sunset" ? "Maghrib" : prayerDisplayName(prayer);
    dropdown.addOption("offset", "Offset from " + base);
  }
  return dropdown;
}
function iqamaRuleSelection(prayer, rule) {
  if (rule.mode !== "offset") return rule.mode;
  if (prayer === "Tahajjud") return rule.from === "Fajr" ? "offset-fajr" : "offset-last-third";
  return "offset";
}
function iqamaRuleForSelection(prayer, selection, current) {
  if (selection === "fixed") return { mode: "fixed", time: "05:00" };
  if (selection === "offset-fajr") return { mode: "offset", minutes: current.mode === "offset" ? current.minutes : 0, from: "Fajr" };
  if (selection === "offset-last-third") return { mode: "offset", minutes: current.mode === "offset" ? current.minutes : 0, from: "Tahajjud" };
  if (selection === "offset") return { mode: "offset", minutes: current.mode === "offset" ? current.minutes : 0 };
  return { mode: "disabled" };
}
function displayClock(time, use24Hour) {
  const minutes = parseTime(time);
  return use24Hour && minutes !== null ? formatTime(minutes) : clock(time);
}
function scheduleLines(schedule, events, use24Hour) {
  const rows = schedule.prayers.map((prayer) => {
    const iqama = events.find((event) => event.kind === "iqama" && event.name === iqamaEventName(prayer.name)) || (prayer.name === "Maghrib" ? events.find((event) => event.kind === "iqama" && event.name === iqamaEventName("Sunset")) : void 0);
    return prayerDisplayName(prayer.name) + ": " + displayClock(prayer.time, use24Hour) + " [" + (iqama ? displayClock(iqama.time, use24Hour) : "\u2014") + "]";
  });
  rows.push(...events.filter((event) => event.kind === "custom").map((event) => event.name + ": " + displayClock(event.time, use24Hour)));
  rows.push("", "Hijri: " + schedule.hijriDate, "Location: " + schedule.locationName);
  return rows;
}
var SalahPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULTS;
    this.schedule = null;
    this.minuteTimer = 0;
    this.refreshTimer = 0;
    this.scheduleRefreshSequence = 0;
    this.loadingLocation = false;
    this.notificationAudioContext = null;
  }
  /** Register commands and UI, then defer the first network work until layout is ready. */
  async onload() {
    const saved = await this.loadData() || {};
    this.settings = { ...DEFAULTS, ...saved };
    this.settings.iqama = { ...DEFAULTS.iqama, ...this.settings.iqama };
    this.settings.customTimes = this.settings.customTimes || [];
    this.settings.notifiedTimeKeys = this.settings.notifiedTimeKeys || [];
    this.settings.eventNotifications = this.settings.eventNotifications || {};
    this.statusBar = this.addStatusBarItem();
    this.statusBar.addClass("salah-hijri-status");
    this.statusBar.onClickEvent(() => this.openSchedule());
    this.applyStatusBarVisibility();
    this.addSettingTab(new SalahSettingsTab(this.app, this));
    this.addCommand({ id: "set-manual-location", name: "Set manual location", callback: () => this.openLocationPicker() });
    this.addCommand({ id: "refresh-all-times", name: "Refresh all prayer and Hijri times now", callback: () => void this.refreshNow() });
    this.addCommand({ id: "set-hijri-offset", name: "Set Hijri offset", callback: () => this.openHijriOffsetEditor() });
    this.addCommand({ id: "edit-iqama-times", name: "Update Iqama times", callback: () => this.openIqamaEditor() });
    this.addCommand({ id: "display-prayer-times", name: "Display prayer times", callback: () => this.openSchedule() });
    this.addCommand({ id: "open-prayer-calendar", name: "Open prayer calendar", callback: () => {
      var _a;
      return new PrayerCalendarModal(this.app, this.settings, (_a = this.schedule) == null ? void 0 : _a.hijriNumeric).open();
    } });
    this.addCommand({ id: "toggle-status-bar-visibility", name: "Toggle status bar visibility", callback: () => {
      this.settings.statusBarVisible = !this.settings.statusBarVisible;
      this.applyStatusBarVisibility();
      void this.persistSettings();
      new import_obsidian5.Notice(this.settings.statusBarVisible ? "Status bar item shown." : "Status bar item hidden.");
    } });
    this.app.workspace.onLayoutReady(() => void this.initialize());
  }
  /** Release timers and audio state when the plugin is disabled or reloaded. */
  onunload() {
    window.clearTimeout(this.minuteTimer);
    window.clearInterval(this.refreshTimer);
    if (this.notificationAudioContext) void this.notificationAudioContext.close();
  }
  /** Detect location only when none is saved; otherwise refresh the existing location. */
  async initialize() {
    if (!this.settings.coordinates) {
      await this.detectAgain();
      return;
    }
    await this.refreshSchedule();
  }
  async detectAgain(announceSuccess = true) {
    if (this.loadingLocation) return;
    this.loadingLocation = true;
    try {
      const result = await detectLocation(announceSuccess);
      this.settings.coordinates = result.coordinates;
      this.settings.locationName = result.name;
      await this.saveData(this.settings);
      await this.refreshSchedule();
    } catch (error) {
      console.warn("Salah & Hijri Times location lookup failed.", error);
    } finally {
      this.loadingLocation = false;
    }
  }
  openLocationPicker(onSelected) {
    new LocationSearchModal(this.app, (place) => {
      const name = [place.name, place.admin1, place.country].filter(Boolean).join(", ");
      void this.setLocation({ latitude: place.latitude, longitude: place.longitude }, name).then(() => onSelected == null ? void 0 : onSelected());
    }).open();
  }
  openHijriOffsetEditor() {
    new HijriOffsetModal(this.app, this.settings.hijriOffset, (offset) => {
      this.settings.hijriOffset = offset;
      void this.saveAndRefresh().then(() => new import_obsidian5.Notice("Hijri offset updated.", 1e4));
    }).open();
  }
  openIqamaEditor() {
    new IqamaEditorModal(this.app, this.settings.iqama, (updated) => {
      this.settings.iqama = updated;
      void this.persistSettings().then(() => new import_obsidian5.Notice("Iqama times updated.", 1e4));
    }).open();
  }
  async refreshNow() {
    if (!this.settings.coordinates) {
      new import_obsidian5.Notice("Choose or enter a location before refreshing prayer times.", 1e4);
      return;
    }
    if (await this.refreshSchedule()) new import_obsidian5.Notice("Prayer and Hijri times refreshed.", 1e4);
  }
  async setLocation(coordinates, name) {
    if (!validCoordinates(coordinates)) {
      new import_obsidian5.Notice("Coordinates must be latitude \u221290 to 90 and longitude \u2212180 to 180.", 1e4);
      return;
    }
    this.settings.coordinates = coordinates;
    this.settings.locationName = name || "Manual location";
    await this.saveData(this.settings);
    await this.refreshSchedule();
    new import_obsidian5.Notice("Location saved.", 1e4);
  }
  applyStatusBarVisibility() {
    if (this.statusBar) this.statusBar.toggleClass("salah-status-hidden", !this.settings.statusBarVisible);
  }
  async persistSettings() {
    await this.saveData(this.settings);
    this.applyStatusBarVisibility();
    this.renderStatus();
  }
  async saveAndRefresh() {
    await this.saveData(this.settings);
    await this.refreshSchedule();
  }
  /** Fetch the current schedule and re-arm the independent slower refresh timer. */
  async refreshSchedule() {
    if (!this.settings.coordinates) return false;
    const sequence = ++this.scheduleRefreshSequence;
    const settings = { ...this.settings, coordinates: { ...this.settings.coordinates } };
    try {
      const schedule = await loadSchedule(settings);
      if (sequence !== this.scheduleRefreshSequence) return false;
      this.schedule = schedule;
      this.tick();
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = window.setInterval(
        () => void this.refreshSchedule(),
        Math.max(5, this.settings.refreshMinutes) * 6e4
      );
      return true;
    } catch (error) {
      if (sequence !== this.scheduleRefreshSequence) return false;
      new import_obsidian5.Notice("Couldn't refresh prayer times: " + (error instanceof Error ? error.message : "unknown error"), 1e4);
      this.renderStatus();
      return false;
    }
  }
  /** Align countdown updates to minute boundaries and check due notifications. */
  tick() {
    this.renderStatus();
    this.checkNotifications();
    window.clearTimeout(this.minuteTimer);
    this.minuteTimer = window.setTimeout(() => this.tick(), 6e4 - Date.now() % 6e4 + 50);
  }
  /** Deduplicate reached-time and advance notices across repeated ticks and reloads. */
  checkNotifications() {
    if (!this.schedule || !this.settings.notificationsEnabled) return;
    const now = /* @__PURE__ */ new Date();
    const nowMinute = now.getHours() * 60 + now.getMinutes();
    const events = buildConfiguredEvents(this.schedule, this.settings);
    const seen = new Set(this.settings.notifiedTimeKeys || []);
    const messages = [];
    const remember = (key, message) => {
      if (seen.has(key)) return;
      seen.add(key);
      messages.push(message);
    };
    for (const event of events) {
      const eventMinute = parseTime(event.time);
      if (eventMinute === null) continue;
      const isIqama = event.kind === "iqama";
      const rule = this.settings.eventNotifications[eventNotificationKey(event)] || { reached: true, advance: true };
      const lead = isIqama ? this.settings.iqamaReminderMinutes : this.settings.prayerReminderMinutes;
      const target = new Date(now);
      target.setHours(Math.floor(eventMinute / 60), eventMinute % 60, 0, 0);
      if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
      const eventDate = this.dateKey(target);
      if (rule.reached && eventMinute === nowMinute) {
        remember(
          this.dateKey(now) + "|reached|" + event.kind + "|" + event.name + "|" + event.time,
          event.name + " time reached (" + clock(event.time) + ")"
        );
      }
      if (rule.advance && lead > 0 && Math.ceil((target.getTime() - now.getTime()) / 6e4) === lead) {
        remember(
          eventDate + "|before-" + lead + "|" + event.kind + "|" + event.name + "|" + event.time,
          lead + " minute" + (lead === 1 ? "" : "s") + " until " + event.name + " (" + clock(event.time) + ")"
        );
      }
    }
    if (messages.length === 0) return;
    this.settings.notifiedTimeKeys = [...seen].slice(-200);
    void this.saveData(this.settings).catch((error) => console.error("Couldn't save notification history.", error));
    new import_obsidian5.Notice(messages.join("\n"), 1e4);
    if (this.settings.notificationSound) this.playNotificationSound();
  }
  dateKey(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }
  /** Reuse one lightweight AudioContext so a user gesture can unlock mobile audio. */
  playNotificationSound() {
    if (this.settings.notificationVolume <= 0) return;
    try {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) return;
      if (!this.notificationAudioContext || this.notificationAudioContext.state === "closed") {
        this.notificationAudioContext = new AudioContextConstructor();
      }
      const context = this.notificationAudioContext;
      const playTone = () => {
        if (context.state !== "running") return;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(this.settings.notificationVolume / 100 * 0.08, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(1e-3, context.currentTime + 0.35);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start();
        oscillator.stop(context.currentTime + 0.35);
      };
      if (context.state === "suspended") {
        void context.resume().then(playTone).catch((error) => {
          console.warn("Unable to resume Salah notification audio.", error);
        });
      } else playTone();
    } catch (error) {
      console.warn("Unable to play Salah notification sound.", error);
    }
  }
  /** Render the template and hover schedule from one current schedule snapshot. */
  renderStatus() {
    if (!this.statusBar) return;
    if (!this.schedule) {
      this.statusBar.setText("Salah: set location");
      return;
    }
    const events = buildConfiguredEvents(this.schedule, this.settings);
    const next = nextEvent(events, /* @__PURE__ */ new Date());
    if (!next) return;
    const template = this.settings.statusTemplate || DEFAULTS.statusTemplate;
    const minutesLeft = Math.floor(next.delta / 6e4);
    let color = this.settings.countdownNormalUsesTheme ? "" : this.settings.countdownNormalColor;
    if (minutesLeft <= this.settings.countdownRedMinutes) color = this.settings.countdownRedColor;
    else if (minutesLeft < this.settings.countdownNormalMinutes) color = this.settings.countdownOrangeColor;
    renderStatusTemplate(this.statusBar, template, next, this.schedule, color, this.settings.use24HourTime);
    this.statusBar.title = scheduleLines(this.schedule, events, this.settings.use24HourTime).join("\n");
  }
  openSchedule() {
    if (!this.schedule) {
      new import_obsidian5.Notice("Prayer schedule unavailable. Set a location in plugin settings.", 1e4);
      return;
    }
    const events = buildConfiguredEvents(this.schedule, this.settings);
    new ScheduleModal(this.app, this.schedule, events, this.settings.use24HourTime).open();
  }
};
var ScheduleModal = class extends import_obsidian5.Modal {
  constructor(app, schedule, events, use24Hour) {
    super(app);
    this.schedule = schedule;
    this.events = events;
    this.use24Hour = use24Hour;
  }
  onOpen() {
    this.contentEl.addClass("salah-schedule-modal");
    this.contentEl.createEl("h2", { text: "Prayer times" });
    for (const prayer of this.schedule.prayers) {
      const row = this.contentEl.createDiv({ cls: "salah-schedule-row" });
      const label = row.createSpan({ cls: "salah-schedule-name salah-prayer-" + prayer.name.toLowerCase(), text: prayerDisplayName(prayer.name) });
      label.setAttr("aria-label", prayer.name);
      row.createSpan({ cls: "salah-schedule-colon", text: ":" });
      const iqama = this.events.find((event) => event.kind === "iqama" && event.name === iqamaEventName(prayer.name));
      row.createSpan({ cls: "salah-schedule-times", text: displayClock(prayer.time, this.use24Hour) + " [" + (iqama ? displayClock(iqama.time, this.use24Hour) : "\u2014") + "]" });
    }
    for (const event of this.events.filter((item) => item.kind === "custom")) {
      const row = this.contentEl.createDiv({ cls: "salah-schedule-row salah-schedule-custom" });
      row.createSpan({ cls: "salah-schedule-name", text: event.name });
      row.createSpan({ cls: "salah-schedule-colon", text: ":" });
      row.createSpan({ cls: "salah-schedule-times", text: displayClock(event.time, this.use24Hour) });
    }
    const meta = this.contentEl.createDiv({ cls: "salah-schedule-meta" });
    meta.createEl("div", { text: "Hijri: " + this.schedule.hijriDate });
    meta.createEl("div", { text: "Location: " + this.schedule.locationName });
  }
};
var HijriOffsetModal = class extends import_obsidian5.Modal {
  constructor(app, currentOffset, onSave) {
    super(app);
    this.currentOffset = currentOffset;
    this.onSave = onSave;
  }
  onOpen() {
    this.contentEl.createEl("h2", { text: "Set Hijri offset" });
    this.contentEl.createEl("p", { text: "Enter a number of days to add to or subtract from the calculated Hijri date." });
    let input = null;
    new import_obsidian5.Setting(this.contentEl).setName("Offset (days)").addText((text) => {
      text.setValue(String(this.currentOffset));
      input = text.inputEl;
      input.type = "number";
      input.min = "-30";
      input.max = "30";
      input.step = "1";
    });
    new import_obsidian5.Setting(this.contentEl).addButton((button) => button.setButtonText("Save").setCta().onClick(() => {
      const offset = Number(input == null ? void 0 : input.value);
      if (!Number.isInteger(offset) || Math.abs(offset) > 30) {
        new import_obsidian5.Notice("Enter a whole number from -30 to 30.", 1e4);
        return;
      }
      this.onSave(offset);
      this.close();
    })).addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()));
  }
};
var IqamaEditorModal = class extends import_obsidian5.Modal {
  constructor(app, rules, onSave) {
    super(app);
    this.rules = rules;
    this.onSave = onSave;
  }
  onOpen() {
    this.renderRows({ ...this.rules });
  }
  renderRows(updated) {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: "Update Iqama times" });
    this.contentEl.createEl("p", { text: "Set each time as disabled, a fixed time, or minutes offset from its prayer." });
    for (const prayer of ["Fajr", "Sunrise", "Dhuhr", "Asr", "Sunset", "Maghrib", "Isha", "Tahajjud"]) {
      const rule = updated[prayer] || { mode: "disabled" };
      const label = prayer === "Sunrise" ? "Duha prayer" : prayer === "Tahajjud" ? "Tahajjud Qiyam" : prayer + " Iqama";
      const row = new import_obsidian5.Setting(this.contentEl).setName(label);
      row.addDropdown((dropdown) => addIqamaRuleOptions(dropdown, prayer).setValue(iqamaRuleSelection(prayer, rule)).onChange((value) => {
        updated[prayer] = iqamaRuleForSelection(prayer, value, rule);
        this.renderRows(updated);
      }));
      if (rule.mode === "fixed") {
        let input = null;
        row.addText((text) => {
          text.setPlaceholder("HH:mm").setValue(rule.time).onChange((value) => {
            if (parseTime(value) !== null) updated[prayer] = { mode: "fixed", time: value };
          });
          input = text.inputEl;
        }).addButton((button) => button.setIcon("clock").setTooltip("Choose time").onClick(() => {
          new TimePickerModal(this.app, (input == null ? void 0 : input.value) || rule.time, (value) => {
            updated[prayer] = { mode: "fixed", time: value };
            if (input) input.value = value;
          }).open();
        }));
      } else if (rule.mode === "offset") {
        let input = null;
        row.addText((text) => {
          text.setPlaceholder("Minutes").setValue(String(rule.minutes)).onChange((value) => {
            const minutes = Number(value);
            if (value.trim() && Number.isInteger(minutes)) updated[prayer] = { mode: "offset", minutes, ...rule.mode === "offset" && rule.from ? { from: rule.from } : {} };
          });
          input = text.inputEl;
        }).addButton((button) => button.setButtonText("\u2212").setTooltip("Decrease offset by one minute").onClick(() => {
          const minutes = Math.trunc(Number(input == null ? void 0 : input.value) || 0) - 1;
          updated[prayer] = { mode: "offset", minutes, ...rule.mode === "offset" && rule.from ? { from: rule.from } : {} };
          if (input) input.value = String(minutes);
        })).addButton((button) => button.setButtonText("+").setTooltip("Increase offset by one minute").onClick(() => {
          const minutes = Math.trunc(Number(input == null ? void 0 : input.value) || 0) + 1;
          updated[prayer] = { mode: "offset", minutes, ...rule.mode === "offset" && rule.from ? { from: rule.from } : {} };
          if (input) input.value = String(minutes);
        }));
      }
    }
    new import_obsidian5.Setting(this.contentEl).addButton((button) => button.setButtonText("Save all Iqama times").setCta().onClick(() => {
      this.onSave(updated);
      this.close();
    })).addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()));
  }
};
function eventNotificationKey(event) {
  return event.kind + "|" + event.name;
}
function configuredFallbackEvents(settings) {
  const events = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha", "Tahajjud"].map((name) => ({ name: prayerDisplayName(name), time: "00:00", kind: "prayer" }));
  for (const [name, rule] of Object.entries(settings.iqama)) {
    if (rule.mode !== "disabled") events.push({ name: iqamaEventName(name), time: rule.mode === "fixed" ? rule.time : "00:00", kind: "iqama" });
  }
  events.push(...settings.customTimes.map((time) => ({ name: time.name, time: time.time, kind: "custom" })));
  return events;
}
var EventNotificationModal = class extends import_obsidian5.Modal {
  constructor(app, events, current, onSave) {
    super(app);
    this.events = events;
    this.current = current;
    this.onSave = onSave;
  }
  onOpen() {
    this.modalEl.addClass("salah-notification-modal");
    this.contentEl.createEl("h2", { text: "Pre-event notifications" });
    this.contentEl.createEl("p", { text: "Choose which configured events notify at the scheduled time or in advance." });
    const grid = this.contentEl.createDiv({ cls: "salah-notification-grid" });
    const heading = grid.createDiv({ cls: "salah-notification-row salah-notification-heading" });
    heading.createDiv({ text: "Prayer / event" });
    heading.createDiv({ cls: "salah-event-at-time", text: "At time" });
    heading.createDiv({ cls: "salah-event-in-advance", text: "In advance" });
    const updated = { ...this.current };
    const eventToggles = [];
    for (const event of this.events) {
      const key = eventNotificationKey(event);
      const value = updated[key] || { reached: true, advance: true };
      const row = grid.createDiv({ cls: "salah-notification-row" });
      row.createDiv({ cls: "salah-notification-name", text: event.name });
      eventToggles.push(this.addEventToggle(row, "salah-event-at-time", event.name + " at time", value.reached, (enabled) => {
        updated[key] = { ...value, reached: enabled };
        value.reached = enabled;
      }));
      eventToggles.push(this.addEventToggle(row, "salah-event-in-advance", event.name + " in advance", value.advance, (enabled) => {
        updated[key] = { ...value, advance: enabled };
        value.advance = enabled;
      }));
    }
    const setAllEvents = (enabled) => {
      for (const toggle of eventToggles) {
        toggle.checked = enabled;
        toggle.dispatchEvent(new Event("change"));
      }
    };
    new import_obsidian5.Setting(this.contentEl).setName("All events").addButton((button) => button.setButtonText("Enable all").onClick(() => setAllEvents(true))).addButton((button) => button.setButtonText("Disable all").onClick(() => setAllEvents(false)));
    new import_obsidian5.Setting(this.contentEl).addButton((button) => button.setButtonText("Save").setCta().onClick(() => {
      this.onSave(updated);
      this.close();
    })).addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()));
  }
  addEventToggle(row, cls, label, checked, onChange) {
    const cell = row.createDiv({ cls: "salah-notification-cell " + cls });
    const toggle = cell.createDiv({ cls: "checkbox-container" });
    const input = toggle.createEl("input", { attr: { type: "checkbox", "aria-label": label } });
    input.checked = checked;
    toggle.createDiv({ cls: "checkbox" });
    toggle.toggleClass("is-enabled", checked);
    input.addEventListener("change", () => {
      toggle.toggleClass("is-enabled", input.checked);
      onChange(input.checked);
    });
    return input;
  }
};
var TimePickerModal = class extends import_obsidian5.Modal {
  constructor(app, initial, onChoose) {
    super(app);
    this.initial = initial;
    this.onChoose = onChoose;
  }
  onOpen() {
    var _a;
    this.modalEl.addClass("salah-time-modal");
    this.contentEl.addClass("salah-time-modal-content");
    this.contentEl.createEl("h2", { text: "Choose time" });
    const initial = (_a = parseTime(this.initial)) != null ? _a : 0;
    let hour24 = Math.floor(initial / 60);
    let minute = initial % 60;
    let is12Hour = false;
    const picker = this.contentEl.createDiv({ cls: "salah-wheel-picker" });
    const wheels = picker.createDiv({ cls: "salah-time-wheels" });
    const hours = wheels.createDiv({ cls: "salah-time-wheel", attr: { "aria-label": "Hour", tabindex: "0" } });
    wheels.createSpan({ cls: "salah-time-separator", text: ":" });
    const minutes = wheels.createDiv({ cls: "salah-time-wheel", attr: { "aria-label": "Minute", tabindex: "0" } });
    const period = picker.createEl("button", { cls: "salah-time-period" });
    const format = this.contentEl.createEl("button", { cls: "salah-time-format", text: "24-hour" });
    let hourNodes = [];
    let minuteNodes = [];
    const updateSelection = (list, selected) => list.forEach((item, index) => item.toggleClass("is-selected", index === selected));
    const nearestIndex = (element) => {
      const items = Array.from(element.querySelectorAll(".salah-time-wheel-item"));
      if (items.length === 0) return 0;
      const viewport = element.getBoundingClientRect();
      const center = viewport.top + element.clientHeight / 2;
      let best = 0;
      let distance = Infinity;
      items.forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        const offset = Math.abs(rect.top + rect.height / 2 - center);
        if (offset < distance) {
          distance = offset;
          best = index;
        }
      });
      return best;
    };
    const scrollTo = (element, index) => {
      const items = Array.from(element.querySelectorAll(".salah-time-wheel-item"));
      const item = items[index];
      if (!item) return;
      const viewport = element.getBoundingClientRect();
      const center = viewport.top + element.clientHeight / 2;
      const rect = item.getBoundingClientRect();
      element.scrollTop += rect.top + rect.height / 2 - center;
    };
    const hourIndex = () => is12Hour ? (hour24 % 12 || 12) - 1 : hour24;
    const selectHour = (index) => {
      const nodes = Array.from(hours.querySelectorAll(".salah-time-wheel-item"));
      const bounded = Math.max(0, Math.min(nodes.length - 1, index));
      scrollTo(hours, bounded);
      updateSelection(nodes, bounded);
      hour24 = is12Hour ? (bounded + 1) % 12 + (hour24 >= 12 ? 12 : 0) : bounded;
      syncPeriod();
    };
    const selectMinute = (index) => {
      const bounded = Math.max(0, Math.min(minuteNodes.length - 1, index));
      scrollTo(minutes, bounded);
      updateSelection(minuteNodes, bounded);
      minute = bounded;
    };
    const addWheelSpacers = (wheel) => {
      wheel.createDiv({ cls: "salah-time-wheel-spacer" });
    };
    const renderHours = () => {
      hours.empty();
      addWheelSpacers(hours);
      const total = is12Hour ? 12 : 24;
      hourNodes = [];
      for (let i = 0; i < total; i++) {
        const value = is12Hour ? i + 1 : i;
        const option = hours.createDiv({ cls: "salah-time-wheel-item", text: String(value).padStart(2, "0") });
        option.addEventListener("click", () => selectHour(i));
        hourNodes.push(option);
      }
      addWheelSpacers(hours);
      scrollTo(hours, hourIndex());
      updateSelection(hourNodes, hourIndex());
    };
    minuteNodes = [];
    addWheelSpacers(minutes);
    for (let i = 0; i < 60; i++) {
      const option = minutes.createDiv({ cls: "salah-time-wheel-item", text: String(i).padStart(2, "0") });
      option.addEventListener("click", () => selectMinute(i));
      minuteNodes.push(option);
    }
    addWheelSpacers(minutes);
    scrollTo(minutes, minute);
    const syncPeriod = () => {
      period.textContent = hour24 >= 12 ? "PM" : "AM";
      period.toggleClass("salah-time-period-hidden", !is12Hour);
    };
    const bindWheel = (element, onIndex) => {
      let frame = 0;
      let wheelRemainder = 0;
      element.addEventListener("wheel", (event) => {
        event.preventDefault();
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
        wheelRemainder += delta;
        if (Math.abs(wheelRemainder) < 40) return;
        const direction = wheelRemainder > 0 ? 1 : -1;
        wheelRemainder = Math.max(-39, Math.min(39, wheelRemainder - direction * 40));
        const nodes = Array.from(element.querySelectorAll(".salah-time-wheel-item"));
        const currentIndex = nearestIndex(element);
        const index = Math.max(0, Math.min(nodes.length - 1, currentIndex + direction));
        if (index === 0 && direction < 0 || index === nodes.length - 1 && direction > 0) wheelRemainder = 0;
        scrollTo(element, index);
        updateSelection(nodes, index);
        onIndex(index);
        syncPeriod();
      }, { passive: false });
      element.addEventListener("scroll", () => {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => {
          const nodes = Array.from(element.querySelectorAll(".salah-time-wheel-item"));
          const index = nearestIndex(element);
          updateSelection(nodes, index);
          onIndex(index);
          syncPeriod();
        });
      }, { passive: true });
      element.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const nodes = Array.from(element.querySelectorAll(".salah-time-wheel-item"));
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const index = Math.max(0, Math.min(nodes.length - 1, nearestIndex(element) + direction));
        scrollTo(element, index);
        updateSelection(nodes, index);
        onIndex(index);
        syncPeriod();
      });
    };
    bindWheel(hours, (index) => {
      hour24 = is12Hour ? (index + 1) % 12 + (hour24 >= 12 ? 12 : 0) : index;
    });
    bindWheel(minutes, (index) => {
      minute = index;
    });
    period.addEventListener("click", () => {
      hour24 = (hour24 + 12) % 24;
      syncPeriod();
    });
    format.addEventListener("click", () => {
      is12Hour = !is12Hour;
      format.textContent = is12Hour ? "12-hour" : "24-hour";
      renderHours();
      syncPeriod();
    });
    renderHours();
    syncPeriod();
    new import_obsidian5.Setting(this.contentEl).addButton((button) => button.setButtonText("Use time").setCta().onClick(() => {
      this.onChoose(String(hour24).padStart(2, "0") + ":" + String(minute).padStart(2, "0"));
      this.close();
    })).addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()));
  }
};
var SalahSettingsTab = class extends import_obsidian5.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  refreshAtCurrentScroll() {
    var _a;
    const pane = this.containerEl.closest(".vertical-tab-content");
    const top = (_a = pane == null ? void 0 : pane.scrollTop) != null ? _a : 0;
    this.display();
    requestAnimationFrame(() => {
      if (pane) pane.scrollTop = top;
    });
  }
  display() {
    var _a, _b, _c, _d;
    const container = this.containerEl;
    container.empty();
    new import_obsidian5.Setting(container).setName("Salah and Hijri Times").setHeading();
    new import_obsidian5.Setting(container).setName("Location").setHeading();
    let latitude = (_b = (_a = this.plugin.settings.coordinates) == null ? void 0 : _a.latitude) != null ? _b : 0;
    let longitude = (_d = (_c = this.plugin.settings.coordinates) == null ? void 0 : _c.longitude) != null ? _d : 0;
    let locationName = this.plugin.settings.locationName;
    new import_obsidian5.Setting(container).setName("Location").setDesc(`${locationName || "No location detected yet."}; detect, search, or save coordinates below.`).addButton((button) => button.setButtonText("Detect location").onClick(() => {
      void this.plugin.detectAgain(false).then(() => this.refreshAtCurrentScroll());
    })).addButton((button) => button.setButtonText("Choose location").onClick(() => {
      this.plugin.openLocationPicker(() => this.refreshAtCurrentScroll());
    })).addButton((button) => button.setButtonText("Save coordinates").onClick(() => void this.plugin.setLocation({ latitude, longitude }, locationName || "Manual location")));
    new import_obsidian5.Setting(container).setName("Latitude").setDesc("Latitude \u221290 to 90. New York: 40.7128.").addText((text) => text.setPlaceholder("e.g. 40.7128").setValue(this.plugin.settings.coordinates ? String(latitude) : "").onChange((value) => latitude = value.trim() ? Number(value) : NaN));
    new import_obsidian5.Setting(container).setName("Longitude").setDesc("Longitude \u2212180 to 180; west is negative. New York: \u221274.0060.").addText((text) => text.setPlaceholder("e.g. -74.0060").setValue(this.plugin.settings.coordinates ? String(longitude) : "").onChange((value) => longitude = value.trim() ? Number(value) : NaN));
    new import_obsidian5.Setting(container).setName("Location name").addText((text) => text.setValue(locationName).onChange((value) => locationName = value));
    new import_obsidian5.Setting(container).setName("Prayer times and Hijri date").setHeading();
    new import_obsidian5.Setting(container).setName("Calculation method").setDesc("Choose your local prayer-time convention.").addDropdown((dropdown) => {
      for (const method of CALCULATION_METHODS) dropdown.addOption(String(method.id), method.label);
      return dropdown.setValue(String(this.plugin.settings.calculationMethod)).onChange((value) => {
        this.plugin.settings.calculationMethod = Number(value);
        void this.plugin.saveAndRefresh();
      });
    });
    let hijriOffsetInput = null;
    const changeHijriOffset = (amount) => {
      const typed = Number(hijriOffsetInput == null ? void 0 : hijriOffsetInput.value);
      const current = Number.isInteger(typed) ? typed : this.plugin.settings.hijriOffset;
      const offset = current + amount;
      if (Math.abs(offset) > 30) return;
      this.plugin.settings.hijriOffset = offset;
      if (hijriOffsetInput) hijriOffsetInput.value = String(offset);
      void this.plugin.saveAndRefresh();
    };
    new import_obsidian5.Setting(container).setName("Hijri offset (days)").addText((text) => {
      text.setValue(String(this.plugin.settings.hijriOffset)).onChange((value) => {
        const offset = Number(value);
        if (Number.isInteger(offset) && Math.abs(offset) <= 30) {
          this.plugin.settings.hijriOffset = offset;
          void this.plugin.saveAndRefresh();
        }
      });
      hijriOffsetInput = text.inputEl;
    }).addButton((button) => button.setButtonText("-").setTooltip("Decrease Hijri offset by one day").onClick(() => changeHijriOffset(-1))).addButton((button) => button.setButtonText("+").setTooltip("Increase Hijri offset by one day").onClick(() => changeHijriOffset(1)));
    new import_obsidian5.Setting(container).setName("Hijri rollover").setDesc("Use the location's Maghrib or local midnight.").addDropdown((dropdown) => dropdown.addOption("maghrib", "After Maghrib").addOption("midnight", "At midnight").setValue(this.plugin.settings.hijriRollover).onChange((value) => {
      this.plugin.settings.hijriRollover = value;
      void this.plugin.saveAndRefresh();
    }));
    new import_obsidian5.Setting(container).setName("Default calendar month style").setDesc("Default month style for the prayer calendar.").addDropdown((dropdown) => dropdown.addOption("hijri", "Hijri months").addOption("gregorian", "Gregorian months").setValue(this.plugin.settings.calendarMonthStyle).onChange((value) => {
      this.plugin.settings.calendarMonthStyle = value;
      void this.plugin.persistSettings();
    }));
    new import_obsidian5.Setting(container).setName("Status bar").setHeading();
    new import_obsidian5.Setting(container).setName("Show status bar item").setDesc("Show or hide the status-bar countdown.").addToggle((toggle) => toggle.setValue(this.plugin.settings.statusBarVisible).onChange((value) => {
      this.plugin.settings.statusBarVisible = value;
      this.plugin.applyStatusBarVisibility();
      void this.plugin.persistSettings();
    }));
    const templateSetting = new import_obsidian5.Setting(container).setName("Status bar template").setDesc("Tokens: {next}, {time}, {countdown}, {hijri}, {hijri:month}, {hijri:long}, {location}.").addTextArea((text) => {
      text.setPlaceholder(DEFAULTS.statusTemplate).setValue(this.plugin.settings.statusTemplate || DEFAULTS.statusTemplate).onChange((value) => {
        this.plugin.settings.statusTemplate = value;
        void this.plugin.persistSettings();
      });
      text.inputEl.rows = 3;
      text.inputEl.addClass("salah-template-input");
    });
    templateSetting.settingEl.addClass("salah-template-setting");
    new import_obsidian5.Setting(container).setName("Countdown colors").setHeading();
    new import_obsidian5.Setting(container).setName("Red countdown threshold (minutes)").setDesc("Red countdown threshold in minutes. Default: 5.").addText((text) => text.setValue(String(this.plugin.settings.countdownRedMinutes)).onChange((value) => this.updateMinutes(value, "countdownRedMinutes", 1, 1440)));
    new import_obsidian5.Setting(container).setName("Orange countdown threshold (minutes)").setDesc("Orange applies below this value; normal color applies above. Default: 20.").addText((text) => text.setValue(String(this.plugin.settings.countdownNormalMinutes)).onChange((value) => this.updateMinutes(value, "countdownNormalMinutes", 1, 1440)));
    this.addColorSetting(container, "Red countdown color", "countdownRedColor");
    this.addColorSetting(container, "Orange countdown color", "countdownOrangeColor");
    this.addColorSetting(container, "Normal countdown color", "countdownNormalColor");
    new import_obsidian5.Setting(container).setName("Use Obsidian theme for normal countdown color").addToggle((toggle) => toggle.setValue(this.plugin.settings.countdownNormalUsesTheme).onChange((value) => {
      this.plugin.settings.countdownNormalUsesTheme = value;
      void this.plugin.persistSettings();
    }));
    new import_obsidian5.Setting(container).setName("Notifications").setHeading();
    new import_obsidian5.Setting(container).setName("Prayer time notifications").setDesc("Notify when enabled events occur.").addToggle((toggle) => toggle.setValue(this.plugin.settings.notificationsEnabled).onChange((value) => {
      this.plugin.settings.notificationsEnabled = value;
      void this.plugin.persistSettings();
    }));
    new import_obsidian5.Setting(container).setName("Play notification sound").setDesc("Play a tone with notifications.").addToggle((toggle) => toggle.setValue(this.plugin.settings.notificationSound).onChange((value) => {
      this.plugin.settings.notificationSound = value;
      void this.plugin.persistSettings();
    }));
    new import_obsidian5.Setting(container).setName("Notification volume").addSlider((slider) => slider.setLimits(0, 100, 5).setValue(this.plugin.settings.notificationVolume).setDynamicTooltip().onChange((value) => {
      this.plugin.settings.notificationVolume = value;
      void this.plugin.persistSettings();
    })).addButton((button) => button.setButtonText("Test sound").onClick(() => this.plugin.playNotificationSound()));
    new import_obsidian5.Setting(container).setName("Per-event notification settings").setDesc("Choose at-time and advance alerts for each event.").addButton((button) => button.setButtonText("Configure events\u2026").onClick(() => this.openEventNotificationSettings()));
    new import_obsidian5.Setting(container).setName("Prayer/custom time advance notification (minutes)").setDesc("Minutes before prayer or custom events; 0 disables.").addText((text) => text.setPlaceholder("0").setValue(String(this.plugin.settings.prayerReminderMinutes)).onChange((value) => this.updateMinutes(value, "prayerReminderMinutes")));
    new import_obsidian5.Setting(container).setName("Iqama advance notification (minutes)").setDesc("Minutes before Iqama; 0 disables.").addText((text) => text.setPlaceholder("0").setValue(String(this.plugin.settings.iqamaReminderMinutes)).onChange((value) => this.updateMinutes(value, "iqamaReminderMinutes")));
    this.addCustomTimes(container);
    this.addIqamaSettings(container);
    new import_obsidian5.Setting(container).setName("Other").setHeading();
    new import_obsidian5.Setting(container).setName("Refresh interval (minutes)").setDesc("Minutes between automatic refreshes.").addText((text) => text.setValue(String(this.plugin.settings.refreshMinutes)).onChange((value) => {
      const minutes = Number(value);
      if (Number.isInteger(minutes) && minutes >= 5) {
        this.plugin.settings.refreshMinutes = minutes;
        void this.plugin.saveAndRefresh();
      }
    }));
    new import_obsidian5.Setting(container).setName("Use 24-hour time").setDesc("Use 24-hour time in the status bar and schedule.").addToggle((toggle) => toggle.setValue(this.plugin.settings.use24HourTime).onChange((value) => {
      this.plugin.settings.use24HourTime = value;
      void this.plugin.persistSettings();
    }));
  }
  openEventNotificationSettings() {
    const events = this.plugin.schedule ? buildConfiguredEvents(this.plugin.schedule, this.plugin.settings) : configuredFallbackEvents(this.plugin.settings);
    new EventNotificationModal(this.app, events, this.plugin.settings.eventNotifications, (updated) => {
      this.plugin.settings.eventNotifications = updated;
      void this.plugin.persistSettings();
    }).open();
  }
  updateMinutes(value, key, min = 0, max = 1439) {
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < min || minutes > max) return;
    this.plugin.settings[key] = minutes;
    void this.plugin.persistSettings();
  }
  addColorSetting(container, label, key) {
    const defaults = { countdownRedColor: "#dc5082", countdownOrangeColor: "#ffa500", countdownNormalColor: "#cdd6f4" };
    new import_obsidian5.Setting(container).setName(label).addColorPicker((picker) => picker.setValue(this.plugin.settings[key] || defaults[key]).onChange((color) => {
      this.plugin.settings[key] = color;
      void this.plugin.persistSettings();
    }));
  }
  addCustomTimes(container) {
    new import_obsidian5.Setting(container).setName("Custom daily times").setHeading();
    container.createEl("p", { text: "Add daily reminders or custom events (24-hour HH:mm)." });
    let name = "";
    let time = "";
    new import_obsidian5.Setting(container).setName("Add custom time").addText((text) => text.setPlaceholder("Name (e.g. Midnight)").onChange((value) => name = value)).addText((text) => {
      text.setPlaceholder("HH:mm").onChange((value) => time = value);
      text.inputEl.addClass("salah-new-custom-time");
    }).addButton((button) => button.setIcon("clock").setTooltip("Choose time").onClick(() => {
      new TimePickerModal(this.app, time || "00:00", (value) => {
        time = value;
        const input = container.querySelector(".salah-new-custom-time");
        if (input) input.value = value;
      }).open();
    })).addButton((button) => button.setButtonText("Add").onClick(() => {
      const cleanName = name.trim();
      if (!cleanName || parseTime(time) === null) {
        new import_obsidian5.Notice("Enter a name and a valid time in HH:mm format.", 1e4);
        return;
      }
      this.plugin.settings.customTimes.push({ name: cleanName, time });
      void this.plugin.persistSettings();
      this.refreshAtCurrentScroll();
    }));
    for (const [index, event] of this.plugin.settings.customTimes.entries()) {
      new import_obsidian5.Setting(container).setName(event.name).setDesc(clock(event.time)).addButton((button) => button.setButtonText("Remove").onClick(() => {
        this.plugin.settings.customTimes.splice(index, 1);
        void this.plugin.persistSettings();
        this.refreshAtCurrentScroll();
      }));
    }
  }
  addIqamaSettings(container) {
    new import_obsidian5.Setting(container).setName("Iqama times").setHeading();
    container.createEl("p", { text: "Choose a fixed time or offset; negative offsets are allowed." });
    for (const prayer of ["Fajr", "Sunrise", "Dhuhr", "Asr", "Sunset", "Maghrib", "Isha", "Tahajjud"]) {
      const rule = this.plugin.settings.iqama[prayer] || { mode: "disabled" };
      const row = new import_obsidian5.Setting(container).setName(prayer === "Sunrise" ? "Duha prayer" : prayer === "Tahajjud" ? "Tahajjud Qiyam" : prayer + " Iqama").addDropdown((dropdown) => addIqamaRuleOptions(dropdown, prayer).setValue(iqamaRuleSelection(prayer, rule)).onChange((value) => {
        this.plugin.settings.iqama[prayer] = iqamaRuleForSelection(prayer, value, rule);
        void this.plugin.persistSettings();
        this.refreshAtCurrentScroll();
      }));
      row.settingEl.addClass("salah-iqama-setting");
      if (rule.mode === "fixed") {
        row.addText((text) => {
          text.setPlaceholder("HH:mm").setValue(rule.time).onChange((value) => {
            if (parseTime(value) !== null) {
              this.plugin.settings.iqama[prayer] = { mode: "fixed", time: value };
              void this.plugin.persistSettings();
            }
          });
          text.inputEl.addClass("salah-iqama-time");
        }).addButton((button) => button.setIcon("clock").setTooltip("Choose time").onClick(() => {
          const input = row.settingEl.querySelector(".salah-iqama-time");
          const current = (input == null ? void 0 : input.value) || "05:00";
          new TimePickerModal(this.app, current, (value) => {
            this.plugin.settings.iqama[prayer] = { mode: "fixed", time: value };
            if (input) input.value = value;
            void this.plugin.persistSettings();
          }).open();
        }));
      } else if (rule.mode === "offset") {
        let input = null;
        row.addText((text) => {
          text.setPlaceholder("Minutes").setValue(String(rule.minutes)).onChange((value) => {
            const minutes = Number(value);
            if (value.trim() && Number.isInteger(minutes)) {
              this.plugin.settings.iqama[prayer] = { mode: "offset", minutes, ...rule.mode === "offset" && rule.from ? { from: rule.from } : {} };
              void this.plugin.persistSettings();
            }
          });
          input = text.inputEl;
        }).addButton((button) => button.setButtonText("\u2212").setTooltip("Decrease offset by one minute").onClick(() => {
          const minutes = Math.trunc(Number(input == null ? void 0 : input.value) || 0) - 1;
          this.plugin.settings.iqama[prayer] = { mode: "offset", minutes, ...rule.mode === "offset" && rule.from ? { from: rule.from } : {} };
          if (input) input.value = String(minutes);
          void this.plugin.persistSettings();
        })).addButton((button) => button.setButtonText("+").setTooltip("Increase offset by one minute").onClick(() => {
          const minutes = Math.trunc(Number(input == null ? void 0 : input.value) || 0) + 1;
          this.plugin.settings.iqama[prayer] = { mode: "offset", minutes, ...rule.mode === "offset" && rule.from ? { from: rule.from } : {} };
          if (input) input.value = String(minutes);
          void this.plugin.persistSettings();
        }));
      }
    }
  }
};
var main_default = SalahPlugin;
