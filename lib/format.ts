import { addDays, wallToUtcDate } from "@/lib/time";

export function formatClock(wall: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(wall);
  if (!match) return wall;
  const hh = Number(match[4]);
  const mm = Number(match[5]);
  const suffix = hh >= 12 ? "pm" : "am";
  const hour = hh % 12 === 0 ? 12 : hh % 12;
  if (mm === 0) return `${hour} ${suffix}`;
  return `${hour}:${String(mm).padStart(2, "0")} ${suffix}`;
}

export function formatDayLabel(wall: string, now: string, timeZone: string): string {
  const day = wall.slice(0, 10);
  const today = now.slice(0, 10);
  if (day === today) return "today";
  if (day === addDays(today, 1, timeZone)) return "tomorrow";
  const instant = wallToUtcDate(`${day}T12:00`, timeZone);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(instant);
  const month = new Intl.DateTimeFormat("en-US", { timeZone, month: "short" }).format(instant);
  return `${weekday}, ${month} ${Number(day.slice(8, 10))}`;
}

export function formatRange(
  startsAt: string,
  endsAt: string,
  now: string,
  timeZone: string,
): string {
  const startLabel = `${formatDayLabel(startsAt, now, timeZone)} ${formatClock(startsAt)}`;
  if (startsAt.slice(0, 10) === endsAt.slice(0, 10)) {
    return `${startLabel}–${formatClock(endsAt)}`;
  }
  return `${startLabel} – ${formatDayLabel(endsAt, now, timeZone)} ${formatClock(endsAt)}`;
}

export function untilPhrase(endsAt: string, now: string, timeZone: string): string {
  if (endsAt.slice(0, 10) === now.slice(0, 10)) return `until ${formatClock(endsAt)}`;
  return `until ${formatDayLabel(endsAt, now, timeZone)} ${formatClock(endsAt)}`;
}

export function formatWeekTitle(monday: string, timeZone: string): string {
  const sunday = addDays(monday, 6, timeZone);
  const start = wallToUtcDate(`${monday}T12:00`, timeZone);
  const end = wallToUtcDate(`${sunday}T12:00`, timeZone);
  const monthStart = new Intl.DateTimeFormat("en-US", { timeZone, month: "short" }).format(start);
  const monthEnd = new Intl.DateTimeFormat("en-US", { timeZone, month: "short" }).format(end);
  const first = Number(monday.slice(8, 10));
  const last = Number(sunday.slice(8, 10));
  if (monthStart === monthEnd) return `${monthStart} ${first}–${last}`;
  return `${monthStart} ${first} – ${monthEnd} ${last}`;
}

export function formatDayHeading(
  date: string,
  now: string,
  timeZone: string,
): { primary: string; secondary: string } {
  const instant = wallToUtcDate(`${date}T12:00`, timeZone);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(instant);
  const month = new Intl.DateTimeFormat("en-US", { timeZone, month: "short" }).format(instant);
  return {
    primary: date === now.slice(0, 10) ? "Today" : weekday,
    secondary: `${month} ${Number(date.slice(8, 10))}`,
  };
}

export function approverSentence(names: string[]): string {
  if (names.length === 0) return "Nobody is marked as an admin yet.";
  if (names.length === 1) return `${names[0]} approves requests.`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} approve requests.`;
}

export function isRecentIso(iso: string, hours: number, now = Date.now()): boolean {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return now - then < hours * 60 * 60 * 1000;
}
