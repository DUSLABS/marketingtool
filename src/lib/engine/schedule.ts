// Turns a campaign's weekly posting times (in its timezone) into concrete UTC instants.

export type ScheduleSlot = { id: string; time_of_day: string; weekdays: number[] };

function offsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - date.getTime();
}

/** The UTC instant of a wall-clock time in a timezone (DST-aware). */
export function zonedTimeToUtc(y: number, m: number, d: number, hour: number, minute: number, timeZone: string) {
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const first = guess - offsetMs(new Date(guess), timeZone);
  const second = guess - offsetMs(new Date(first), timeZone);
  return new Date(second);
}

/** Calendar date and weekday (0 = Sunday) of an instant in a timezone. */
export function localDay(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")), weekday };
}

/** All slot instants between `from` and `to` (inclusive), sorted. */
export function occurrences(slots: ScheduleSlot[], timeZone: string, from: Date, to: Date) {
  const result: { slotId: string; at: Date }[] = [];
  const DAY = 24 * 60 * 60 * 1000;
  // Walk local days from one day before `from` to one day after `to` to cover timezone edges.
  for (let t = from.getTime() - DAY; t <= to.getTime() + DAY; t += DAY) {
    const { y, m, d, weekday } = localDay(new Date(t), timeZone);
    for (const slot of slots) {
      if (!slot.weekdays.includes(weekday)) continue;
      const [hour, minute] = slot.time_of_day.split(":").map(Number);
      const at = zonedTimeToUtc(y, m, d, hour, minute, timeZone);
      if (at >= from && at <= to) result.push({ slotId: slot.id, at });
    }
  }
  const unique = new Map(result.map((r) => [r.at.getTime(), r]));
  return [...unique.values()].sort((a, b) => a.at.getTime() - b.at.getTime());
}
