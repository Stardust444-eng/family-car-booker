import type { Booking, Conflict, Interval } from "@/lib/types";

export function overlaps(a: Interval, b: Interval): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

export function displayWindow(booking: Booking): Interval {
  if (
    booking.status === "suggested" &&
    booking.suggestionStartsAt &&
    booking.suggestionEndsAt
  ) {
    return { startsAt: booking.suggestionStartsAt, endsAt: booking.suggestionEndsAt };
  }
  return { startsAt: booking.startsAt, endsAt: booking.endsAt };
}

export function occupiedWindows(booking: Booking): Interval[] {
  if (
    booking.status === "declined" ||
    booking.status === "cancelled" ||
    booking.status === "returned"
  ) {
    return [];
  }
  const windows = [{ startsAt: booking.startsAt, endsAt: booking.endsAt }];
  if (
    booking.status === "suggested" &&
    booking.suggestionStartsAt &&
    booking.suggestionEndsAt &&
    (booking.suggestionStartsAt !== booking.startsAt ||
      booking.suggestionEndsAt !== booking.endsAt)
  ) {
    windows.push({
      startsAt: booking.suggestionStartsAt,
      endsAt: booking.suggestionEndsAt,
    });
  }
  return windows;
}

export function findConflicts(
  bookings: Booking[],
  query: Interval & { carId: string | null; excludeId?: string },
): Conflict[] {
  const conflicts: Conflict[] = [];
  for (const booking of bookings) {
    if (booking.id === query.excludeId) continue;
    const windows = occupiedWindows(booking);
    const hit = windows.find((window) => overlaps(query, window));
    if (!hit) continue;
    const sameCar =
      query.carId === null || booking.carId === null || booking.carId === query.carId;
    if (!sameCar) continue;
    conflicts.push({
      bookingId: booking.id,
      carId: booking.carId,
      carName: booking.carName,
      driverName: booking.driverName,
      startsAt: hit.startsAt,
      endsAt: hit.endsAt,
      status: booking.status,
      place: booking.place,
      reason: booking.reason,
      kind: booking.status === "approved" ? "approved" : "waiting",
    });
  }
  return conflicts;
}

export function freeCarIds(
  carIds: string[],
  bookings: Booking[],
  window: Interval,
  excludeId?: string,
): string[] {
  return carIds.filter((carId) => {
    return !bookings.some((booking) => {
      if (booking.id === excludeId || booking.status !== "approved" || booking.carId !== carId) {
        return false;
      }
      return overlaps(window, { startsAt: booking.startsAt, endsAt: booking.endsAt });
    });
  });
}

export type CarSnapshot = {
  state: "free" | "out" | "overdue";
  current: Booking | null;
  next: Booking | null;
};

export function carSnapshot(
  carId: string,
  bookings: Booking[],
  now: string,
  overdueCutoff: string,
): CarSnapshot {
  const approved = bookings
    .filter((booking) => booking.carId === carId && booking.status === "approved")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const started = approved.filter((booking) => booking.startsAt <= now);
  const latest = started.length > 0 ? started[started.length - 1] : null;

  let state: CarSnapshot["state"] = "free";
  let current: Booking | null = null;
  if (latest && latest.endsAt > now) {
    state = "out";
    current = latest;
  } else if (latest && latest.endsAt <= now && latest.endsAt > overdueCutoff) {
    state = "overdue";
    current = latest;
  }

  const next =
    bookings
      .filter((booking) => {
        if (booking.carId !== carId || booking.id === current?.id) return false;
        if (
          booking.status !== "approved" &&
          booking.status !== "pending" &&
          booking.status !== "suggested"
        ) {
          return false;
        }
        return displayWindow(booking).startsAt > now;
      })
      .sort((a, b) => displayWindow(a).startsAt.localeCompare(displayWindow(b).startsAt))[0] ??
    null;

  return { state, current, next };
}
