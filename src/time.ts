/** Parse a 24-hour HH:mm value into minutes after midnight. */
export function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

/** Wrap signed minute offsets onto the 24-hour clock. */
export function formatTime(totalMinutes: number): string {
  const wrapped = (totalMinutes % 1440 + 1440) % 1440;
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Render a 24-hour clock value using a compact 12-hour label. */
export function clock(value: string): string {
  const totalMinutes = parseTime(value);
  if (totalMinutes === null) return value;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")}${hour >= 12 ? " pm" : " am"}`;
}

export interface TimedEvent { name: string; time: string }
export interface UpcomingEvent extends TimedEvent { delta: number }

/** Find the closest future event using local wall-clock time; invalid events are skipped. */
export function nextEvent(events: TimedEvent[], now: Date): UpcomingEvent | null {
  let nearest: UpcomingEvent | null = null;
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

/** Format a millisecond duration as whole minutes, optionally grouped into hours. */
export function countdown(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  return hours
    ? `${hours}h ${String(totalMinutes % 60).padStart(2, "0")}m`
    : `${totalMinutes}m`;
}
