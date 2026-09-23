import { Modal, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { App } from "obsidian";
import { CALCULATION_METHODS } from "./src/calculation-methods";
import { detectLocation, valid } from "./src/location";
import { addIqama, loadSchedule } from "./src/prayer-times";
import { renderStatusTemplate } from "./src/status-template";
import { clock, countdown, nextEvent, parseTime } from "./src/time";
import { Coordinates, Schedule, Settings } from "./src/types";

const DEFAULTS: Settings = {
  coordinates: null,
  locationName: "",
  calculationMethod: 1,
  hijriOffset: 0,
  hijriRollover: "maghrib",
  refreshMinutes: 30,
  statusTemplate: "{next}: {time} ({countdown}) · {hijri}",
  notificationsEnabled: true,
  notificationSound: false,
  notificationVolume: 35,
  notifiedTimeKeys: [],
  prayerReminderMinutes: 0,
  iqamaReminderMinutes: 0,
  countdownRedMinutes: 5,
  countdownNormalMinutes: 20,
  countdownRedColor: "#dc5082",
  countdownOrangeColor: "#ffa500",
  countdownNormalColor: "",
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

type ConfiguredEvent = { name: string; time: string; kind: "prayer" | "iqama" | "custom" };

export default class SalahPlugin extends Plugin {
  settings: Settings = DEFAULTS;
  schedule: Schedule | null = null;
  statusBar!: HTMLElement;
  minuteTimer = 0;
  refreshTimer = 0;
  loadingLocation = false;

  async onload() {
    const saved = (await this.loadData()) || {};
    this.settings = { ...DEFAULTS, ...saved };
    this.settings.iqama = { ...DEFAULTS.iqama, ...this.settings.iqama };
    this.settings.customTimes = this.settings.customTimes || [];
    this.settings.notifiedTimeKeys = this.settings.notifiedTimeKeys || [];

    this.statusBar = this.addStatusBarItem();
    this.statusBar.addClass("salah-hijri-status");
    this.statusBar.onClickEvent(() => this.openSchedule());
    this.addSettingTab(new SalahSettingsTab(this.app, this));

    void this.initialize();
  }

  onunload() {
    window.clearTimeout(this.minuteTimer);
    window.clearInterval(this.refreshTimer);
  }

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

  async setLocation(coordinates: Coordinates, name: string) {
    if (!valid(coordinates)) {
      new Notice("Coordinates must be latitude −90 to 90 and longitude −180 to 180.", 10_000);
      return;
    }
    this.settings.coordinates = coordinates;
    this.settings.locationName = name || "Manual location";
    await this.saveData(this.settings);
    await this.refreshSchedule();
    new Notice("Location saved.", 10_000);
  }

  async persistSettings() {
    await this.saveData(this.settings);
    this.renderStatus();
  }

  async saveAndRefresh() {
    await this.saveData(this.settings);
    await this.refreshSchedule();
  }

  async refreshSchedule() {
    if (!this.settings.coordinates) return;
    try {
      this.schedule = await loadSchedule(this.settings);
      this.tick();
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = window.setInterval(
        () => void this.refreshSchedule(),
        Math.max(5, this.settings.refreshMinutes) * 60_000,
      );
    } catch (error) {
      new Notice("Couldn't refresh prayer times: " + (error instanceof Error ? error.message : "unknown error"), 10_000);
      this.renderStatus();
    }
  }

  tick() {
    this.renderStatus();
    this.checkNotifications();
    window.clearTimeout(this.minuteTimer);
    this.minuteTimer = window.setTimeout(() => this.tick(), 60_000 - (Date.now() % 60_000) + 50);
  }

  checkNotifications() {
    if (!this.schedule || !this.settings.notificationsEnabled) return;

    const now = new Date();
    const nowMinute = now.getHours() * 60 + now.getMinutes();
    const events = addIqama(this.schedule, this.settings) as ConfiguredEvent[];
    const seen = new Set(this.settings.notifiedTimeKeys || []);
    const messages: string[] = [];

    const remember = (key: string, message: string) => {
      if (seen.has(key)) return;
      seen.add(key);
      messages.push(message);
    };

    for (const event of events) {
      const eventMinute = parseTime(event.time);
      if (eventMinute === null) continue;

      const isIqama = event.kind === "iqama";
      const lead = isIqama ? this.settings.iqamaReminderMinutes : this.settings.prayerReminderMinutes;
      const target = new Date(now);
      target.setHours(Math.floor(eventMinute / 60), eventMinute % 60, 0, 0);
      if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);

      const eventDate = this.dateKey(target);
      if (eventMinute === nowMinute) {
        remember(this.dateKey(now) + "|reached|" + event.kind + "|" + event.name + "|" + event.time,
          event.name + " time reached (" + clock(event.time) + ")");
      }

      if (lead > 0 && Math.ceil((target.getTime() - now.getTime()) / 60_000) === lead) {
        remember(eventDate + "|before-" + lead + "|" + event.kind + "|" + event.name + "|" + event.time,
          lead + " minute" + (lead === 1 ? "" : "s") + " until " + event.name + " (" + clock(event.time) + ")");
      }
    }

    if (messages.length === 0) return;
    this.settings.notifiedTimeKeys = [...seen].slice(-200);
    void this.saveData(this.settings).catch(error => console.error("Couldn't save notification history.", error));
    new Notice(messages.join("\n"), 10_000);
    if (this.settings.notificationSound) this.playNotificationSound();
  }

  dateKey(date: Date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" +
      String(date.getDate()).padStart(2, "0");
  }

  playNotificationSound() {
    try {
      if (this.settings.notificationVolume <= 0) return;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(this.settings.notificationVolume / 100 * 0.08, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.35);
      oscillator.onended = () => void context.close();
    } catch (error) {
      console.warn("Unable to play Salah notification sound.", error);
    }
  }

  renderStatus() {
    if (!this.statusBar) return;
    if (!this.schedule) {
      this.statusBar.setText("Salah: set location");
      return;
    }

    const events = addIqama(this.schedule, this.settings);
    const next = nextEvent(events, new Date());
    if (!next) return;

    const template = this.settings.statusTemplate || DEFAULTS.statusTemplate;
    

    const minutesLeft = Math.floor(next.delta / 60_000);
    let color = this.settings.countdownNormalColor;
    if (minutesLeft <= this.settings.countdownRedMinutes) color = this.settings.countdownRedColor;
    else if (minutesLeft < this.settings.countdownNormalMinutes) color = this.settings.countdownOrangeColor;
    renderStatusTemplate(this.statusBar, template, next, this.schedule, color);

    this.statusBar.title = events.map(event => event.name + ": " + clock(event.time)).join("\n") +
      "\nHijri: " + this.schedule.hijriDate + "\nLocation: " + this.schedule.locationName;
  }

  openSchedule() {
    if (!this.schedule) {
      new Notice("Prayer schedule unavailable. Set a location in plugin settings.", 10_000);
      return;
    }
    const events = addIqama(this.schedule, this.settings);
    const rows = events.map(event => event.name + ": " + clock(event.time));
    rows.push("", "Hijri date: " + this.schedule.hijriDate, "Location: " + this.schedule.locationName);
    new ScheduleModal(this.app, rows.join("\n")).open();
  }
}

class ScheduleModal extends Modal {
  constructor(app: App, private readonly content: string) { super(app); }
  onOpen() { this.contentEl.createEl("pre", { text: this.content }); }
}

class SalahSettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: SalahPlugin) { super(app, plugin); }

  private refreshAtCurrentScroll() {
    const pane = this.containerEl.closest(".vertical-tab-content") as HTMLElement | null;
    const top = pane?.scrollTop ?? 0;
    this.display();
    requestAnimationFrame(() => { if (pane) pane.scrollTop = top; });
  }

  display() {
    const container = this.containerEl;
    container.empty();
    container.createEl("h2", { text: "Salah & Hijri Times" });

    new Setting(container).setName("Location")
      .setDesc(this.plugin.settings.locationName || "No location detected yet.")
      .addButton(button => button.setButtonText("Detect location").onClick(() => {
        void this.plugin.detectAgain(false).then(() => this.refreshAtCurrentScroll());
      }));

    let latitude = this.plugin.settings.coordinates?.latitude ?? 0;
    let longitude = this.plugin.settings.coordinates?.longitude ?? 0;
    let locationName = this.plugin.settings.locationName;

    new Setting(container).setName("Latitude")
      .setDesc("Decimal degrees (−90 south to 90 north). New York example: 40.7128.")
      .addText(text => text.setPlaceholder("e.g. 40.7128").setValue(this.plugin.settings.coordinates ? String(latitude) : "")
        .onChange(value => latitude = value.trim() ? Number(value) : NaN));
    new Setting(container).setName("Longitude")
      .setDesc("Decimal degrees (−180 west to 180 east). New York example: −74.0060. West is negative.")
      .addText(text => text.setPlaceholder("e.g. -74.0060").setValue(this.plugin.settings.coordinates ? String(longitude) : "")
        .onChange(value => longitude = value.trim() ? Number(value) : NaN));
    new Setting(container).setName("Location name")
      .addText(text => text.setValue(locationName).onChange(value => locationName = value));
    new Setting(container).addButton(button => button.setButtonText("Save location")
      .onClick(() => void this.plugin.setLocation({ latitude, longitude }, locationName || "Manual location")));

    new Setting(container).setName("Calculation method")
      .setDesc("Use the convention followed by your local mosque or authority.")
      .addDropdown(dropdown => {
        for (const method of CALCULATION_METHODS) dropdown.addOption(String(method.id), method.label);
        return dropdown.setValue(String(this.plugin.settings.calculationMethod))
          .onChange(value => { this.plugin.settings.calculationMethod = Number(value); void this.plugin.saveAndRefresh(); });
      });

    new Setting(container).setName("Hijri offset (days)")
      .addText(text => text.setValue(String(this.plugin.settings.hijriOffset)).onChange(value => {
        const offset = Number(value);
        if (Number.isInteger(offset) && Math.abs(offset) <= 30) {
          this.plugin.settings.hijriOffset = offset;
          void this.plugin.saveAndRefresh();
        }
      }));
    new Setting(container).setName("Hijri rollover")
      .addDropdown(dropdown => dropdown.addOption("maghrib", "After Maghrib")
        .addOption("midnight", "At midnight")
        .setValue(this.plugin.settings.hijriRollover)
        .onChange(value => {
          this.plugin.settings.hijriRollover = value as Settings["hijriRollover"];
          void this.plugin.saveAndRefresh();
        }));
    new Setting(container).setName("Refresh interval (minutes)")
      .addText(text => text.setValue(String(this.plugin.settings.refreshMinutes)).onChange(value => {
        const minutes = Number(value);
        if (Number.isInteger(minutes) && minutes >= 5) {
          this.plugin.settings.refreshMinutes = minutes;
          void this.plugin.saveAndRefresh();
        }
      }));

    new Setting(container).setName("Status bar template")
      .setDesc("Tokens: {next}, {time}, {countdown}, {hijri} (DD/MM/YYYY), {hijri:month}, {hijri:long}, {location}.")
      .addText(text => text.setPlaceholder(DEFAULTS.statusTemplate)
        .setValue(this.plugin.settings.statusTemplate || DEFAULTS.statusTemplate)
        .onChange(value => { this.plugin.settings.statusTemplate = value; void this.plugin.persistSettings(); }));

    new Setting(container).setName("Prayer time notifications")
      .setDesc("Show a notice when prayer, custom, or Iqama times are reached.")
      .addToggle(toggle => toggle.setValue(this.plugin.settings.notificationsEnabled).onChange(value => {
        this.plugin.settings.notificationsEnabled = value;
        void this.plugin.persistSettings();
      }));
    new Setting(container).setName("Play notification sound")
      .setDesc("Play a short tone when a notification appears.")
      .addToggle(toggle => toggle.setValue(this.plugin.settings.notificationSound).onChange(value => {
        this.plugin.settings.notificationSound = value;
        void this.plugin.persistSettings();
      }));
    new Setting(container).setName("Notification volume")
      .addSlider(slider => slider.setLimits(0, 100, 5).setValue(this.plugin.settings.notificationVolume)
        .setDynamicTooltip().onChange(value => {
          this.plugin.settings.notificationVolume = value;
          void this.plugin.persistSettings();
        }));

    new Setting(container).setName("Prayer/custom time advance notice (minutes)")
      .setDesc("0 disables it. Applies to prayers, Sunrise, Tahajjud, and custom times.")
      .addText(text => text.setPlaceholder("0").setValue(String(this.plugin.settings.prayerReminderMinutes))
        .onChange(value => this.updateMinutes(value, "prayerReminderMinutes")));
    new Setting(container).setName("Iqama advance notice (minutes)")
      .setDesc("0 disables advance notices for Iqama events.")
      .addText(text => text.setPlaceholder("0").setValue(String(this.plugin.settings.iqamaReminderMinutes))
        .onChange(value => this.updateMinutes(value, "iqamaReminderMinutes")));

    new Setting(container).setName("Red countdown threshold (minutes)")
      .setDesc("At or below this remaining time, use the red color. Default: 5.")
      .addText(text => text.setValue(String(this.plugin.settings.countdownRedMinutes))
        .onChange(value => this.updateMinutes(value, "countdownRedMinutes", 1, 1440)));
    new Setting(container).setName("Normal countdown from (minutes)")
      .setDesc("At or above this time use the normal color; between thresholds is orange. Default: 20.")
      .addText(text => text.setValue(String(this.plugin.settings.countdownNormalMinutes))
        .onChange(value => this.updateMinutes(value, "countdownNormalMinutes", 1, 1440)));
    this.addColorSetting(container, "Red countdown color", "countdownRedColor");
    this.addColorSetting(container, "Orange countdown color", "countdownOrangeColor");
    this.addColorSetting(container, "Normal countdown color (blank uses theme)", "countdownNormalColor", true);

    this.addCustomTimes(container);
    this.addIqamaSettings(container);
  }

  private updateMinutes(value: string, key: "prayerReminderMinutes" | "iqamaReminderMinutes" | "countdownRedMinutes" | "countdownNormalMinutes", min = 0, max = 1439) {
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < min || minutes > max) return;
    this.plugin.settings[key] = minutes;
    void this.plugin.persistSettings();
  }

  private addColorSetting(container: HTMLElement, label: string, key: "countdownRedColor" | "countdownOrangeColor" | "countdownNormalColor", allowBlank = false) {
    new Setting(container).setName(label)
      .setDesc("Use a #RRGGBB color." + (allowBlank ? " Leave blank to use the Obsidian theme color." : ""))
      .addText(text => text.setPlaceholder(allowBlank ? "Theme default" : "#dc5082")
        .setValue(this.plugin.settings[key])
        .onChange(value => {
          const color = value.trim();
          if ((allowBlank && color === "") || /^#[0-9a-f]{6}$/i.test(color)) {
            this.plugin.settings[key] = color;
            void this.plugin.persistSettings();
          }
        }));
  }

  private addCustomTimes(container: HTMLElement) {
    container.createEl("h3", { text: "Custom daily times" });
    container.createEl("p", { text: "Add events such as midnight, a personal reminder, or another daily time (24-hour HH:mm)." });
    let name = "";
    let time = "";
    new Setting(container).setName("Add custom time")
      .addText(text => text.setPlaceholder("Name (e.g. Midnight)").onChange(value => name = value))
      .addText(text => text.setPlaceholder("HH:mm").onChange(value => time = value))
      .addButton(button => button.setButtonText("Add").onClick(() => {
        const cleanName = name.trim();
        if (!cleanName || parseTime(time) === null) {
          new Notice("Enter a name and a valid time in HH:mm format.", 10_000);
          return;
        }
        this.plugin.settings.customTimes.push({ name: cleanName, time });
        void this.plugin.persistSettings();
        this.refreshAtCurrentScroll();
      }));

    for (const [index, event] of this.plugin.settings.customTimes.entries()) {
      new Setting(container).setName(event.name).setDesc(clock(event.time))
        .addButton(button => button.setButtonText("Remove").onClick(() => {
          this.plugin.settings.customTimes.splice(index, 1);
          void this.plugin.persistSettings();
          this.refreshAtCurrentScroll();
        }));
    }
  }

  private addIqamaSettings(container: HTMLElement) {
    container.createEl("h3", { text: "Iqama times" });
    container.createEl("p", { text: "For each prayer, disable Iqama, set a fixed time, or set an offset from that prayer. Negative offsets are supported." });
    for (const prayer of ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha", "Tahajjud"]) {
      const rule = this.plugin.settings.iqama[prayer] || { mode: "disabled" as const };
      const row = new Setting(container).setName(prayer + " Iqama")
        .addDropdown(dropdown => dropdown.addOption("disabled", "Disabled")
          .addOption("fixed", "Fixed time")
          .addOption("offset", "Offset from prayer")
          .setValue(rule.mode)
          .onChange(value => {
            this.plugin.settings.iqama[prayer] = value === "fixed"
              ? { mode: "fixed", time: "05:00" }
              : value === "offset" ? { mode: "offset", minutes: 0 } : { mode: "disabled" };
            void this.plugin.persistSettings();
            this.refreshAtCurrentScroll();
          }));

      if (rule.mode === "fixed") {
        row.addText(text => text.setPlaceholder("HH:mm").setValue(rule.time).onChange(value => {
          if (parseTime(value) !== null) {
            this.plugin.settings.iqama[prayer] = { mode: "fixed", time: value };
            void this.plugin.persistSettings();
          }
        }));
      } else if (rule.mode === "offset") {
        row.addText(text => text.setPlaceholder("Minutes").setValue(String(rule.minutes)).onChange(value => {
          const minutes = Number(value);
          if (Number.isInteger(minutes)) {
            this.plugin.settings.iqama[prayer] = { mode: "offset", minutes };
            void this.plugin.persistSettings();
          }
        }));
      }
    }
  }
}
