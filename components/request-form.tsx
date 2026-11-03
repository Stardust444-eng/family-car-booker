"use client";

import { useState } from "react";
import Link from "next/link";

import { ConflictAlert, CopyButton, ErrorNote, GarageHeader, panelClass } from "@/components/bits";
import { useGarage } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatRange } from "@/lib/format";
import { requestText } from "@/lib/share";
import { findConflicts, freeCarIds } from "@/lib/schedule";
import { composeRange, defaultRange, validateRange, wallNowInZone } from "@/lib/time";
import type { Booking, Conflict, HouseholdPayload } from "@/lib/types";
import { cn } from "cn";

function initialChoice(data: HouseholdPayload): string {
  const now = wallNowInZone(data.household.timeZone);
  const range = defaultRange(now, data.household.timeZone);
  const composed = composeRange(range.date, range.start, range.end, data.household.timeZone);
  if (!composed || data.cars.length === 0) return data.cars[0]?.id ?? "any";
  const free = data.cars.find(
    (car) =>
      !findConflicts(data.bookings, { carId: car.id, ...composed }).some(
        (conflict) => conflict.kind === "approved",
      ),
  );
  return free?.id ?? data.cars[0].id;
}

export function RequestForm() {
  const { data, driver, chooseDriver, apply } = useGarage();
  const timeZone = data.household.timeZone;
  const now = data.now;
  const starting = defaultRange(now, timeZone);
  const [choice, setChoice] = useState(() => initialChoice(data));
  const [date, setDate] = useState(starting.date);
  const [start, setStart] = useState(starting.start);
  const [end, setEnd] = useState(starting.end);
  const [place, setPlace] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ booking: Booking; conflicts: Conflict[] } | null>(null);

  if (!driver) {
    return (
      <div>
        <GarageHeader title="Request a car" backHref={`/h/${data.household.id}`} />
        <h2 className="text-2xl">Who is requesting?</h2>
        <p className="mt-2 text-muted-foreground">Pick your name. This phone remembers it.</p>
        <div className="mt-4 grid gap-2">
          {data.drivers.map((person) => (
            <Button
              key={person.id}
              type="button"
              size="xl"
              variant="outline"
              className="w-full justify-between bg-card"
              onClick={() => chooseDriver(person.id)}
            >
              {person.name}
              {person.isAdmin ? <span className="text-sm font-semibold text-muted-foreground">Admin</span> : null}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  const composed = composeRange(date, start, end, timeZone);
  const carId = choice === "any" ? null : choice;
  const conflicts = composed
    ? findConflicts(data.bookings, { carId, startsAt: composed.startsAt, endsAt: composed.endsAt })
    : [];
  const free = composed
    ? freeCarIds(
        data.cars.map((car) => car.id),
        data.bookings,
        composed,
      )
    : [];
  const approvedHit = conflicts.some((conflict) => conflict.kind === "approved");
  const blockedAny = carId === null && free.length === 0;
  const anyway = approvedHit || blockedAny;
  const rangeError = composed ? validateRange(composed.startsAt, composed.endsAt, now, timeZone) : "Pick a start and end time.";

  if (sent) {
    const when = formatRange(sent.booking.startsAt, sent.booking.endsAt, now, timeZone);
    const text = requestText(sent.booking.driverName, sent.booking.carName, when, sent.booking.reason);
    return (
      <div>
        <GarageHeader title="Request sent" backHref={`/h/${data.household.id}`} />
        <div className={`${panelClass} p-4`}>
          <p className="text-sm font-bold text-pending">Pending</p>
          <h2 className="mt-1 text-3xl">
            {sent.booking.carName ?? "Any car"} {when}
          </h2>
          <p className="mt-2">
            {sent.booking.reason} · {sent.booking.place}
          </p>
          {sent.conflicts.some((conflict) => conflict.kind === "approved") ? (
            <p className="mt-3 text-sm text-booked">
              It overlaps another booking. An admin will see that before they approve.
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {data.drivers
                .filter((person) => person.isAdmin)
                .map((person) => person.name)
                .join(" and ") || "An admin"}{" "}
              can approve it from the approval link.
            </p>
          )}
        </div>
        <div className="mt-4">
          <CopyButton text={text} label="Copy a text to send" />
        </div>
        {data.household.isDemo ? (
          <div className="mt-4 rounded-2xl bg-secondary px-4 py-3 text-sm">
            <p>This is the demo, so the approval link is one tap away. A real household keeps that link private.</p>
            <Link href="/demo/admin" className="mt-2 inline-block font-bold underline">
              Open the approval link
            </Link>
          </div>
        ) : null}
        <Link
          href={`/h/${data.household.id}`}
          className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground"
        >
          Back to now
        </Link>
      </div>
    );
  }

  return (
    <div>
      <GarageHeader title="Request a car" backHref={`/h/${data.household.id}`} />
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!composed || rangeError) {
            setError(rangeError);
            return;
          }
          if (!place.trim() || !reason.trim()) {
            setError("Say where you are going and why.");
            return;
          }
          setBusy(true);
          setError(null);
          void api<HouseholdPayload & { createdId: string; conflicts: Conflict[] }>(
            `/api/households/${data.household.id}/bookings`,
            {
              method: "POST",
              body: JSON.stringify({
                carId,
                driverId: driver.id,
                startsAt: composed.startsAt,
                endsAt: composed.endsAt,
                place,
                reason,
              }),
            },
          )
            .then((next) => {
              apply(next);
              const booking = next.bookings.find((item) => item.id === next.createdId);
              if (booking) setSent({ booking, conflicts: next.conflicts });
            })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not send the request."))
            .finally(() => setBusy(false));
        }}
      >
        <fieldset className="grid gap-2">
          <legend className="text-base font-bold">Car</legend>
          <div className="flex flex-wrap gap-2">
            {data.cars.map((car) => (
              <button
                key={car.id}
                type="button"
                aria-pressed={choice === car.id}
                onClick={() => setChoice(car.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold ring-1",
                  choice === car.id ? "bg-foreground text-background ring-foreground" : "bg-card ring-border",
                )}
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: car.color }} />
                {car.name}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={choice === "any"}
              onClick={() => setChoice("any")}
              className={cn(
                "rounded-full px-3 py-2 text-sm font-bold ring-1",
                choice === "any" ? "bg-foreground text-background ring-foreground" : "bg-card ring-border",
              )}
            >
              Any free car
            </button>
          </div>
        </fieldset>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="request-date" className="text-base">
              Date
            </Label>
            <Input id="request-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="request-start" className="text-base">
                Start
              </Label>
              <Input
                id="request-start"
                type="time"
                step={300}
                value={start}
                onChange={(event) => setStart(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="request-end" className="text-base">
                End
              </Label>
              <Input
                id="request-end"
                type="time"
                step={300}
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                required
              />
            </div>
          </div>
          {start && end && end <= start ? (
            <p className="text-sm text-muted-foreground">An earlier end time counts as the next morning.</p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="request-place" className="text-base">
            Where
          </Label>
          <Input
            id="request-place"
            value={place}
            onChange={(event) => setPlace(event.target.value)}
            placeholder="Riverside fields"
            maxLength={80}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="request-reason" className="text-base">
            Why
          </Label>
          <Textarea
            id="request-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Soccer practice"
            maxLength={140}
            required
          />
        </div>

        {rangeError ? <p className="text-sm font-semibold text-destructive">{rangeError}</p> : null}
        <ConflictAlert conflicts={conflicts} driverName={driver.name} now={now} timeZone={timeZone} />
        {carId === null && composed ? (
          <p className="text-sm">
            {free.length === 0
              ? "Every car is already booked then."
              : `Free then: ${free
                  .map((id) => data.cars.find((car) => car.id === id)?.name)
                  .filter(Boolean)
                  .join(", ")}.`}
          </p>
        ) : null}
        <ErrorNote message={error} />
        <Button type="submit" size="xl" className="w-full" disabled={busy}>
          {busy ? "Sending…" : anyway ? "Request anyway" : "Send request"}
        </Button>
      </form>
    </div>
  );
}
