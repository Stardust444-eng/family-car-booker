import type { Booking } from "@/lib/types";
import { wallNowInZone, wallToUtcDate } from "@/lib/time";

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function fold(line: string): string {
  if (line.length <= 75) return line;
  let output = "";
  let index = 0;
  while (index < line.length) {
    const take = index === 0 ? 75 : 74;
    if (index > 0) output += "\r\n ";
    output += line.slice(index, index + take);
    index += take;
  }
  return output;
}

function stamp(wall: string, timeZone: string): string {
  return wallToUtcDate(wall, timeZone)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function summary(booking: Booking): string {
  const car = booking.carName ?? "Car";
  if (booking.status === "pending") return `Requested: ${car} · ${booking.driverName}`;
  if (booking.status === "suggested") return `Suggested: ${car} · ${booking.driverName}`;
  return `${car} · ${booking.driverName}`;
}

export function bookingsToIcs(options: {
  calendarName: string;
  timeZone: string;
  bookings: Booking[];
}): string {
  const now = wallNowInZone(options.timeZone);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Family Car Booker//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(options.calendarName)}`,
  ];
  for (const booking of options.bookings) {
    if (
      booking.status === "declined" ||
      booking.status === "cancelled"
    ) {
      continue;
    }
    const end =
      booking.status === "returned" && booking.returnedAt ? booking.returnedAt : booking.endsAt;
    const description = [booking.reason, booking.place, booking.status].filter(Boolean).join(" · ");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${booking.id}@family-car-booker`);
    lines.push(`DTSTAMP:${stamp(now, options.timeZone)}`);
    lines.push(`DTSTART:${stamp(booking.startsAt, options.timeZone)}`);
    lines.push(`DTEND:${stamp(end, options.timeZone)}`);
    lines.push(`SUMMARY:${icsEscape(summary(booking))}`);
    lines.push(`LOCATION:${icsEscape(booking.place)}`);
    lines.push(`DESCRIPTION:${icsEscape(description)}`);
    if (booking.status === "pending" || booking.status === "suggested") {
      lines.push("STATUS:TENTATIVE");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function fileSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "garage";
}
