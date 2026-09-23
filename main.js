var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => SalahPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

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

// src/location.ts
var import_obsidian = require("obsidian");
function valid(coordinates) {
  return Number.isFinite(coordinates.latitude) && coordinates.latitude >= -90 && coordinates.latitude <= 90 && Number.isFinite(coordinates.longitude) && coordinates.longitude >= -180 && coordinates.longitude <= 180;
}
function asLocation(data) {
  var _a, _b;
  const coordinates = { latitude: (_a = data.latitude) != null ? _a : NaN, longitude: (_b = data.longitude) != null ? _b : NaN };
  if (!valid(coordinates)) throw new Error("The provider returned invalid coordinates.");
  const place = data;
  const name = [place.city, place.region, place.country || place.country_name].filter(Boolean).join(", ");
  return { coordinates, name: name || "Approximate IP location" };
}
async function detectLocation(announceSuccess = true) {
  const providers = [
    async () => {
      const response = await (0, import_obsidian.requestUrl)({ url: "https://ipwho.is/", method: "GET" });
      const data = response.json;
      if (data.success === false) throw new Error("IPWho could not locate this network.");
      return asLocation(data);
    },
    async () => {
      const response = await (0, import_obsidian.requestUrl)({ url: "https://ipapi.co/json/", method: "GET" });
      const data = response.json;
      if (data.error) throw new Error("ipapi could not locate this network.");
      return asLocation(data);
    }
  ];
  for (const provider of providers) {
    try {
      const result = await provider();
      if (announceSuccess) new import_obsidian.Notice("Approximate location detected: " + result.name + ". Review it in settings.", 1e4);
      return result;
    } catch (error) {
      console.warn("Salah & Hijri Times IP location provider failed.", error);
    }
  }
  new import_obsidian.Notice("Automatic location detection failed. Enter latitude and longitude in plugin settings.", 1e4);
  throw new Error("No IP location provider returned valid coordinates.");
}

// src/time.ts
function parseTime(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = +m[1], n = +m[2];
  return h < 24 && n < 60 ? h * 60 + n : null;
}
function formatTime(n) {
  n = (n % 1440 + 1440) % 1440;
  return String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
}
function clock(s) {
  const n = parseTime(s);
  if (n === null) return s;
  const h = Math.floor(n / 60);
  return (h % 12 || 12) + ":" + String(n % 60).padStart(2, "0") + (h >= 12 ? " pm" : " am");
}
function nextEvent(events, now) {
  let best = null;
  for (const e of events) {
    const n = parseTime(e.time);
    if (n === null) continue;
    const d = new Date(now);
    d.setHours(Math.floor(n / 60), n % 60, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    const delta = d.getTime() - now.getTime();
    if (!best || delta < best.delta) best = { name: e.name, time: e.time, delta };
  }
  return best;
}
function countdown(ms) {
  const n = Math.max(0, Math.floor(ms / 6e4)), h = Math.floor(n / 60);
  return h ? h + "h " + String(n % 60).padStart(2, "0") + "m" : n + "m";
}

// src/prayer-times.ts
var months = ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];
function shift(d, m, y, n) {
  while (n > 0) {
    d++;
    if (d > 30) {
      d = 1;
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    n--;
  }
  while (n < 0) {
    d--;
    if (d < 1) {
      m--;
      if (m < 1) {
        m = 12;
        y--;
      }
      d = 30;
    }
    n++;
  }
  return [d, m, y];
}
async function loadSchedule(s, now = /* @__PURE__ */ new Date()) {
  if (!s.coordinates) throw Error("Set location in plugin settings.");
  const c = s.coordinates, date = now.getDate() + "-" + (now.getMonth() + 1) + "-" + now.getFullYear(), q = new URLSearchParams({ latitude: String(c.latitude), longitude: String(c.longitude), method: String(s.calculationMethod) }), r = await fetch("https://api.aladhan.com/v1/timings/" + date + "?" + q, { signal: AbortSignal.timeout(12e3) });
  if (!r.ok) throw Error("Prayer service HTTP " + r.status);
  const p = await r.json();
  if (p.code !== 200) throw Error("No prayer timings returned.");
  const t = p.data.timings, base = { Fajr: t.Fajr, Sunrise: t.Sunrise, Dhuhr: t.Dhuhr, Asr: t.Asr, Maghrib: t.Maghrib, Isha: t.Isha };
  const mg = parseTime(t.Maghrib), fr = parseTime(t.Fajr);
  if (mg !== null && fr !== null) base.Tahajjud = formatTime(Math.floor(mg + (fr + 1440 - mg) * 2 / 3));
  const h = p.data.date.hijri;
  let [d, m, y] = shift(parseInt(h.day, 10), h.month.number, parseInt(h.year, 10), s.hijriOffset);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (s.hijriRollover === "maghrib" && nowMin >= (mg != null ? mg : 1440)) [d, m, y] = shift(d, m, y, 1);
  return { prayers: Object.entries(base).map(([name, time]) => ({ name, time })), hijriDate: d + " " + months[m - 1] + " " + y + " AH", hijriNumeric: String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0") + "/" + y, hijriMonth: String(m).padStart(2, "0"), maghrib: t.Maghrib, locationName: s.locationName };
}
function addIqama(sch, s) {
  const out = sch.prayers.map((event) => ({ ...event, kind: "prayer" }));
  for (const [n, r] of Object.entries(s.iqama)) {
    if (r.mode === "disabled") continue;
    const p = sch.prayers.find((x) => x.name === n);
    const time = r.mode === "fixed" ? r.time : r.mode === "offset" && p ? formatTime((parseTime(p.time) || 0) + r.minutes) : "";
    if (time) out.push({ name: n + " Iqama", time, kind: "iqama" });
  }
  for (const event of s.customTimes || []) {
    if (event.name.trim() && parseTime(event.time) !== null) out.push({ name: event.name.trim(), time: event.time, kind: "custom" });
  }
  return out;
}

// src/status-template.ts
var TOKEN = /\{([a-z]+(?::[a-z/]+)?)\}/gi;
function renderStatusTemplate(container, template, next, schedule, countdownColor) {
  const values = {
    next: next.name,
    time: clock(next.time),
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
      countdownNode.style.color = countdownColor;
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
  refreshMinutes: 30,
  statusTemplate: "{next}: {time} ({countdown}) \xB7 {hijri}",
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
    Tahajjud: { mode: "disabled" }
  }
};
var SalahPlugin = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULTS;
    this.schedule = null;
    this.minuteTimer = 0;
    this.refreshTimer = 0;
    this.loadingLocation = false;
  }
  async onload() {
    const saved = await this.loadData() || {};
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
  async setLocation(coordinates, name) {
    if (!valid(coordinates)) {
      new import_obsidian2.Notice("Coordinates must be latitude \u221290 to 90 and longitude \u2212180 to 180.", 1e4);
      return;
    }
    this.settings.coordinates = coordinates;
    this.settings.locationName = name || "Manual location";
    await this.saveData(this.settings);
    await this.refreshSchedule();
    new import_obsidian2.Notice("Location saved.", 1e4);
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
        Math.max(5, this.settings.refreshMinutes) * 6e4
      );
    } catch (error) {
      new import_obsidian2.Notice("Couldn't refresh prayer times: " + (error instanceof Error ? error.message : "unknown error"), 1e4);
      this.renderStatus();
    }
  }
  tick() {
    this.renderStatus();
    this.checkNotifications();
    window.clearTimeout(this.minuteTimer);
    this.minuteTimer = window.setTimeout(() => this.tick(), 6e4 - Date.now() % 6e4 + 50);
  }
  checkNotifications() {
    if (!this.schedule || !this.settings.notificationsEnabled) return;
    const now = /* @__PURE__ */ new Date();
    const nowMinute = now.getHours() * 60 + now.getMinutes();
    const events = addIqama(this.schedule, this.settings);
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
      const lead = isIqama ? this.settings.iqamaReminderMinutes : this.settings.prayerReminderMinutes;
      const target = new Date(now);
      target.setHours(Math.floor(eventMinute / 60), eventMinute % 60, 0, 0);
      if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
      const eventDate = this.dateKey(target);
      if (eventMinute === nowMinute) {
        remember(
          this.dateKey(now) + "|reached|" + event.kind + "|" + event.name + "|" + event.time,
          event.name + " time reached (" + clock(event.time) + ")"
        );
      }
      if (lead > 0 && Math.ceil((target.getTime() - now.getTime()) / 6e4) === lead) {
        remember(
          eventDate + "|before-" + lead + "|" + event.kind + "|" + event.name + "|" + event.time,
          lead + " minute" + (lead === 1 ? "" : "s") + " until " + event.name + " (" + clock(event.time) + ")"
        );
      }
    }
    if (messages.length === 0) return;
    this.settings.notifiedTimeKeys = [...seen].slice(-200);
    void this.saveData(this.settings).catch((error) => console.error("Couldn't save notification history.", error));
    new import_obsidian2.Notice(messages.join("\n"), 1e4);
    if (this.settings.notificationSound) this.playNotificationSound();
  }
  dateKey(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
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
      gain.gain.exponentialRampToValueAtTime(1e-3, context.currentTime + 0.35);
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
    const next = nextEvent(events, /* @__PURE__ */ new Date());
    if (!next) return;
    const template = this.settings.statusTemplate || DEFAULTS.statusTemplate;
    const minutesLeft = Math.floor(next.delta / 6e4);
    let color = this.settings.countdownNormalColor;
    if (minutesLeft <= this.settings.countdownRedMinutes) color = this.settings.countdownRedColor;
    else if (minutesLeft < this.settings.countdownNormalMinutes) color = this.settings.countdownOrangeColor;
    renderStatusTemplate(this.statusBar, template, next, this.schedule, color);
    this.statusBar.title = events.map((event) => event.name + ": " + clock(event.time)).join("\n") + "\nHijri: " + this.schedule.hijriDate + "\nLocation: " + this.schedule.locationName;
  }
  openSchedule() {
    if (!this.schedule) {
      new import_obsidian2.Notice("Prayer schedule unavailable. Set a location in plugin settings.", 1e4);
      return;
    }
    const events = addIqama(this.schedule, this.settings);
    const rows = events.map((event) => event.name + ": " + clock(event.time));
    rows.push("", "Hijri date: " + this.schedule.hijriDate, "Location: " + this.schedule.locationName);
    new ScheduleModal(this.app, rows.join("\n")).open();
  }
};
var ScheduleModal = class extends import_obsidian2.Modal {
  constructor(app, content) {
    super(app);
    this.content = content;
  }
  onOpen() {
    this.contentEl.createEl("pre", { text: this.content });
  }
};
var SalahSettingsTab = class extends import_obsidian2.PluginSettingTab {
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
    container.createEl("h2", { text: "Salah & Hijri Times" });
    new import_obsidian2.Setting(container).setName("Location").setDesc(this.plugin.settings.locationName || "No location detected yet.").addButton((button) => button.setButtonText("Detect location").onClick(() => {
      void this.plugin.detectAgain(false).then(() => this.refreshAtCurrentScroll());
    }));
    let latitude = (_b = (_a = this.plugin.settings.coordinates) == null ? void 0 : _a.latitude) != null ? _b : 0;
    let longitude = (_d = (_c = this.plugin.settings.coordinates) == null ? void 0 : _c.longitude) != null ? _d : 0;
    let locationName = this.plugin.settings.locationName;
    new import_obsidian2.Setting(container).setName("Latitude").setDesc("Decimal degrees (\u221290 south to 90 north). New York example: 40.7128.").addText((text) => text.setPlaceholder("e.g. 40.7128").setValue(this.plugin.settings.coordinates ? String(latitude) : "").onChange((value) => latitude = value.trim() ? Number(value) : NaN));
    new import_obsidian2.Setting(container).setName("Longitude").setDesc("Decimal degrees (\u2212180 west to 180 east). New York example: \u221274.0060. West is negative.").addText((text) => text.setPlaceholder("e.g. -74.0060").setValue(this.plugin.settings.coordinates ? String(longitude) : "").onChange((value) => longitude = value.trim() ? Number(value) : NaN));
    new import_obsidian2.Setting(container).setName("Location name").addText((text) => text.setValue(locationName).onChange((value) => locationName = value));
    new import_obsidian2.Setting(container).addButton((button) => button.setButtonText("Save location").onClick(() => void this.plugin.setLocation({ latitude, longitude }, locationName || "Manual location")));
    new import_obsidian2.Setting(container).setName("Calculation method").setDesc("Use the convention followed by your local mosque or authority.").addDropdown((dropdown) => {
      for (const method of CALCULATION_METHODS) dropdown.addOption(String(method.id), method.label);
      return dropdown.setValue(String(this.plugin.settings.calculationMethod)).onChange((value) => {
        this.plugin.settings.calculationMethod = Number(value);
        void this.plugin.saveAndRefresh();
      });
    });
    new import_obsidian2.Setting(container).setName("Hijri offset (days)").addText((text) => text.setValue(String(this.plugin.settings.hijriOffset)).onChange((value) => {
      const offset = Number(value);
      if (Number.isInteger(offset) && Math.abs(offset) <= 30) {
        this.plugin.settings.hijriOffset = offset;
        void this.plugin.saveAndRefresh();
      }
    }));
    new import_obsidian2.Setting(container).setName("Hijri rollover").addDropdown((dropdown) => dropdown.addOption("maghrib", "After Maghrib").addOption("midnight", "At midnight").setValue(this.plugin.settings.hijriRollover).onChange((value) => {
      this.plugin.settings.hijriRollover = value;
      void this.plugin.saveAndRefresh();
    }));
    new import_obsidian2.Setting(container).setName("Refresh interval (minutes)").addText((text) => text.setValue(String(this.plugin.settings.refreshMinutes)).onChange((value) => {
      const minutes = Number(value);
      if (Number.isInteger(minutes) && minutes >= 5) {
        this.plugin.settings.refreshMinutes = minutes;
        void this.plugin.saveAndRefresh();
      }
    }));
    new import_obsidian2.Setting(container).setName("Status bar template").setDesc("Tokens: {next}, {time}, {countdown}, {hijri} (DD/MM/YYYY), {hijri:month}, {hijri:long}, {location}.").addText((text) => text.setPlaceholder(DEFAULTS.statusTemplate).setValue(this.plugin.settings.statusTemplate || DEFAULTS.statusTemplate).onChange((value) => {
      this.plugin.settings.statusTemplate = value;
      void this.plugin.persistSettings();
    }));
    new import_obsidian2.Setting(container).setName("Prayer time notifications").setDesc("Show a notice when prayer, custom, or Iqama times are reached.").addToggle((toggle) => toggle.setValue(this.plugin.settings.notificationsEnabled).onChange((value) => {
      this.plugin.settings.notificationsEnabled = value;
      void this.plugin.persistSettings();
    }));
    new import_obsidian2.Setting(container).setName("Play notification sound").setDesc("Play a short tone when a notification appears.").addToggle((toggle) => toggle.setValue(this.plugin.settings.notificationSound).onChange((value) => {
      this.plugin.settings.notificationSound = value;
      void this.plugin.persistSettings();
    }));
    new import_obsidian2.Setting(container).setName("Notification volume").addSlider((slider) => slider.setLimits(0, 100, 5).setValue(this.plugin.settings.notificationVolume).setDynamicTooltip().onChange((value) => {
      this.plugin.settings.notificationVolume = value;
      void this.plugin.persistSettings();
    }));
    new import_obsidian2.Setting(container).setName("Prayer/custom time advance notice (minutes)").setDesc("0 disables it. Applies to prayers, Sunrise, Tahajjud, and custom times.").addText((text) => text.setPlaceholder("0").setValue(String(this.plugin.settings.prayerReminderMinutes)).onChange((value) => this.updateMinutes(value, "prayerReminderMinutes")));
    new import_obsidian2.Setting(container).setName("Iqama advance notice (minutes)").setDesc("0 disables advance notices for Iqama events.").addText((text) => text.setPlaceholder("0").setValue(String(this.plugin.settings.iqamaReminderMinutes)).onChange((value) => this.updateMinutes(value, "iqamaReminderMinutes")));
    new import_obsidian2.Setting(container).setName("Red countdown threshold (minutes)").setDesc("At or below this remaining time, use the red color. Default: 5.").addText((text) => text.setValue(String(this.plugin.settings.countdownRedMinutes)).onChange((value) => this.updateMinutes(value, "countdownRedMinutes", 1, 1440)));
    new import_obsidian2.Setting(container).setName("Normal countdown from (minutes)").setDesc("At or above this time use the normal color; between thresholds is orange. Default: 20.").addText((text) => text.setValue(String(this.plugin.settings.countdownNormalMinutes)).onChange((value) => this.updateMinutes(value, "countdownNormalMinutes", 1, 1440)));
    this.addColorSetting(container, "Red countdown color", "countdownRedColor");
    this.addColorSetting(container, "Orange countdown color", "countdownOrangeColor");
    this.addColorSetting(container, "Normal countdown color (blank uses theme)", "countdownNormalColor", true);
    this.addCustomTimes(container);
    this.addIqamaSettings(container);
  }
  updateMinutes(value, key, min = 0, max = 1439) {
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < min || minutes > max) return;
    this.plugin.settings[key] = minutes;
    void this.plugin.persistSettings();
  }
  addColorSetting(container, label, key, allowBlank = false) {
    new import_obsidian2.Setting(container).setName(label).setDesc("Use a #RRGGBB color." + (allowBlank ? " Leave blank to use the Obsidian theme color." : "")).addText((text) => text.setPlaceholder(allowBlank ? "Theme default" : "#dc5082").setValue(this.plugin.settings[key]).onChange((value) => {
      const color = value.trim();
      if (allowBlank && color === "" || /^#[0-9a-f]{6}$/i.test(color)) {
        this.plugin.settings[key] = color;
        void this.plugin.persistSettings();
      }
    }));
  }
  addCustomTimes(container) {
    container.createEl("h3", { text: "Custom daily times" });
    container.createEl("p", { text: "Add events such as midnight, a personal reminder, or another daily time (24-hour HH:mm)." });
    let name = "";
    let time = "";
    new import_obsidian2.Setting(container).setName("Add custom time").addText((text) => text.setPlaceholder("Name (e.g. Midnight)").onChange((value) => name = value)).addText((text) => text.setPlaceholder("HH:mm").onChange((value) => time = value)).addButton((button) => button.setButtonText("Add").onClick(() => {
      const cleanName = name.trim();
      if (!cleanName || parseTime(time) === null) {
        new import_obsidian2.Notice("Enter a name and a valid time in HH:mm format.", 1e4);
        return;
      }
      this.plugin.settings.customTimes.push({ name: cleanName, time });
      void this.plugin.persistSettings();
      this.refreshAtCurrentScroll();
    }));
    for (const [index, event] of this.plugin.settings.customTimes.entries()) {
      new import_obsidian2.Setting(container).setName(event.name).setDesc(clock(event.time)).addButton((button) => button.setButtonText("Remove").onClick(() => {
        this.plugin.settings.customTimes.splice(index, 1);
        void this.plugin.persistSettings();
        this.refreshAtCurrentScroll();
      }));
    }
  }
  addIqamaSettings(container) {
    container.createEl("h3", { text: "Iqama times" });
    container.createEl("p", { text: "For each prayer, disable Iqama, set a fixed time, or set an offset from that prayer. Negative offsets are supported." });
    for (const prayer of ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha", "Tahajjud"]) {
      const rule = this.plugin.settings.iqama[prayer] || { mode: "disabled" };
      const row = new import_obsidian2.Setting(container).setName(prayer + " Iqama").addDropdown((dropdown) => dropdown.addOption("disabled", "Disabled").addOption("fixed", "Fixed time").addOption("offset", "Offset from prayer").setValue(rule.mode).onChange((value) => {
        this.plugin.settings.iqama[prayer] = value === "fixed" ? { mode: "fixed", time: "05:00" } : value === "offset" ? { mode: "offset", minutes: 0 } : { mode: "disabled" };
        void this.plugin.persistSettings();
        this.refreshAtCurrentScroll();
      }));
      if (rule.mode === "fixed") {
        row.addText((text) => text.setPlaceholder("HH:mm").setValue(rule.time).onChange((value) => {
          if (parseTime(value) !== null) {
            this.plugin.settings.iqama[prayer] = { mode: "fixed", time: value };
            void this.plugin.persistSettings();
          }
        }));
      } else if (rule.mode === "offset") {
        row.addText((text) => text.setPlaceholder("Minutes").setValue(String(rule.minutes)).onChange((value) => {
          const minutes = Number(value);
          if (Number.isInteger(minutes)) {
            this.plugin.settings.iqama[prayer] = { mode: "offset", minutes };
            void this.plugin.persistSettings();
          }
        }));
      }
    }
  }
};
