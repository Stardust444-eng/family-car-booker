"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ErrorNote, ReturnDialog, StatusPill, panelClass } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatClock, formatDayHeading, formatRange, formatWeekTitle } from "@/lib/format";
import { carSnapshot, displayWindow } from "@/lib/schedule";
import { addDays, addMinutes, mondayOf } from "@/lib/time";
import type { Booking, HouseholdPayload } from "@/lib/types";
import { cn } from "cn";

export function WeekView({
  data,
  apply,
  heading,
}: {
  data: HouseholdPayload;
  apply: (next: HouseholdPayload) => void;
  heading?: React.ReactNode;
}) {
  const timeZone = data.household.timeZone;
  const now = data.now;
  const cutoff = addMinutes(now, -12 * 60, timeZone);
  const [carId, setCarId] = useState(() => {
    const out = data.cars.find((car) => carSnapshot(car.id, data.bookings, now, cutoff).state !== "free");
    return out?.id ?? data.cars[0]?.id ?? "";
  });
  const [weekOffset, setWeekOffset] = useState(0);
  const [returning, setReturning] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monday = addDays(mondayOf(now, timeZone), weekOffset * 7, timeZone);
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index, timeZone));
  const car = data.cars.find((item) => item.id === carId) ?? data.cars[0];
  const snapshot = car ? carSnapshot(car.id, data.bookings, now, cutoff) : null;

  async function mutate(bookingId: string, body: object) {
    setBusy(true);
    setError(null);
    try {
      const next = await api<HouseholdPayload>(`/api/households/${data.household.id}/bookings/${bookingId}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      apply(next);
      setReturning(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that booking.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="week-view">
      {heading}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {data.cars.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === car?.id}
            onClick={() => setCarId(item.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-bold ring-1",
              item.id === car?.id ? "bg-foreground text-background ring-foreground" : "bg-card ring-border",
            )}
          >
            <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size="icon" className="size-11 bg-card" aria-label="Previous week" onClick={() => setWeekOffset((value) => value - 1)}>
          <ChevronLeft />
        </Button>
        <div className="text-center">
          <p className="font-heading text-2xl leading-none">{formatWeekTitle(monday, timeZone)}</p>
          {weekOffset !== 0 ? (
            <button type="button" className="mt-1 text-sm font-bold underline" onClick={() => setWeekOffset(0)}>
              This week
            </button>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">This week</p>
          )}
        </div>
        <Button type="button" variant="outline" size="icon" className="size-11 bg-card" aria-label="Next week" onClick={() => setWeekOffset((value) => value + 1)}>
          <ChevronRight />
        </Button>
      </div>

      <ErrorNote message={error} />

      {car && snapshot?.current && snapshot.state !== "free" ? (
        <article className={`${panelClass} mt-4 p-4`}>
          <p className="text-sm font-bold text-booked">{snapshot.state === "overdue" ? "Overdue" : "Out right now"}</p>
          <p className="mt-1 text-xl font-bold">
            {snapshot.current.driverName} has the {car.name}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatRange(snapshot.current.startsAt, snapshot.current.endsAt, now, timeZone)} · {snapshot.current.reason}
          </p>
          <Button
            type="button"
            size="xl"
            className="mt-3 w-full"
            data-testid="mark-returned"
            onClick={() => setReturning(snapshot.current)}
          >
            Mark returned
          </Button>
        </article>
      ) : null}

      <div className="mt-4 grid gap-3">
        {days.map((day) => {
          const headingText = formatDayHeading(day, now, timeZone);
          const items = data.bookings
            .filter((booking) => {
              if (!car || booking.carId !== car.id) return false;
              if (booking.status === "declined" || booking.status === "cancelled") return false;
              return displayWindow(booking).startsAt.slice(0, 10) === day;
            })
            .sort((a, b) => displayWindow(a).startsAt.localeCompare(displayWindow(b).startsAt));
          return (
            <section key={day} className={`${panelClass} p-4`}>
              <h2 className="text-xl">
                {headingText.primary}{" "}
                <span className="font-sans text-base font-semibold text-muted-foreground">{headingText.secondary}</span>
              </h2>
              {items.length === 0 ? (
                <p className="mt-2 font-bold text-free">Open</p>
              ) : (
                <ul className="mt-3 grid gap-3">
                  {items.map((booking) => {
                    const window = displayWindow(booking);
                    const canReturn = booking.status === "approved" && booking.startsAt <= now;
                    return (
                      <li key={booking.id} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold">
                            {formatClock(window.startsAt)}–{formatClock(window.endsAt)} · {booking.driverName}
                          </p>
                          <StatusPill
                            tone={
                              booking.status === "approved"
                                ? "booked"
                                : booking.status === "returned"
                                  ? "muted"
                                  : booking.status === "suggested"
                                    ? "suggested"
                                    : "pending"
                            }
                          >
                            {booking.status === "approved"
                              ? "Booked"
                              : booking.status === "returned"
                                ? "Returned"
                                : booking.status === "suggested"
                                  ? "New time"
                                  : "Pending"}
                          </StatusPill>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {booking.reason} · {booking.place}
                        </p>
                        {booking.status === "suggested" ? (
                          <p className="text-sm">
                            Instead of {formatRange(booking.startsAt, booking.endsAt, now, timeZone)}
                          </p>
                        ) : null}
                        {booking.status === "returned" && booking.returnedAt ? (
                          <p className="text-sm font-semibold text-free" data-testid="returned-label">
                            Returned at {formatClock(booking.returnedAt)}
                          </p>
                        ) : null}
                        {canReturn ? (
                          <Button
                            type="button"
                            size="xl"
                            variant="outline"
                            className="mt-2 w-full bg-card"
                            data-testid="mark-returned"
                            onClick={() => setReturning(booking)}
                          >
                            Mark returned
                          </Button>
                        ) : null}
                        {booking.status === "approved" && booking.startsAt > now ? (
                          <button
                            type="button"
                            className="mt-2 block text-sm font-bold text-muted-foreground underline"
                            disabled={busy}
                            onClick={() => void mutate(booking.id, { action: "cancel" })}
                          >
                            Cancel this booking
                          </button>
                        ) : null}
                        {booking.status === "approved" || booking.status === "pending" || booking.status === "suggested" ? (
                          <a
                            className="mt-2 block text-sm font-bold underline"
                            href={`/api/households/${data.household.id}/bookings/${booking.id}/calendar`}
                          >
                            Add to calendar
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {car ? (
        <a
          className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl bg-card font-bold ring-1 ring-border"
          href={`/api/households/${data.household.id}/calendar?week=${monday}&carId=${car.id}`}
        >
          Add approved trips to your calendar
        </a>
      ) : null}

      <ReturnDialog
        booking={returning}
        now={now}
        timeZone={timeZone}
        busy={busy}
        onOpenChange={(open) => {
          if (!open) setReturning(null);
        }}
        onConfirm={() => {
          if (returning) void mutate(returning.id, { action: "return" });
        }}
      />
    </div>
  );
}
