// @ts-nocheck -- entry recovered from the last complete bundle; runtime logic remains in src modules.
/**
 * Obsidian entry point for Salah and Hijri Times.
 *
 * Peculiarities worth knowing before editing:
 * - This file was recovered from the last complete compiled bundle rather than
 *   written from scratch as TypeScript. It therefore keeps the bundle-style
 *   `var X = class extends ...` declarations, the generated `import_obsidian5`
 *   namespace alias, and `@ts-nocheck`. Treat `src/*` as the home for portable,
 *   typed logic; keep only Obsidian/UI wiring here.
 * - `DEFAULTS` is merged shallowly with saved data. Nested objects (Iqama rules,
 *   prayer offsets, notification rules) are merged explicitly in `onload()`.
 *   Any new nested setting must be given the same treatment.
 * - The status-bar context menu and the command palette share command IDs, so
 *   menu actions must never call a UI method directly. Add a command first and
 *   then delegate to it, keeping shortcuts, menus, and the palette in sync.
 * - The time picker's row geometry lives in `src/time-wheel.ts` and is mirrored
 *   by CSS variables in `styles.css`. Keep both sides in sync; otherwise the
 *   wheel can rest between rows.
 */
import * as import_obsidian5 from "obsidian";
import { CALCULATION_METHODS } from "./src/calculation-methods";
import { PrayerCalendarModal } from "./src/calendar";
import { detectLocation, valid as validCoordinates } from "./src/location";
import { LocationSearchModal } from "./src/location-picker";
import { addIqama as buildConfiguredEvents, loadSchedule } from "./src/prayer-times";
import { renderStatusTemplate } from "./src/status-template";
import { clock, countdown, formatTime, nextEvent, parseTime } from "./src/time";
import { clampTimeWheelIndex, TIME_WHEEL_ROW_HEIGHT, TIME_WHEEL_SPACER_ROWS, TIME_WHEEL_VISIBLE_ROWS, timeWheelIndexFromScroll, timeWheelScrollTop } from "./src/time-wheel";
import type { Coordinates, IqamaRule, Schedule, Settings } from "./src/types";
/**
 * Persisted settings defaults.
 *
 * NOTE: `loadData()` results are merged into this object shallowly, so every
 * nested object listed here is also merged field-by-field in `onload()`.
 * Adding a new nested setting requires touching both places; otherwise saved
 * data can end up with a partially populated object.
 */
var DEFAULTS = {
  coordinates: null,
  locationName: "",
  calculationMethod: 1,
  prayerTimeOffsets: { Fajr: 0, Sunrise: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 },
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
    Isha: { mode: "disabled" },
    Tahajjud: { mode: "disabled" }
  }
};
/**
 * Display and persisted-name helpers.
 *
 * "Tahajjud" is the plugin's internal name for the Last Third window and
 * "Sunrise" doubles as the Duha prayer. Those aliases are used in every place
 * that shows a name to the user; keep them here so the status bar, schedule,
 * notifications, and Iqama editor never drift apart.
 */
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
    const base = prayerDisplayName(prayer);
    dropdown.addOption("offset", "Offset from " + base);
  }
  return dropdown;
}
/**
 * Iqama dropdown conversion helpers.
 *
 * The dropdown uses UI-only pseudo-values ("offset-last-third", "offset-fajr")
 * because a persisted `IqamaRule` only stores `{ mode: "offset", from?: ... }`.
 * Never write a pseudo-value to settings: `iqamaRuleSelection` converts persisted
 * rules to dropdown IDs and `iqamaRuleForSelection` converts them back. The
 * existing minute value/`from` base is preserved when switching offset target.
 */
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
/** Render a schedule row for the status-bar tooltip and schedule modal. */
function displayClock(time, use24Hour) {
  const minutes = parseTime(time);
  return use24Hour && minutes !== null ? formatTime(minutes) : clock(time);
}
function scheduleLines(schedule, events, use24Hour) {
  const rows = schedule.prayers.map((prayer) => {
    const iqama = events.find((event) => event.kind === "iqama" && event.name === iqamaEventName(prayer.name));
    return prayerDisplayName(prayer.name) + ": " + displayClock(prayer.time, use24Hour) + " [" + (iqama ? displayClock(iqama.time, use24Hour) : "\u2014") + "]";
  });
  rows.push(...events.filter((event) => event.kind === "custom").map((event) => event.name + ": " + displayClock(event.time, use24Hour)));
  rows.push("", "Hijri: " + schedule.hijriDate, "Location: " + schedule.locationName);
  return rows;
}
/**
 * Main plugin controller.
 *
 * Lifecycle notes:
 * - `onload()` only registers commands/UI; network work is deferred until
 *   `workspace.onLayoutReady()`.
 * - Countdown rendering is aligned to wall-clock minute boundaries by `tick()`,
 *   while schedule refreshes use a separate interval that is re-armed after each
 *   successful fetch. Do not merge the two timers: notifications must fire on
 *   the minute even when a refresh fails.
 * - `refreshSchedule()` uses a monotonic sequence number so a slow older request
 *   cannot overwrite a newer user-triggered result.
 */
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
    this.settings.prayerTimeOffsets = { ...DEFAULTS.prayerTimeOffsets, ...(this.settings.prayerTimeOffsets || {}) };
    delete this.settings.iqama.Sunset;
    this.settings.customTimes = this.settings.customTimes || [];
    this.settings.notifiedTimeKeys = this.settings.notifiedTimeKeys || [];
    this.settings.eventNotifications = this.settings.eventNotifications || {};
    this.statusBar = this.addStatusBarItem();
    this.statusBar.addClass("salah-hijri-status");
    // Obsidian's `onClickEvent()` binds BOTH "click" and "auxclick". A right
    // click is an auxclick, so without the button guard it would open the
    // schedule modal before "contextmenu" fires, hiding the status bar and
    // making the context menu appear not to work.
    this.statusBar.onClickEvent((event) => {
      if (event.button !== 0) return;
      this.openSchedule();
    });
    // Right-click exposes the same actions as the command palette. Using the
    // command registry (rather than calling methods) keeps hotkeys, menus, and
    // the palette on one code path.
    this.registerDomEvent(this.statusBar, "contextmenu", (event) => {
      event.preventDefault();
      this.openStatusBarMenu(event);
    });
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
  /**
   * Execute one of this plugin's commands by short ID.
   *
   * Menus and modal action buttons use this so they always go through the
   * command registry, matching the command palette and user hotkeys.
   */
  executeCommand(commandId) {
    const fullId = this.manifest.id + ":" + commandId;
    if (this.app.commands.executeCommandById(fullId)) return true;
    new import_obsidian5.Notice("Command unavailable: " + fullId, 1e4);
    return false;
  }
  /**
   * Show actions for the status-bar countdown.
   *
   * Every item delegates to a registered command ID (`<plugin-id>:<command-id>`)
   * instead of calling a modal directly. That is intentional: user-defined
   * hotkeys and the command palette already target those IDs, so the menu stays
   * consistent and new commands automatically have one canonical entry point.
   */
  openStatusBarMenu(event) {
    const menu = new import_obsidian5.Menu();
    menu.addItem((item) => item.setTitle("Update Iqama times").setIcon("clock").onClick(() => this.executeCommand("edit-iqama-times")));
    menu.addItem((item) => item.setTitle("Set Hijri offset").setIcon("calendar-plus").onClick(() => this.executeCommand("set-hijri-offset")));
    menu.addItem((item) => item.setTitle("View calendar").setIcon("calendar-days").onClick(() => this.executeCommand("open-prayer-calendar")));
    menu.addItem((item) => item.setTitle("Display prayer times").setIcon("list").onClick(() => this.executeCommand("display-prayer-times")));
    menu.showAtMouseEvent(event);
  }
  openSchedule() {
    if (!this.schedule) {
      new import_obsidian5.Notice("Prayer schedule unavailable. Set a location in plugin settings.", 1e4);
      return;
    }
    const events = buildConfiguredEvents(this.schedule, this.settings);
    new ScheduleModal(this.app, this.schedule, events, this.settings.use24HourTime, (commandId) => this.executeCommand(commandId)).open();
  }
};
/**
 * Daily schedule modal opened by left-clicking the status bar or by the
 * "Display prayer times" command/menu item.
 */
var ScheduleModal = class extends import_obsidian5.Modal {
  constructor(app, schedule, events, use24Hour, executeCommand) {
    super(app);
    this.schedule = schedule;
    this.events = events;
    this.use24Hour = use24Hour;
    this.executeCommand = executeCommand;
  }
  onOpen() {
    this.contentEl.addClass("salah-schedule-modal");
    this.contentEl.createEl("h2", { text: "Prayer times" });
    // A real table (not per-row grids) keeps the Iqama brackets aligned: the
    // prayer-time column is right-aligned, so short times like "4:59 am" and
    // long ones like "12:00 pm" end at the same x position. Grid rows sized to
    // their own content cannot do that because each row is an independent grid.
    const table = this.contentEl.createEl("table", { cls: "salah-schedule-table" });
    const body = table.createEl("tbody");
    for (const prayer of this.schedule.prayers) {
      const row = body.createEl("tr", { cls: "salah-schedule-row" });
      const label = row.createEl("th", { cls: "salah-schedule-name salah-prayer-" + prayer.name.toLowerCase(), text: prayerDisplayName(prayer.name) });
      label.setAttr("scope", "row");
      label.setAttr("aria-label", prayer.name);
      row.createEl("td", { cls: "salah-schedule-colon", text: ":" });
      row.createEl("td", { cls: "salah-schedule-prayer-time", text: displayClock(prayer.time, this.use24Hour) });
      const iqama = this.events.find((event) => event.kind === "iqama" && event.name === iqamaEventName(prayer.name));
      row.createEl("td", { cls: "salah-schedule-iqama-time", text: "[" + (iqama ? displayClock(iqama.time, this.use24Hour) : "\u2014") + "]" });
    }
    for (const event of this.events.filter((item) => item.kind === "custom")) {
      const row = body.createEl("tr", { cls: "salah-schedule-row salah-schedule-custom" });
      const label = row.createEl("th", { cls: "salah-schedule-name", text: event.name });
      label.setAttr("scope", "row");
      row.createEl("td", { cls: "salah-schedule-colon", text: ":" });
      const time = row.createEl("td", { cls: "salah-schedule-prayer-time", text: displayClock(event.time, this.use24Hour) });
      time.colSpan = 2;
    }
    const meta = this.contentEl.createDiv({ cls: "salah-schedule-meta" });
    meta.createEl("div", { text: "Hijri: " + this.schedule.hijriDate });
    meta.createEl("div", { text: "Location: " + this.schedule.locationName });
    // These buttons run the registered commands rather than opening a modal
    // directly, so they behave exactly like the palette/hotkey versions. The
    // command modal stacks over this one, the same way the time picker stacks
    // over the Iqama editor.
    const actions = this.contentEl.createDiv({ cls: "salah-schedule-actions" });
    // No `setIcon()` here: ButtonComponent.setIcon() empties the button, which
    // would wipe the label set by `setButtonText()`. Text-only keeps both
    // actions readable in every theme.
    new import_obsidian5.ButtonComponent(actions).setButtonText("Update Iqama times").onClick(() => this.executeCommand("edit-iqama-times"));
    new import_obsidian5.ButtonComponent(actions).setButtonText("Set Hijri offset").onClick(() => this.executeCommand("set-hijri-offset"));
  }
};
/**
 * Small numeric editor for the Hijri day offset. Validation lives here rather
 * than in the setting field so the command and settings tab share the same
 * -30..30 whole-day rule.
 */
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
/**
 * Editor for all Iqama rules.
 *
 * Each dropdown change triggers a full `renderRows()` because the selected mode
 * decides which extra controls exist (file-time picker vs. offset steppers).
 * `updated` is a working copy; nothing is persisted until "Save all".
 */
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
    for (const prayer of ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha", "Tahajjud"]) {
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
/**
 * Per-event notification matrix.
 *
 * Preferences are keyed by `kind|name` (see `eventNotificationKey`) rather than
 * by time, so changing a prayer/Iqama time keeps the user's toggles. Missing
 * keys default to both notices enabled.
 */
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
/**
 * Time chooser used by fixed Iqama and custom-time fields.
 *
 * Peculiarities:
 * - Each wheel is a native scroll container with exactly five visible rows
 *   (up2, up1, middle, down1, down2) and two spacer rows above/below. The
 *   resting scroll offset is therefore always `index * rowHeight`; see
 *   `src/time-wheel.ts` for the derivation and tests.
 * - Alignment never measures DOM rectangles. Rect-based centring is sensitive
 *   to modal layout timing, zoom, and sub-pixel scroll positions, which is what
 *   previously left the wheel half a row off when the modal first opened.
 *   Instead the picker waits for layout, assigns an exact `scrollTop`, and
 *   reveals the wheels only afterwards.
 * - CSS `scroll-snap-type` plus a short debounce ("settle") keeps trackpad and
 *   touch scrolling snapped to a row. Mouse-wheel steps are intercepted and
 *   moved by exactly one row, so they never produce an in-between position.
 * - The row height/count are mirrored by CSS variables set on `.salah-wheel-picker`.
 *   If they change, update `src/time-wheel.ts`, its unit tests, and the CSS
 *   fallbacks in `styles.css` together.
 */
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
    picker.style.setProperty("--salah-time-row-height", TIME_WHEEL_ROW_HEIGHT + "px");
    picker.style.setProperty("--salah-time-visible-rows", String(TIME_WHEEL_VISIBLE_ROWS));
    picker.style.setProperty("--salah-time-spacer-rows", String(TIME_WHEEL_SPACER_ROWS));
    const wheels = picker.createDiv({ cls: "salah-time-wheels" });
    const hours = wheels.createDiv({ cls: "salah-time-wheel", attr: { "aria-label": "Hour", tabindex: "0" } });
    wheels.createSpan({ cls: "salah-time-separator", text: ":" });
    const minutes = wheels.createDiv({ cls: "salah-time-wheel", attr: { "aria-label": "Minute", tabindex: "0" } });
    const period = picker.createEl("button", { cls: "salah-time-period" });
    const format = this.contentEl.createEl("button", { cls: "salah-time-format", text: "24-hour" });
    let hourNodes = [];
    const itemsIn = (element) => Array.from(element.querySelectorAll(".salah-time-wheel-item"));
    const updateSelection = (list, selected) => list.forEach((item, index) => item.toggleClass("is-selected", index === selected));
    const nearestIndex = (element) => {
      const count = itemsIn(element).length;
      return timeWheelIndexFromScroll(element.scrollTop, TIME_WHEEL_ROW_HEIGHT, count);
    };
    /** Snap to one row and mark it selected. Returns the clamped index. */
    const alignWheel = (element, index) => {
      const items = itemsIn(element);
      if (items.length === 0) return 0;
      const bounded = clampTimeWheelIndex(index, items.length);
      const target = timeWheelScrollTop(bounded, TIME_WHEEL_ROW_HEIGHT);
      if (Math.abs(element.scrollTop - target) > 0.5) element.scrollTop = target;
      updateSelection(items, bounded);
      return bounded;
    };
    const hourIndex = () => is12Hour ? (hour24 % 12 || 12) - 1 : hour24;
    const syncPeriod = () => {
      period.textContent = hour24 >= 12 ? "PM" : "AM";
      period.toggleClass("salah-time-period-hidden", !is12Hour);
    };
    const selectHour = (index) => {
      const bounded = alignWheel(hours, index);
      hour24 = is12Hour ? (bounded + 1) % 12 + (hour24 >= 12 ? 12 : 0) : bounded;
      syncPeriod();
    };
    const selectMinute = (index) => {
      minute = alignWheel(minutes, index);
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
      updateSelection(hourNodes, hourIndex());
      alignWheel(hours, hourIndex());
    };
    addWheelSpacers(minutes);
    for (let i = 0; i < 60; i++) {
      const option = minutes.createDiv({ cls: "salah-time-wheel-item", text: String(i).padStart(2, "0") });
      option.addEventListener("click", () => selectMinute(i));
    }
    addWheelSpacers(minutes);
    const bindWheel = (element, onIndex) => {
      let frame = 0;
      let settleTimer = 0;
      let wheelRemainder = 0;
      const applyIndex = (index) => {
        const bounded = alignWheel(element, index);
        onIndex(bounded);
        syncPeriod();
      };
      element.addEventListener("wheel", (event) => {
        event.preventDefault();
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
        wheelRemainder += delta;
        if (Math.abs(wheelRemainder) < 40) return;
        const direction = wheelRemainder > 0 ? 1 : -1;
        wheelRemainder = Math.max(-39, Math.min(39, wheelRemainder - direction * 40));
        const items = itemsIn(element);
        const currentIndex = nearestIndex(element);
        const index = clampTimeWheelIndex(currentIndex + direction, items.length);
        if (index === 0 && direction < 0 || index === items.length - 1 && direction > 0) wheelRemainder = 0;
        applyIndex(index);
      }, { passive: false });
      // Native scrolling (trackpad/touch/keyboard scroll) can stop between rows.
      // Preview the nearest selection while it moves, then snap after it settles.
      element.addEventListener("scroll", () => {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => {
          const index = nearestIndex(element);
          updateSelection(itemsIn(element), index);
          onIndex(index);
          syncPeriod();
        });
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => applyIndex(nearestIndex(element)), 90);
      }, { passive: true });
      element.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        applyIndex(nearestIndex(element) + direction);
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
      window.requestAnimationFrame(() => alignWheel(hours, hourIndex()));
    });
    renderHours();
    syncPeriod();
    // Wait for the modal's first layout pass before measuring scrollTop limits.
    // `visibility` is held back by CSS until `is-ready`, avoiding a visible jump.
    // A timeout fallback keeps the modal usable if rAF is throttled (for example
    // while an Obsidian window is in the background).
    let revealed = false;
    const revealWheels = () => {
      if (revealed) return;
      revealed = true;
      alignWheel(hours, hourIndex());
      alignWheel(minutes, minute);
      picker.addClass("is-ready");
    };
    window.requestAnimationFrame(() => window.requestAnimationFrame(revealWheels));
    window.setTimeout(revealWheels, 120);
    new import_obsidian5.Setting(this.contentEl).addButton((button) => button.setButtonText("Use time").setCta().onClick(() => {
      this.onChoose(String(hour24).padStart(2, "0") + ":" + String(minute).padStart(2, "0"));
      this.close();
    })).addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()));
  }
};
/**
 * Settings tab.
 *
 * Peculiarity: many controls save immediately (there is no Apply button), and
 * some of them rebuild the whole tab because the Iqama rule dropdown changes
 * which controls are visible. `refreshAtCurrentScroll()` exists to keep the
 * settings pane from jumping to the top during those rebuilds.
 */
var SalahSettingsTab = class extends import_obsidian5.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  /** Re-render the tab but restore the vertical tab's scroll offset on the next frame. */
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
      const typed = Number(hijriOffsetInput?.value);
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
    new import_obsidian5.Setting(container).setName("Prayer time offsets (minutes)").setDesc("Adjust fetched provider times per prayer. Positive values delay a prayer; negative values advance it.").setHeading();
    for (const prayer of ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"]) {
      new import_obsidian5.Setting(container).setName(prayer + " offset").setDesc("Minutes added to the online provider time.").addText((text) => text.setPlaceholder("0").setValue(String(this.plugin.settings.prayerTimeOffsets[prayer] || 0)).onChange((value) => {
        const offset = Number(value);
        if (Number.isInteger(offset) && Math.abs(offset) <= 180) {
          this.plugin.settings.prayerTimeOffsets[prayer] = offset;
          void this.plugin.saveAndRefresh();
        }
      }));
    }
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
  /** Validate a minute setting before persisting it; invalid input leaves the old value. */
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
  /** Build custom daily-time rows; the picker writes back into the in-progress add form. */
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
    for (const prayer of ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha", "Tahajjud"]) {
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


export default SalahPlugin;
