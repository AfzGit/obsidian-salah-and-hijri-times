/**
 * Obsidian entry point for Salah and Hijri Times.
 *
 * `DEFAULTS` is merged shallowly with saved data. Nested objects (Iqama rules,
 * prayer offsets, notification rules) are merged explicitly in `onload()`.
 * Any new nested setting must be given the same treatment.
 *
 * The status-bar context menu and the command palette share command IDs, so
 * menu actions must never call a UI method directly. Add a command first and
 * then delegate to it, keeping shortcuts, menus, and the palette in sync.
 *
 * The time picker's row geometry lives in `src/time-wheel.ts` and is mirrored
 * by CSS variables in `styles.css`. Keep both sides in sync; otherwise the
 * wheel can rest between rows.
 */
import {
  App,
  ButtonComponent,
  DropdownComponent,
  Menu,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TextComponent,
} from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import type { EventNotificationRule, IqamaRule, Schedule, Settings, TimelineEvent } from "./src/types";
import { CALCULATION_METHODS } from "./src/calculation-methods";
import { PrayerCalendarModal } from "./src/calendar";
import { validCoordinates } from "./src/coordinates";
import { detectLocation } from "./src/location";
import { LocationSearchModal } from "./src/location-picker";
import { loadSchedule } from "./src/prayer-times";
import { buildConfiguredEvents } from "./src/schedule-events";
import { renderStatusTemplate } from "./src/status-template";
import { clock, formatTime, nextEvent, parseTime } from "./src/time";
import {
  TIME_WHEEL_ROW_HEIGHT,
  TIME_WHEEL_SPACER_ROWS,
  TIME_WHEEL_VISIBLE_ROWS,
  clampTimeWheelIndex,
  timeWheelIndexFromScroll,
  timeWheelScrollTop,
} from "./src/time-wheel";

/**
 * The command registry is available at runtime but is not part of the public
 * Obsidian typings. Declaring the small surface we use keeps the call typed.
 */
declare module "obsidian" {
  interface App {
    commands: { executeCommandById(id: string): boolean };
  }
}

type ExecuteCommand = (commandId: string) => boolean;
type NumericSettingKey =
  | "countdownRedMinutes"
  | "countdownNormalMinutes"
  | "prayerReminderMinutes"
  | "iqamaReminderMinutes";
type ColorSettingKey = "countdownRedColor" | "countdownOrangeColor" | "countdownNormalColor";

/**
 * Persisted settings defaults.
 *
 * NOTE: `loadData()` results are merged into this object shallowly, so every
 * nested object listed here is also merged field-by-field in `onload()`.
 * Adding a new nested setting requires touching both places; otherwise saved
 * data can end up with a partially populated object.
 */
const DEFAULTS: Settings = {
  coordinates: null,
  locationName: "",
  calculationMethod: 1,
  prayerTimeOffsets: { Fajr: 0, Sunrise: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 },
  hijriOffset: 0,
  hijriRollover: "maghrib",
  calendarMonthStyle: "hijri",
  refreshMinutes: 30,
  statusTemplate: "{next}: {time} ({countdown}) · {hijri}",
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
    Tahajjud: { mode: "disabled" },
  },
};

/**
 * Display and persisted-name helpers.
 *
 * "Tahajjud" is the plugin's internal name for the Last Third window and
 * "Sunrise" doubles as the Duha prayer. Those aliases are used in every place
 * that shows a name to the user; keep them here so the status bar, schedule,
 * notifications, and Iqama editor never drift apart.
 */
function prayerDisplayName(prayer: string): string {
  return prayer === "Tahajjud" ? "Last Third" : prayer;
}

function iqamaEventName(prayer: string): string {
  return prayer === "Sunrise" ? "Duha prayer" : prayer === "Tahajjud" ? "Tahajjud Qiyam" : prayer + " Iqama";
}

function addIqamaRuleOptions(dropdown: DropdownComponent, prayer: string): DropdownComponent {
  dropdown.addOption("disabled", "Disabled").addOption("fixed", "Fixed time");
  if (prayer === "Tahajjud") {
    dropdown.addOption("offset-last-third", "Offset from last third").addOption("offset-fajr", "Offset from Fajr");
  } else {
    dropdown.addOption("offset", "Offset from " + prayerDisplayName(prayer));
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
function iqamaRuleSelection(prayer: string, rule: IqamaRule): string {
  if (rule.mode !== "offset") return rule.mode;
  if (prayer === "Tahajjud") return rule.from === "Fajr" ? "offset-fajr" : "offset-last-third";
  return "offset";
}

function offsetRule(minutes: number, from?: "Fajr" | "Tahajjud"): IqamaRule {
  return from ? { mode: "offset", minutes, from } : { mode: "offset", minutes };
}

function iqamaRuleForSelection(prayer: string, selection: string, current: IqamaRule): IqamaRule {
  if (selection === "fixed") return { mode: "fixed", time: "05:00" };
  if (selection === "offset-fajr") return offsetRule(current.mode === "offset" ? current.minutes : 0, "Fajr");
  if (selection === "offset-last-third") return offsetRule(current.mode === "offset" ? current.minutes : 0, "Tahajjud");
  if (selection === "offset") return offsetRule(current.mode === "offset" ? current.minutes : 0);
  return { mode: "disabled" };
}

/** Render a schedule row for the status-bar tooltip and schedule modal. */
function displayClock(time: string, use24Hour: boolean): string {
  const minutes = parseTime(time);
  return use24Hour && minutes !== null ? formatTime(minutes) : clock(time);
}

function scheduleLines(schedule: Schedule, events: TimelineEvent[], use24Hour: boolean): string[] {
  const rows = schedule.prayers.map((prayer) => {
    const iqama = events.find((event) => event.kind === "iqama" && event.name === iqamaEventName(prayer.name));
    return prayerDisplayName(prayer.name) + ": " + displayClock(prayer.time, use24Hour) + " [" + (iqama ? displayClock(iqama.time, use24Hour) : "—") + "]";
  });
  rows.push(...events.filter((event) => event.kind === "custom").map((event) => event.name + ": " + displayClock(event.time, use24Hour)));
  rows.push("", "Hijri: " + schedule.hijriDate, "Location: " + schedule.locationName);
  return rows;
}

function eventNotificationKey(event: Pick<TimelineEvent, "kind" | "name">): string {
  return event.kind + "|" + event.name;
}

function configuredFallbackEvents(settings: Settings): TimelineEvent[] {
  const events: TimelineEvent[] = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha", "Midnight", "Tahajjud"].map((name): TimelineEvent => ({
    name: prayerDisplayName(name),
    time: "00:00",
    kind: "prayer",
  }));
  for (const [name, rule] of Object.entries(settings.iqama)) {
    if (rule.mode !== "disabled") {
      events.push({ name: iqamaEventName(name), time: rule.mode === "fixed" ? rule.time : "00:00", kind: "iqama" });
    }
  }
  events.push(...settings.customTimes.map((time): TimelineEvent => ({ name: time.name, time: time.time, kind: "custom" })));
  return events;
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
export default class SalahPlugin extends Plugin {
  settings: Settings = DEFAULTS;
  schedule: Schedule | null = null;
  private statusBar: HTMLElement | null = null;
  private minuteTimer = 0;
  private refreshTimer = 0;
  private scheduleRefreshSequence = 0;
  private loadingLocation = false;
  private notificationAudioContext: AudioContext | null = null;

  /** Register commands and UI, then defer the first network work until layout is ready. */
  async onload(): Promise<void> {
    const saved = (await this.loadData()) as Partial<Settings> | null;
    this.settings = { ...DEFAULTS, ...(saved ?? {}) };
    this.settings.iqama = { ...DEFAULTS.iqama, ...this.settings.iqama };
    this.settings.prayerTimeOffsets = { ...DEFAULTS.prayerTimeOffsets, ...(this.settings.prayerTimeOffsets ?? {}) };
    delete this.settings.iqama.Sunset;
    this.settings.customTimes = [...(this.settings.customTimes ?? [])];
    this.settings.notifiedTimeKeys = [...(this.settings.notifiedTimeKeys ?? [])];
    this.settings.eventNotifications = { ...(this.settings.eventNotifications ?? {}) };

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
    this.addCommand({
      id: "open-prayer-calendar",
      name: "Open prayer calendar",
      callback: () => new PrayerCalendarModal(this.app, this.settings, this.schedule?.hijriNumeric).open(),
    });
    this.addCommand({
      id: "toggle-status-bar-visibility",
      name: "Toggle status bar visibility",
      callback: () => {
        this.settings.statusBarVisible = !this.settings.statusBarVisible;
        this.applyStatusBarVisibility();
        void this.persistSettings();
        new Notice(this.settings.statusBarVisible ? "Status bar item shown." : "Status bar item hidden.");
      },
    });

    this.app.workspace.onLayoutReady(() => void this.initialize());
  }

  /** Release timers and audio state when the plugin is disabled or reloaded. */
  onunload(): void {
    window.clearTimeout(this.minuteTimer);
    window.clearInterval(this.refreshTimer);
    if (this.notificationAudioContext) void this.notificationAudioContext.close();
  }

  /** Detect location only when none is saved; otherwise refresh the existing location. */
  async initialize(): Promise<void> {
    if (!this.settings.coordinates) {
      await this.detectAgain();
      return;
    }
    await this.refreshSchedule();
  }

  async detectAgain(announceSuccess = true): Promise<void> {
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
      // Without a location there is no schedule; show the setup hint instead of
      // leaving an empty status bar item.
      this.renderStatus();
    } finally {
      this.loadingLocation = false;
    }
  }

  openLocationPicker(onSelected?: () => void): void {
    new LocationSearchModal(this.app, (place) => {
      const name = [place.name, place.admin1, place.country].filter(Boolean).join(", ");
      void this.setLocation({ latitude: place.latitude, longitude: place.longitude }, name).then(() => onSelected?.());
    }).open();
  }

  openHijriOffsetEditor(): void {
    new HijriOffsetModal(this.app, this.settings.hijriOffset, (offset) => {
      this.settings.hijriOffset = offset;
      void this.saveAndRefresh().then(() => new Notice("Hijri offset updated.", 10_000));
    }).open();
  }

  openIqamaEditor(): void {
    new IqamaEditorModal(this.app, this.settings.iqama, (updated) => {
      this.settings.iqama = updated;
      void this.persistSettings().then(() => new Notice("Iqama times updated.", 10_000));
    }).open();
  }

  async refreshNow(): Promise<void> {
    if (!this.settings.coordinates) {
      new Notice("Choose or enter a location before refreshing prayer times.", 10_000);
      return;
    }
    if (await this.refreshSchedule()) new Notice("Prayer and Hijri times refreshed.", 10_000);
  }

  async setLocation(coordinates: { latitude: number; longitude: number }, name: string): Promise<void> {
    if (!validCoordinates(coordinates)) {
      new Notice("Coordinates must be latitude −90 to 90 and longitude −180 to 180.", 10_000);
      return;
    }
    this.settings.coordinates = coordinates;
    this.settings.locationName = name || "Manual location";
    await this.saveData(this.settings);
    await this.refreshSchedule();
    new Notice("Location saved.", 10_000);
  }

  applyStatusBarVisibility(): void {
    if (this.statusBar) this.statusBar.toggleClass("salah-status-hidden", !this.settings.statusBarVisible);
  }

  async persistSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.applyStatusBarVisibility();
    this.renderStatus();
  }

  async saveAndRefresh(): Promise<void> {
    await this.saveData(this.settings);
    await this.refreshSchedule();
  }

  /** Fetch the current schedule and re-arm the independent slower refresh timer. */
  async refreshSchedule(): Promise<boolean> {
    const coordinates = this.settings.coordinates;
    if (!coordinates) return false;
    const sequence = ++this.scheduleRefreshSequence;
    const settings: Settings = { ...this.settings, coordinates: { ...coordinates } };
    try {
      const schedule = await loadSchedule(settings);
      if (sequence !== this.scheduleRefreshSequence) return false;
      this.schedule = schedule;
      this.tick();
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = window.setInterval(
        () => void this.refreshSchedule(),
        Math.max(5, this.settings.refreshMinutes) * 60_000,
      );
      return true;
    } catch (error) {
      if (sequence !== this.scheduleRefreshSequence) return false;
      new Notice("Couldn't refresh prayer times: " + (error instanceof Error ? error.message : "unknown error"), 10_000);
      this.renderStatus();
      return false;
    }
  }

  /** Align countdown updates to minute boundaries and check due notifications. */
  tick(): void {
    this.renderStatus();
    this.checkNotifications();
    window.clearTimeout(this.minuteTimer);
    this.minuteTimer = window.setTimeout(() => this.tick(), 60_000 - Date.now() % 60_000 + 50);
  }

  /** Deduplicate reached-time and advance notices across repeated ticks and reloads. */
  checkNotifications(): void {
    if (!this.schedule || !this.settings.notificationsEnabled) return;
    const now = new Date();
    const nowMinute = now.getHours() * 60 + now.getMinutes();
    const events = buildConfiguredEvents(this.schedule, this.settings);
    const seen = new Set(this.settings.notifiedTimeKeys || []);
    const messages: string[] = [];
    const remember = (key: string, message: string): void => {
      if (seen.has(key)) return;
      seen.add(key);
      messages.push(message);
    };
    for (const event of events) {
      const eventMinute = parseTime(event.time);
      if (eventMinute === null) continue;
      const isIqama = event.kind === "iqama";
      const rule = this.settings.eventNotifications[eventNotificationKey(event)] ?? { reached: true, advance: true };
      const lead = isIqama ? this.settings.iqamaReminderMinutes : this.settings.prayerReminderMinutes;
      const target = new Date(now);
      target.setHours(Math.floor(eventMinute / 60), eventMinute % 60, 0, 0);
      if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
      const eventDate = this.dateKey(target);
      if (rule.reached && eventMinute === nowMinute) {
        remember(
          this.dateKey(now) + "|reached|" + event.kind + "|" + event.name + "|" + event.time,
          event.name + " time reached (" + clock(event.time) + ")",
        );
      }
      if (rule.advance && lead > 0 && Math.ceil((target.getTime() - now.getTime()) / 60_000) === lead) {
        remember(
          eventDate + "|before-" + lead + "|" + event.kind + "|" + event.name + "|" + event.time,
          lead + " minute" + (lead === 1 ? "" : "s") + " until " + event.name + " (" + clock(event.time) + ")",
        );
      }
    }
    if (messages.length === 0) return;
    this.settings.notifiedTimeKeys = [...seen].slice(-200);
    void this.saveData(this.settings).catch((error: unknown) => console.error("Couldn't save notification history.", error));
    new Notice(messages.join("\n"), 10_000);
    if (this.settings.notificationSound) this.playNotificationSound();
  }

  dateKey(date: Date): string {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }

  /** Reuse one lightweight AudioContext so a user gesture can unlock mobile audio. */
  playNotificationSound(): void {
    if (this.settings.notificationVolume <= 0) return;
    try {
      const AudioContextConstructor =
        window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return;
      if (!this.notificationAudioContext || this.notificationAudioContext.state === "closed") {
        this.notificationAudioContext = new AudioContextConstructor();
      }
      const context = this.notificationAudioContext;
      const playTone = (): void => {
        if (context.state !== "running") return;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime((this.settings.notificationVolume / 100) * 0.08, context.currentTime);
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
        void context.resume().then(playTone).catch((error: unknown) => {
          console.warn("Unable to resume Salah notification audio.", error);
        });
      } else {
        playTone();
      }
    } catch (error) {
      console.warn("Unable to play Salah notification sound.", error);
    }
  }

  /** Render the template and hover schedule from one current schedule snapshot. */
  renderStatus(): void {
    if (!this.statusBar) return;
    if (!this.schedule) {
      this.statusBar.setText("Salah: set location");
      return;
    }
    const events = buildConfiguredEvents(this.schedule, this.settings);
    const next = nextEvent(events, new Date());
    if (!next) return;
    const template = this.settings.statusTemplate || DEFAULTS.statusTemplate;
    const minutesLeft = Math.floor(next.delta / 60_000);
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
  executeCommand(commandId: string): boolean {
    const fullId = this.manifest.id + ":" + commandId;
    if (this.app.commands.executeCommandById(fullId)) return true;
    new Notice("Command unavailable: " + fullId, 10_000);
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
  openStatusBarMenu(event: MouseEvent): void {
    const menu = new Menu();
    menu.addItem((item) => item.setTitle("Update Iqama times").setIcon("clock").onClick(() => this.executeCommand("edit-iqama-times")));
    menu.addItem((item) => item.setTitle("Set Hijri offset").setIcon("calendar-plus").onClick(() => this.executeCommand("set-hijri-offset")));
    menu.addItem((item) => item.setTitle("View calendar").setIcon("calendar-days").onClick(() => this.executeCommand("open-prayer-calendar")));
    menu.addItem((item) => item.setTitle("Display prayer times").setIcon("list").onClick(() => this.executeCommand("display-prayer-times")));
    menu.showAtMouseEvent(event);
  }

  openSchedule(): void {
    if (!this.schedule) {
      new Notice("Prayer schedule unavailable. Set a location in plugin settings.", 10_000);
      return;
    }
    const events = buildConfiguredEvents(this.schedule, this.settings);
    new ScheduleModal(this.app, this.schedule, events, this.settings.use24HourTime, (commandId) => this.executeCommand(commandId)).open();
  }
}

/**
 * Daily schedule modal opened by left-clicking the status bar or by the
 * "Display prayer times" command/menu item.
 */
class ScheduleModal extends Modal {
  constructor(
    app: App,
    private readonly schedule: Schedule,
    private readonly events: TimelineEvent[],
    private readonly use24Hour: boolean,
    private readonly executeCommand: ExecuteCommand,
  ) {
    super(app);
  }

  onOpen(): void {
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
      const label = row.createEl("th", {
        cls: "salah-schedule-name salah-prayer-" + prayer.name.toLowerCase(),
        text: prayerDisplayName(prayer.name),
      });
      label.setAttr("scope", "row");
      label.setAttr("aria-label", prayer.name);
      row.createEl("td", { cls: "salah-schedule-colon", text: ":" });
      row.createEl("td", { cls: "salah-schedule-prayer-time", text: displayClock(prayer.time, this.use24Hour) });
      const iqama = this.events.find((event) => event.kind === "iqama" && event.name === iqamaEventName(prayer.name));
      row.createEl("td", {
        cls: "salah-schedule-iqama-time",
        text: "[" + (iqama ? displayClock(iqama.time, this.use24Hour) : "—") + "]",
      });
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
    meta.createDiv({ text: "Hijri: " + this.schedule.hijriDate });
    meta.createDiv({ text: "Location: " + this.schedule.locationName });
    // These buttons run the registered commands rather than opening a modal
    // directly, so they behave exactly like the palette/hotkey versions. The
    // command modal stacks over this one, the same way the time picker stacks
    // over the Iqama editor.
    const actions = this.contentEl.createDiv({ cls: "salah-schedule-actions" });
    // No `setIcon()` here: ButtonComponent.setIcon() empties the button, which
    // would wipe the label set by `setButtonText()`. Text-only keeps both
    // actions readable in every theme.
    new ButtonComponent(actions).setButtonText("Update Iqama times").onClick(() => this.executeCommand("edit-iqama-times"));
    new ButtonComponent(actions).setButtonText("Set Hijri offset").onClick(() => this.executeCommand("set-hijri-offset"));
    new ButtonComponent(actions).setButtonText("View calendar").onClick(() => this.executeCommand("open-prayer-calendar"));
  }
}

/**
 * Small numeric editor for the Hijri day offset. Validation lives here rather
 * than in the setting field so the command and settings tab share the same
 * -30..30 whole-day rule.
 */
class HijriOffsetModal extends Modal {
  constructor(
    app: App,
    private readonly currentOffset: number,
    private readonly onSave: (offset: number) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.createEl("h2", { text: "Set Hijri offset" });
    this.contentEl.createEl("p", { text: "Enter a number of days to add to or subtract from the calculated Hijri date." });
    const state: { input: HTMLInputElement | null } = { input: null };
    new Setting(this.contentEl).setName("Offset (days)").addText((text) => {
      text.setValue(String(this.currentOffset));
      state.input = text.inputEl;
      state.input.type = "number";
      state.input.min = "-30";
      state.input.max = "30";
      state.input.step = "1";
    });
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("Save").setCta().onClick(() => {
        const offset = Number(state.input?.value);
        if (!Number.isInteger(offset) || Math.abs(offset) > 30) {
          new Notice("Enter a whole number from -30 to 30.", 10_000);
          return;
        }
        this.onSave(offset);
        this.close();
      }))
      .addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()));
  }
}

/**
 * Editor for all Iqama rules.
 *
 * Each dropdown change triggers a full `renderRows()` because the selected mode
 * decides which extra controls exist (time picker vs. offset steppers).
 * `updated` is a working copy; nothing is persisted until "Save all".
 */
class IqamaEditorModal extends Modal {
  constructor(
    app: App,
    private readonly rules: Record<string, IqamaRule>,
    private readonly onSave: (updated: Record<string, IqamaRule>) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("salah-iqama-modal");
    this.renderRows({ ...this.rules });
  }

  renderRows(updated: Record<string, IqamaRule>): void {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: "Update Iqama times" });
    this.contentEl.createEl("p", { text: "Set each time as disabled, a fixed time, or minutes offset from its prayer." });
    // A real table (rather than one `Setting` per row) keeps every control in
    // the same column. A dropdown's width depends on the selected option, so
    // per-row setting controls started at different x positions and the value
    // fields never lined up.
    const table = this.contentEl.createEl("table", { cls: "salah-iqama-table" });
    const body = table.createEl("tbody");
    for (const prayer of ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha", "Tahajjud"]) {
      const rule = updated[prayer] ?? { mode: "disabled" };
      const row = body.createEl("tr");
      const label = row.createEl("th", { cls: "salah-iqama-name", text: iqamaEventName(prayer) });
      label.setAttr("scope", "row");

      const ruleCell = row.createEl("td", { cls: "salah-iqama-rule" });
      addIqamaRuleOptions(new DropdownComponent(ruleCell), prayer)
        .setValue(iqamaRuleSelection(prayer, rule))
        .onChange((value) => {
          updated[prayer] = iqamaRuleForSelection(prayer, value, rule);
          this.renderRows(updated);
        });

      const valueCell = row.createEl("td", { cls: "salah-iqama-value" });
      const controls = valueCell.createDiv({ cls: "salah-iqama-controls" });
      const inputSlot = controls.createDiv({ cls: "salah-iqama-input" });
      const buttons = controls.createDiv({ cls: "salah-iqama-buttons" });
      if (rule.mode === "fixed") {
        const input = new TextComponent(inputSlot).setPlaceholder("Hh:mm").setValue(rule.time).onChange((value) => {
          if (parseTime(value) !== null) updated[prayer] = { mode: "fixed", time: value };
        }).inputEl;
        new ButtonComponent(buttons).setIcon("clock").setTooltip("Choose time").onClick(() => {
          new TimePickerModal(this.app, input.value || rule.time, (value) => {
            updated[prayer] = { mode: "fixed", time: value };
            input.value = value;
          }).open();
        });
      } else if (rule.mode === "offset") {
        const input = new TextComponent(inputSlot).setPlaceholder("Minutes").setValue(String(rule.minutes)).onChange((value) => {
          const minutes = Number(value);
          if (value.trim() && Number.isInteger(minutes)) updated[prayer] = offsetRule(minutes, rule.from);
        }).inputEl;
        new ButtonComponent(buttons).setButtonText("−").setTooltip("Decrease offset by one minute").onClick(() => {
          const minutes = Math.trunc(Number(input.value) || 0) - 1;
          updated[prayer] = offsetRule(minutes, rule.from);
          input.value = String(minutes);
        });
        new ButtonComponent(buttons).setButtonText("+").setTooltip("Increase offset by one minute").onClick(() => {
          const minutes = Math.trunc(Number(input.value) || 0) + 1;
          updated[prayer] = offsetRule(minutes, rule.from);
          input.value = String(minutes);
        });
      }
    }
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("Save all Iqama times").setCta().onClick(() => {
        this.onSave(updated);
        this.close();
      }))
      .addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()));
  }
}

/**
 * Per-event notification matrix.
 *
 * Preferences are keyed by `kind|name` (see `eventNotificationKey`) rather than
 * by time, so changing a prayer/Iqama time keeps the user's toggles. Missing
 * keys default to both notices enabled.
 */
class EventNotificationModal extends Modal {
  constructor(
    app: App,
    private readonly events: TimelineEvent[],
    private readonly current: Record<string, EventNotificationRule>,
    private readonly onSave: (updated: Record<string, EventNotificationRule>) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("salah-notification-modal");
    this.contentEl.createEl("h2", { text: "Pre-event notifications" });
    this.contentEl.createEl("p", { text: "Choose which configured events notify at the scheduled time or in advance." });
    const grid = this.contentEl.createDiv({ cls: "salah-notification-grid" });
    const heading = grid.createDiv({ cls: "salah-notification-row salah-notification-heading" });
    heading.createDiv({ text: "Prayer / event" });
    heading.createDiv({ cls: "salah-event-at-time", text: "At time" });
    heading.createDiv({ cls: "salah-event-in-advance", text: "In advance" });
    const updated: Record<string, EventNotificationRule> = { ...this.current };
    const eventToggles: HTMLInputElement[] = [];
    for (const event of this.events) {
      const key = eventNotificationKey(event);
      const value = updated[key] ?? { reached: true, advance: true };
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
    const setAllEvents = (enabled: boolean): void => {
      for (const toggle of eventToggles) {
        toggle.checked = enabled;
        toggle.dispatchEvent(new Event("change"));
      }
    };
    new Setting(this.contentEl)
      .setName("All events")
      .addButton((button) => button.setButtonText("Enable all").onClick(() => setAllEvents(true)))
      .addButton((button) => button.setButtonText("Disable all").onClick(() => setAllEvents(false)));
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("Save").setCta().onClick(() => {
        this.onSave(updated);
        this.close();
      }))
      .addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()));
  }

  addEventToggle(
    row: HTMLElement,
    cls: string,
    label: string,
    checked: boolean,
    onChange: (enabled: boolean) => void,
  ): HTMLInputElement {
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
}

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
class TimePickerModal extends Modal {
  constructor(
    app: App,
    private readonly initial: string,
    private readonly onChoose: (value: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("salah-time-modal");
    this.contentEl.addClass("salah-time-modal-content");
    this.contentEl.createEl("h2", { text: "Choose time" });
    const initial = parseTime(this.initial) ?? 0;
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
    let hourNodes: HTMLElement[] = [];
    const itemsIn = (element: HTMLElement): HTMLElement[] =>
      Array.from(element.querySelectorAll<HTMLElement>(".salah-time-wheel-item"));
    const updateSelection = (list: HTMLElement[], selected: number): void =>
      list.forEach((item, index) => item.toggleClass("is-selected", index === selected));
    const nearestIndex = (element: HTMLElement): number => {
      const count = itemsIn(element).length;
      return timeWheelIndexFromScroll(element.scrollTop, TIME_WHEEL_ROW_HEIGHT, count);
    };
    /** Snap to one row and mark it selected. Returns the clamped index. */
    const alignWheel = (element: HTMLElement, index: number): number => {
      const items = itemsIn(element);
      if (items.length === 0) return 0;
      const bounded = clampTimeWheelIndex(index, items.length);
      const target = timeWheelScrollTop(bounded, TIME_WHEEL_ROW_HEIGHT);
      if (Math.abs(element.scrollTop - target) > 0.5) element.scrollTop = target;
      updateSelection(items, bounded);
      return bounded;
    };
    const hourIndex = (): number => (is12Hour ? (hour24 % 12 || 12) - 1 : hour24);
    const syncPeriod = (): void => {
      period.textContent = hour24 >= 12 ? "PM" : "AM";
      period.toggleClass("salah-time-period-hidden", !is12Hour);
    };
    const selectHour = (index: number): void => {
      const bounded = alignWheel(hours, index);
      hour24 = is12Hour ? ((bounded + 1) % 12) + (hour24 >= 12 ? 12 : 0) : bounded;
      syncPeriod();
    };
    const selectMinute = (index: number): void => {
      minute = alignWheel(minutes, index);
    };
    const addWheelSpacers = (wheel: HTMLElement): void => {
      wheel.createDiv({ cls: "salah-time-wheel-spacer" });
    };
    const renderHours = (): void => {
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
    const bindWheel = (element: HTMLElement, onIndex: (index: number) => void): void => {
      let frame = 0;
      let settleTimer = 0;
      let wheelRemainder = 0;
      const applyIndex = (index: number): void => {
        const bounded = alignWheel(element, index);
        onIndex(bounded);
        syncPeriod();
      };
      element.addEventListener("wheel", (event: WheelEvent) => {
        event.preventDefault();
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
        wheelRemainder += delta;
        if (Math.abs(wheelRemainder) < 40) return;
        const direction = wheelRemainder > 0 ? 1 : -1;
        wheelRemainder = Math.max(-39, Math.min(39, wheelRemainder - direction * 40));
        const items = itemsIn(element);
        const currentIndex = nearestIndex(element);
        const index = clampTimeWheelIndex(currentIndex + direction, items.length);
        if ((index === 0 && direction < 0) || (index === items.length - 1 && direction > 0)) wheelRemainder = 0;
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
      element.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        applyIndex(nearestIndex(element) + direction);
      });
    };
    bindWheel(hours, (index) => {
      hour24 = is12Hour ? ((index + 1) % 12) + (hour24 >= 12 ? 12 : 0) : index;
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
    const revealWheels = (): void => {
      if (revealed) return;
      revealed = true;
      alignWheel(hours, hourIndex());
      alignWheel(minutes, minute);
      picker.addClass("is-ready");
    };
    window.requestAnimationFrame(() => window.requestAnimationFrame(revealWheels));
    window.setTimeout(revealWheels, 120);
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("Use time").setCta().onClick(() => {
        this.onChoose(String(hour24).padStart(2, "0") + ":" + String(minute).padStart(2, "0"));
        this.close();
      }))
      .addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()));
  }
}

/**
 * Settings tab.
 *
 * Peculiarity: many controls save immediately (there is no Apply button), and
 * some of them rebuild the whole tab because the Iqama rule dropdown changes
 * which controls are visible. `refreshAtCurrentScroll()` exists to keep the
 * settings pane from jumping to the top during those rebuilds.
 */
class SalahSettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: SalahPlugin) {
    super(app, plugin);
  }

  /** Re-render the tab but restore the vertical tab's scroll offset on the next frame. */
  refreshAtCurrentScroll(): void {
    const pane = this.containerEl.closest<HTMLElement>(".vertical-tab-content");
    const top = pane?.scrollTop ?? 0;
    this.renderSettings();
    window.requestAnimationFrame(() => {
      if (pane) pane.scrollTop = top;
    });
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    // This tab is rendered imperatively because it contains dynamic rows and
    // modal editors. Returning an empty list keeps `display()` as the fallback
    // for Obsidian versions before 1.13 and for this custom layout.
    return [];
  }

  display(): void {
    this.renderSettings();
  }

  private renderSettings(): void {
    const container = this.containerEl;
    container.empty();
    new Setting(container).setName("Location").setHeading();
    let latitude = this.plugin.settings.coordinates?.latitude ?? 0;
    let longitude = this.plugin.settings.coordinates?.longitude ?? 0;
    let locationName = this.plugin.settings.locationName;
    new Setting(container)
      .setName("Location")
      .setDesc(`${locationName || "No location detected yet."}; detect, search, or save coordinates below.`)
      .addButton((button) => button.setButtonText("Detect location").onClick(() => {
        void this.plugin.detectAgain(false).then(() => this.refreshAtCurrentScroll());
      }))
      .addButton((button) => button.setButtonText("Choose location").onClick(() => {
        this.plugin.openLocationPicker(() => this.refreshAtCurrentScroll());
      }))
      .addButton((button) => button.setButtonText("Save coordinates").onClick(() =>
        void this.plugin.setLocation({ latitude, longitude }, locationName || "Manual location")));
    new Setting(container)
      .setName("Latitude")
      .setDesc("Latitude −90 to 90; for example, 40.7128.")
      .addText((text) => text
        .setPlaceholder("e.g. 40.7128")
        .setValue(this.plugin.settings.coordinates ? String(latitude) : "")
        .onChange((value) => {
          latitude = value.trim() ? Number(value) : NaN;
        }));
    new Setting(container)
      .setName("Longitude")
      .setDesc("Longitude −180 to 180; west is negative. For example, −74.0060.")
      .addText((text) => text
        .setPlaceholder("e.g. -74.0060")
        .setValue(this.plugin.settings.coordinates ? String(longitude) : "")
        .onChange((value) => {
          longitude = value.trim() ? Number(value) : NaN;
        }));
    new Setting(container)
      .setName("Location name")
      .addText((text) => text.setValue(locationName).onChange((value) => {
        locationName = value;
      }));

    new Setting(container).setName("Prayer times and Hijri date").setHeading();
    new Setting(container)
      .setName("Calculation method")
      .setDesc("Choose your local prayer-time convention.")
      .addDropdown((dropdown) => {
        for (const method of CALCULATION_METHODS) dropdown.addOption(String(method.id), method.label);
        dropdown.setValue(String(this.plugin.settings.calculationMethod)).onChange((value) => {
          this.plugin.settings.calculationMethod = Number(value);
          void this.plugin.saveAndRefresh();
        });
      });
    const hijriState: { input: HTMLInputElement | null } = { input: null };
    const changeHijriOffset = (amount: number): void => {
      const typed = Number(hijriState.input?.value);
      const current = Number.isInteger(typed) ? typed : this.plugin.settings.hijriOffset;
      const offset = current + amount;
      if (Math.abs(offset) > 30) return;
      this.plugin.settings.hijriOffset = offset;
      if (hijriState.input) hijriState.input.value = String(offset);
      void this.plugin.saveAndRefresh();
    };
    new Setting(container)
      .setName("Hijri offset (days)")
      .addText((text) => {
        text.setValue(String(this.plugin.settings.hijriOffset)).onChange((value) => {
          const offset = Number(value);
          if (Number.isInteger(offset) && Math.abs(offset) <= 30) {
            this.plugin.settings.hijriOffset = offset;
            void this.plugin.saveAndRefresh();
          }
        });
        hijriState.input = text.inputEl;
      })
      .addButton((button) => button.setButtonText("-").setTooltip("Decrease Hijri offset by one day").onClick(() => changeHijriOffset(-1)))
      .addButton((button) => button.setButtonText("+").setTooltip("Increase Hijri offset by one day").onClick(() => changeHijriOffset(1)));

    new Setting(container)
      .setName("Prayer time offsets (minutes)")
      .setDesc("Adjust fetched provider times per prayer. Positive values delay a prayer; negative values advance it.")
      .setHeading();
    for (const prayer of ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"]) {
      new Setting(container)
        .setName(prayer + " offset")
        .setDesc("Minutes added to the online provider time.")
        .addText((text) => text
          .setPlaceholder("0")
          .setValue(String(this.plugin.settings.prayerTimeOffsets?.[prayer] ?? 0))
          .onChange((value) => {
            const offset = Number(value);
            if (Number.isInteger(offset) && Math.abs(offset) <= 180) {
              this.plugin.settings.prayerTimeOffsets = {
                ...this.plugin.settings.prayerTimeOffsets,
                [prayer]: offset,
              };
              void this.plugin.saveAndRefresh();
            }
          }));
    }
    new Setting(container)
      .setName("Hijri rollover")
      .setDesc("Use the location's sunset or local midnight.")
      .addDropdown((dropdown) => dropdown
        .addOption("maghrib", "After sunset")
        .addOption("midnight", "At midnight")
        .setValue(this.plugin.settings.hijriRollover)
        .onChange((value) => {
          this.plugin.settings.hijriRollover = value as Settings["hijriRollover"];
          void this.plugin.saveAndRefresh();
        }));
    new Setting(container)
      .setName("Default calendar month style")
      .setDesc("Default month style for the prayer calendar.")
      .addDropdown((dropdown) => dropdown
        .addOption("hijri", "Hijri months")
        .addOption("gregorian", "Gregorian months")
        .setValue(this.plugin.settings.calendarMonthStyle)
        .onChange((value) => {
          this.plugin.settings.calendarMonthStyle = value as Settings["calendarMonthStyle"];
          void this.plugin.persistSettings();
        }));

    new Setting(container).setName("Status bar").setHeading();
    new Setting(container)
      .setName("Show status bar item")
      .setDesc("Show or hide the status-bar countdown.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.statusBarVisible).onChange((value) => {
        this.plugin.settings.statusBarVisible = value;
        this.plugin.applyStatusBarVisibility();
        void this.plugin.persistSettings();
      }));
    const templateSetting = new Setting(container)
      .setName("Status bar template")
      .setDesc("Tokens: {next}, {time}, {countdown}, {hijri}, {hijri:month}, {hijri:long}, {location}.")
      .addTextArea((text) => {
        text
          .setPlaceholder(DEFAULTS.statusTemplate)
          .setValue(this.plugin.settings.statusTemplate || DEFAULTS.statusTemplate)
          .onChange((value) => {
            this.plugin.settings.statusTemplate = value;
            void this.plugin.persistSettings();
          });
        text.inputEl.rows = 3;
        text.inputEl.addClass("salah-template-input");
      });
    templateSetting.settingEl.addClass("salah-template-setting");

    new Setting(container).setName("Countdown colors").setHeading();
    new Setting(container)
      .setName("Red countdown threshold (minutes)")
      .setDesc("Red countdown threshold in minutes. Default: 5.")
      .addText((text) => text.setValue(String(this.plugin.settings.countdownRedMinutes)).onChange((value) =>
        this.updateMinutes(value, "countdownRedMinutes", 1, 1440)));
    new Setting(container)
      .setName("Orange countdown threshold (minutes)")
      .setDesc("Orange applies below this value; normal color applies above. Default: 20.")
      .addText((text) => text.setValue(String(this.plugin.settings.countdownNormalMinutes)).onChange((value) =>
        this.updateMinutes(value, "countdownNormalMinutes", 1, 1440)));
    this.addColorSetting(container, "Red countdown color", "countdownRedColor");
    this.addColorSetting(container, "Orange countdown color", "countdownOrangeColor");
    this.addColorSetting(container, "Normal countdown color", "countdownNormalColor");
    new Setting(container)
      .setName("Use Obsidian theme for normal countdown color")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.countdownNormalUsesTheme).onChange((value) => {
        this.plugin.settings.countdownNormalUsesTheme = value;
        void this.plugin.persistSettings();
      }));

    new Setting(container).setName("Notifications").setHeading();
    new Setting(container)
      .setName("Prayer time notifications")
      .setDesc("Notify when enabled events occur.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.notificationsEnabled).onChange((value) => {
        this.plugin.settings.notificationsEnabled = value;
        void this.plugin.persistSettings();
      }));
    new Setting(container)
      .setName("Play notification sound")
      .setDesc("Play a tone with notifications.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.notificationSound).onChange((value) => {
        this.plugin.settings.notificationSound = value;
        void this.plugin.persistSettings();
      }));
    new Setting(container)
      .setName("Notification volume")
      .addSlider((slider) => slider.setLimits(0, 100, 5).setValue(this.plugin.settings.notificationVolume).onChange((value) => {
        this.plugin.settings.notificationVolume = value;
        void this.plugin.persistSettings();
      }))
      .addButton((button) => button.setButtonText("Test sound").onClick(() => this.plugin.playNotificationSound()));
    new Setting(container)
      .setName("Per-event notification settings")
      .setDesc("Choose at-time and advance alerts for each event.")
      .addButton((button) => button.setButtonText("Configure events…").onClick(() => this.openEventNotificationSettings()));
    new Setting(container)
      .setName("Prayer/custom time advance notification (minutes)")
      .setDesc("Minutes before prayer or custom events; 0 disables.")
      .addText((text) => text.setPlaceholder("0").setValue(String(this.plugin.settings.prayerReminderMinutes)).onChange((value) =>
        this.updateMinutes(value, "prayerReminderMinutes")));
    new Setting(container)
      .setName("Iqama advance notification (minutes)")
      .setDesc("Minutes before Iqama; 0 disables.")
      .addText((text) => text.setPlaceholder("0").setValue(String(this.plugin.settings.iqamaReminderMinutes)).onChange((value) =>
        this.updateMinutes(value, "iqamaReminderMinutes")));

    this.addCustomTimes(container);
    this.addIqamaSettings(container);

    new Setting(container).setName("Other").setHeading();
    new Setting(container)
      .setName("Refresh interval (minutes)")
      .setDesc("Minutes between automatic refreshes.")
      .addText((text) => text.setValue(String(this.plugin.settings.refreshMinutes)).onChange((value) => {
        const minutes = Number(value);
        if (Number.isInteger(minutes) && minutes >= 5) {
          this.plugin.settings.refreshMinutes = minutes;
          void this.plugin.saveAndRefresh();
        }
      }));
    new Setting(container)
      .setName("Use 24-hour time")
      .setDesc("Use 24-hour time in the status bar and schedule.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.use24HourTime).onChange((value) => {
        this.plugin.settings.use24HourTime = value;
        void this.plugin.persistSettings();
      }));
  }

  openEventNotificationSettings(): void {
    const events = this.plugin.schedule
      ? buildConfiguredEvents(this.plugin.schedule, this.plugin.settings)
      : configuredFallbackEvents(this.plugin.settings);
    new EventNotificationModal(this.app, events, this.plugin.settings.eventNotifications, (updated) => {
      this.plugin.settings.eventNotifications = updated;
      void this.plugin.persistSettings();
    }).open();
  }

  /** Validate a minute setting before persisting it; invalid input leaves the old value. */
  updateMinutes(value: string, key: NumericSettingKey, min = 0, max = 1439): void {
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < min || minutes > max) return;
    this.plugin.settings[key] = minutes;
    void this.plugin.persistSettings();
  }

  addColorSetting(container: HTMLElement, label: string, key: ColorSettingKey): void {
    const defaults: Record<ColorSettingKey, string> = {
      countdownRedColor: "#dc5082",
      countdownOrangeColor: "#ffa500",
      countdownNormalColor: "#cdd6f4",
    };
    new Setting(container)
      .setName(label)
      .addColorPicker((picker) => picker.setValue(this.plugin.settings[key] || defaults[key]).onChange((color) => {
        this.plugin.settings[key] = color;
        void this.plugin.persistSettings();
      }));
  }

  /** Build custom daily-time rows; the picker writes back into the in-progress add form. */
  addCustomTimes(container: HTMLElement): void {
    new Setting(container).setName("Custom daily times").setHeading();
    container.createEl("p", { text: "Add daily reminders or custom events in 24-hour time." });
    let name = "";
    let time = "";
    new Setting(container)
      .setName("Add custom time")
      .addText((text) => text.setPlaceholder("Name (e.g. Evening)").onChange((value) => {
        name = value;
      }))
      .addText((text) => {
        text.setPlaceholder("Hh:mm").onChange((value) => {
          time = value;
        });
        text.inputEl.addClass("salah-new-custom-time");
      })
      .addButton((button) => button.setIcon("clock").setTooltip("Choose time").onClick(() => {
        new TimePickerModal(this.app, time || "00:00", (value) => {
          time = value;
          const input = container.querySelector<HTMLInputElement>(".salah-new-custom-time");
          if (input) input.value = value;
        }).open();
      }))
      .addButton((button) => button.setButtonText("Add").onClick(() => {
        const cleanName = name.trim();
        if (!cleanName || parseTime(time) === null) {
          new Notice("Enter a name and a valid time in hh:mm format.", 10_000);
          return;
        }
        this.plugin.settings.customTimes.push({ name: cleanName, time });
        void this.plugin.persistSettings();
        this.refreshAtCurrentScroll();
      }));
    for (const [index, event] of this.plugin.settings.customTimes.entries()) {
      new Setting(container)
        .setName(event.name)
        .setDesc(clock(event.time))
        .addButton((button) => button.setButtonText("Remove").onClick(() => {
          this.plugin.settings.customTimes.splice(index, 1);
          void this.plugin.persistSettings();
          this.refreshAtCurrentScroll();
        }));
    }
  }

  addIqamaSettings(container: HTMLElement): void {
    new Setting(container).setName("Iqama times").setHeading();
    container.createEl("p", { text: "Choose a fixed time or offset; negative offsets are allowed." });
    for (const prayer of ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha", "Tahajjud"]) {
      const rule = this.plugin.settings.iqama[prayer] ?? { mode: "disabled" };
      const row = new Setting(container)
        .setName(prayer === "Sunrise" ? "Duha prayer" : prayer === "Tahajjud" ? "Tahajjud Qiyam" : prayer + " Iqama")
        .addDropdown((dropdown) => addIqamaRuleOptions(dropdown, prayer).setValue(iqamaRuleSelection(prayer, rule)).onChange((value) => {
          this.plugin.settings.iqama[prayer] = iqamaRuleForSelection(prayer, value, rule);
          void this.plugin.persistSettings();
          this.refreshAtCurrentScroll();
        }));
      row.settingEl.addClass("salah-iqama-setting");
      if (rule.mode === "fixed") {
        row.addText((text) => {
          text.setPlaceholder("Hh:mm").setValue(rule.time).onChange((value) => {
            if (parseTime(value) !== null) {
              this.plugin.settings.iqama[prayer] = { mode: "fixed", time: value };
              void this.plugin.persistSettings();
            }
          });
          text.inputEl.addClass("salah-iqama-time");
        }).addButton((button) => button.setIcon("clock").setTooltip("Choose time").onClick(() => {
          const input = row.settingEl.querySelector<HTMLInputElement>(".salah-iqama-time");
          const current = input?.value || "05:00";
          new TimePickerModal(this.app, current, (value) => {
            this.plugin.settings.iqama[prayer] = { mode: "fixed", time: value };
            if (input) input.value = value;
            void this.plugin.persistSettings();
          }).open();
        }));
      } else if (rule.mode === "offset") {
        const state: { input: HTMLInputElement | null } = { input: null };
        row.addText((text) => {
          text.setPlaceholder("Minutes").setValue(String(rule.minutes)).onChange((value) => {
            const minutes = Number(value);
            if (value.trim() && Number.isInteger(minutes)) {
              this.plugin.settings.iqama[prayer] = offsetRule(minutes, rule.from);
              void this.plugin.persistSettings();
            }
          });
          state.input = text.inputEl;
        }).addButton((button) => button.setButtonText("−").setTooltip("Decrease offset by one minute").onClick(() => {
          const minutes = Math.trunc(Number(state.input?.value) || 0) - 1;
          this.plugin.settings.iqama[prayer] = offsetRule(minutes, rule.from);
          if (state.input) state.input.value = String(minutes);
          void this.plugin.persistSettings();
        })).addButton((button) => button.setButtonText("+").setTooltip("Increase offset by one minute").onClick(() => {
          const minutes = Math.trunc(Number(state.input?.value) || 0) + 1;
          this.plugin.settings.iqama[prayer] = offsetRule(minutes, rule.from);
          if (state.input) state.input.value = String(minutes);
          void this.plugin.persistSettings();
        }));
      }
    }
  }
}
