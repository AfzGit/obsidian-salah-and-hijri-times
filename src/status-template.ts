import type { Schedule } from "./types";
import { countdown, clock, formatTime, parseTime } from "./time";

export interface UpcomingEvent { name: string; time: string; delta: number }

const TOKEN = /\{([a-z]+(?::[a-z/]+)?)\}/gi;

/** Render user-authored text safely and color only countdown tokens. */
export function renderStatusTemplate(
  container: HTMLElement,
  template: string,
  next: UpcomingEvent,
  schedule: Schedule,
  countdownColor: string,
  use24Hour = false,
): void {
  const values: Record<string, string> = {
    next: next.name,
    time: use24Hour && parseTime(next.time) !== null ? formatTime(parseTime(next.time)!) : clock(next.time),
    countdown: countdown(next.delta),
    hijri: schedule.hijriNumeric,
    "hijri:dd/mm/yyyy": schedule.hijriNumeric,
    "hijri:month": schedule.hijriMonth,
    "hijri:long": schedule.hijriDate,
    location: schedule.locationName,
  };

  const fragment = createFragment();
  let offset = 0;
  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(template)) !== null) {
    const index = match.index;
    fragment.append(document.createTextNode(template.slice(offset, index)));
    const key = match[1].toLowerCase();
    const value = values[key];
    if (value === undefined) {
      fragment.append(document.createTextNode(match[0]));
    } else if (key === "countdown") {
      const countdownNode = createSpan({ cls: "salah-hijri-countdown", text: value });
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
