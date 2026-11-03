export type WallParts = {
  y: number;
  m: number;
  d: number;
  hh: number;
  mm: number;
};

const WALL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function parseWall(wall: string): WallParts | null {
  const match = WALL_RE.exec(wall);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const hh = Number(match[4]);
  const mm = Number(match[5]);
  if (m < 1 || m > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null;
  return { y, m, d, hh, mm };
}

export function isWall(value: string): boolean {
  return parseWall(value) !== null;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatWall(parts: WallParts): string {
  return `${parts.y}-${pad(parts.m)}-${pad(parts.d)}T${pad(parts.hh)}:${pad(parts.mm)}`;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function partsInZone(date: Date, timeZone: string): WallParts & { ss: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  let hh = Number(bag.hour);
  if (hh === 24) hh = 0;
  return {
    y: Number(bag.year),
    m: Number(bag.month),
    d: Number(bag.day),
    hh,
    mm: Number(bag.minute),
    ss: Number(bag.second),
  };
}

function offsetMinutes(timeZone: string, date: Date): number {
  const parts = partsInZone(date, timeZone);
  const asUtc = Date.UTC(parts.y, parts.m - 1, parts.d, parts.hh, parts.mm, parts.ss);
  return Math.round((asUtc - date.getTime()) / 60000);
}

export function wallNowInZone(timeZone: string, date = new Date()): string {
  const parts = partsInZone(date, timeZone);
  return formatWall(parts);
}

export function wallToUtcDate(wall: string, timeZone: string): Date {
  const parts = parseWall(wall);
  if (!parts) throw new Error(`Not a wall time: ${wall}`);
  const guess = new Date(Date.UTC(parts.y, parts.m - 1, parts.d, parts.hh, parts.mm, 0));
  const first = new Date(guess.getTime() - offsetMinutes(timeZone, guess) * 60_000);
  return new Date(guess.getTime() - offsetMinutes(timeZone, first) * 60_000);
}

export function addMinutes(wall: string, minutes: number, timeZone: string): string {
  const utc = wallToUtcDate(wall, timeZone);
  return wallNowInZone(timeZone, new Date(utc.getTime() + minutes * 60_000));
}

export function addDays(date: string, days: number, timeZone: string): string {
  return addMinutes(`${date}T12:00`, days * 24 * 60, timeZone).slice(0, 10);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayIndex(wall: string, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(wallToUtcDate(wall, timeZone));
  const index = WEEKDAYS.indexOf(name);
  if (index < 0) throw new Error(`Unknown weekday ${name}`);
  return index;
}

export function mondayOf(wall: string, timeZone: string): string {
  const index = weekdayIndex(wall, timeZone);
  const delta = index === 0 ? -6 : 1 - index;
  return addDays(wall.slice(0, 10), delta, timeZone);
}

export function composeRange(
  date: string,
  start: string,
  end: string,
  timeZone: string,
): { startsAt: string; endsAt: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const startsAt = `${date}T${start}`;
  const sameDayEnd = `${date}T${end}`;
  if (!parseWall(startsAt) || !parseWall(sameDayEnd)) return null;
  if (sameDayEnd > startsAt) return { startsAt, endsAt: sameDayEnd };
  return { startsAt, endsAt: `${addDays(date, 1, timeZone)}T${end}` };
}

export function defaultRange(
  now: string,
  timeZone: string,
): { date: string; start: string; end: string } {
  const parsed = parseWall(now);
  if (!parsed) return { date: now.slice(0, 10), start: "16:00", end: "18:00" };
  const hourStart = `${now.slice(0, 10)}T${pad(parsed.hh)}:00`;
  const startWall = parsed.mm === 0 ? hourStart : addMinutes(hourStart, 60, timeZone);
  let endWall = addMinutes(startWall, 120, timeZone);
  if (endWall.slice(0, 10) !== startWall.slice(0, 10)) {
    const late = `${startWall.slice(0, 10)}T23:30`;
    endWall = late > startWall ? late : addMinutes(startWall, 60, timeZone);
  }
  return {
    date: startWall.slice(0, 10),
    start: startWall.slice(11, 16),
    end: endWall.slice(11, 16),
  };
}

export function validateRange(
  startsAt: string,
  endsAt: string,
  now: string,
  timeZone: string,
): string | null {
  if (!isWall(startsAt) || !isWall(endsAt)) return "Pick a start and end time.";
  if (endsAt <= startsAt) return "The end time has to be after the start.";
  const minutes =
    (wallToUtcDate(endsAt, timeZone).getTime() - wallToUtcDate(startsAt, timeZone).getTime()) /
    60_000;
  if (minutes < 15) return "Ask for at least 15 minutes.";
  if (minutes > 48 * 60) return "A booking can be at most 48 hours.";
  if (startsAt < addMinutes(now, -15, timeZone)) return "That start time is already in the past.";
  if (endsAt <= now) return "That window has already ended.";
  if (startsAt > addMinutes(now, 120 * 24 * 60, timeZone)) {
    return "Pick a date in the next few months.";
  }
  return null;
}
