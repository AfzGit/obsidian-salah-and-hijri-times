import type { Schedule, Settings, TimelineEvent } from "./types";
import { formatTime, parseTime } from "./time";

/**
 * Convert a calculated schedule and saved rules into timeline events.
 * Maghrib is the sunset prayer and is the only evening prayer/Iqama entry.
 */
export function buildConfiguredEvents(schedule: Schedule, settings: Settings): TimelineEvent[] {
  const events: TimelineEvent[] = schedule.prayers.map(prayer => ({
    ...prayer,
    name: prayer.name === "Tahajjud" ? "Last Third" : prayer.name,
    kind: "prayer",
  }));

  for (const [name, rule] of Object.entries(settings.iqama)) {
    if (name === "Sunset" || rule.mode === "disabled") continue;
    const baseName = rule.mode === "offset" && name === "Tahajjud" && rule.from === "Fajr"
      ? "Fajr"
      : name;
    const base = schedule.prayers.find(prayer => prayer.name === baseName);
    const time = rule.mode === "fixed"
      ? rule.time
      : rule.mode === "offset" && base
        ? formatTime((parseTime(base.time) ?? 0) + rule.minutes)
        : "";
    if (time) events.push({ name: name === "Sunrise" ? "Duha prayer" : name === "Tahajjud" ? "Tahajjud Qiyam" : `${name} Iqama`, time, kind: "iqama" });
  }

  for (const custom of settings.customTimes || []) {
    if (custom.name.trim() && parseTime(custom.time) !== null) events.push({ name: custom.name.trim(), time: custom.time, kind: "custom" });
  }
  return events;
}
