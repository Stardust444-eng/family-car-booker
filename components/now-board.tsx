"use client";

import { useState } from "react";
import Link from "next/link";

import { ConflictAlert, ErrorNote, GarageHeader, ReturnDialog, StatusPill, panelClass } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { useGarage } from "@/components/providers";
import { api } from "@/lib/api";
import { approverSentence, formatClock, formatRange, isRecentIso, untilPhrase } from "@/lib/format";
import { addMinutes } from "@/lib/time";
import { carSnapshot, displayWindow, findConflicts } from "@/lib/schedule";
import type { Booking, HouseholdPayload } from "@/lib/types";

function zoneShort(timeZone: string): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
    .formatToParts(new Date())
    .find((item) => item.type === "timeZoneName");
  return part?.value ?? timeZone;
}

export function NowBoard() {
  const { data, driver, apply } = useGarage();
  const now = data.now;
  const timeZone = data.household.timeZone;
  const cutoff = addMinutes(now, -12 * 60, timeZone);
  const [returning, setReturning] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

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

  const openRequests = data.bookings.filter(
    (booking) =>
      booking.status === "pending" ||
      booking.status === "suggested" ||
      (booking.status === "declined" && isRecentIso(booking.updatedAt, 36)),
  );

  return (
    <div data-testid="now-board">
      <GarageHeader />
      {data.household.isDemo ? (
        <div className="mb-4 rounded-2xl bg-pending-bg px-4 py-3 text-sm">
          <p className="font-bold text-pending">Demo garage</p>
          <p className="mt-1">
            Maya, Sam, Jake, and Priya are sample people. These are not your cars. Times are {zoneShort(timeZone)}.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <Button
              type="button"
              size="xl"
              variant="outline"
              className="w-full bg-card"
              disabled={resetting}
              onClick={() => {
                setResetting(true);
                void api<HouseholdPayload>("/api/demo/reset", { method: "POST" })
                  .then((next) => apply(next))
                  .catch((err: unknown) =>
                    setError(err instanceof Error ? err.message : "Could not reset the demo."),
                  )
                  .finally(() => setResetting(false));
              }}
            >
              {resetting ? "Resetting…" : "Reset sample bookings"}
            </Button>
            <Link href="/demo/admin" className="text-center text-sm font-bold underline">
              Preview the approval link
            </Link>
          </div>
        </div>
      ) : null}

      <ErrorNote message={error} />

      <div className="mt-3 grid gap-3">
        {data.cars.map((car) => {
          const snapshot = carSnapshot(car.id, data.bookings, now, cutoff);
          const current = snapshot.current;
          const tone = snapshot.state === "free" ? "free" : "booked";
          const headline =
            snapshot.state === "free"
              ? "Free"
              : snapshot.state === "out" && current
                ? `With ${current.driverName} ${untilPhrase(current.endsAt, now, timeZone)}`
                : current
                  ? `${current.driverName} was due back ${untilPhrase(current.endsAt, now, timeZone).replace(/^until /, "at ")}`
                  : "Free";
          return (
            <article key={car.id} className={panelClass}>
              <div className="flex">
                <div className="w-2 shrink-0" style={{ backgroundColor: car.color }} />
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-2xl">{car.name}</h2>
                    <StatusPill tone={tone}>
                      {snapshot.state === "free" ? "Free" : snapshot.state === "overdue" ? "Overdue" : "Out"}
                    </StatusPill>
                  </div>
                  <p className={`mt-2 text-[1.65rem] leading-tight font-bold ${tone === "free" ? "text-free" : "text-booked"}`}>
                    {headline}
                  </p>
                  {current ? (
                    <p className="mt-1 text-muted-foreground">
                      {current.reason} · {current.place}
                    </p>
                  ) : null}
                  {current && snapshot.state !== "free" ? (
                    <Button
                      type="button"
                      size="xl"
                      variant="outline"
                      className="mt-3 w-full bg-card"
                      data-testid="mark-returned"
                      onClick={() => setReturning(current)}
                    >
                      Mark returned
                    </Button>
                  ) : null}
                  {snapshot.next ? (
                    <p className="mt-3 text-sm">
                      Next: {snapshot.next.driverName},{" "}
                      {formatRange(
                        displayWindow(snapshot.next).startsAt,
                        displayWindow(snapshot.next).endsAt,
                        now,
                        timeZone,
                      )}
                      {snapshot.next.status === "pending" ? " · pending" : ""}
                      {snapshot.next.status === "suggested" ? " · new time suggested" : ""}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <section className="mt-6">
        <h2 className="text-2xl">Requests</h2>
        {openRequests.length === 0 ? (
          <p className="mt-2 text-muted-foreground">No requests waiting. When someone needs a car, it shows up here.</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {openRequests.map((booking) => {
              const window = displayWindow(booking);
              const conflicts = findConflicts(data.bookings, {
                carId: booking.carId,
                startsAt: window.startsAt,
                endsAt: window.endsAt,
                excludeId: booking.id,
              });
              const mine = driver?.id === booking.driverId;
              return (
                <li key={booking.id} className={`${panelClass} p-4`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">
                      {booking.driverName} · {booking.carName ?? "Any car"}
                    </p>
                    <StatusPill
                      tone={
                        booking.status === "declined"
                          ? "muted"
                          : booking.status === "suggested"
                            ? "suggested"
                            : "pending"
                      }
                    >
                      {booking.status === "declined"
                        ? "Declined"
                        : booking.status === "suggested"
                          ? "New time"
                          : "Pending"}
                    </StatusPill>
                  </div>
                  <p className="mt-1">
                    {formatRange(window.startsAt, window.endsAt, now, timeZone)} · {booking.reason}
                  </p>
                  <p className="text-sm text-muted-foreground">{booking.place}</p>
                  {booking.status === "suggested" && booking.suggestionNote ? (
                    <p className="mt-2 text-sm">A parent said: {booking.suggestionNote}</p>
                  ) : null}
                  {booking.decisionNote ? <p className="mt-2 text-sm">{booking.decisionNote}</p> : null}
                  {conflicts.some((conflict) => conflict.kind === "approved") ? (
                    <div className="mt-2">
                      <ConflictAlert conflicts={conflicts} now={now} timeZone={timeZone} />
                    </div>
                  ) : null}
                  {booking.status === "suggested" && mine ? (
                    <div className="mt-3 grid gap-2">
                      <Button
                        type="button"
                        size="xl"
                        className="w-full"
                        disabled={busy}
                        onClick={() => void mutate(booking.id, { action: "accept-suggestion", driverId: booking.driverId })}
                      >
                        Accept {formatClock(window.startsAt)}–{formatClock(window.endsAt)}
                      </Button>
                      <Button
                        type="button"
                        size="xl"
                        variant="outline"
                        className="w-full bg-card"
                        disabled={busy}
                        onClick={() =>
                          void mutate(booking.id, { action: "decline-suggestion", driverId: booking.driverId })
                        }
                      >
                        Cannot do that time
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-6 text-sm text-muted-foreground">
        {approverSentence(data.drivers.filter((person) => person.isAdmin).map((person) => person.name))} The family
        link cannot approve.
      </p>

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
