"use client";

import { useState } from "react";

import { ConflictAlert, CopyButton, ErrorNote, StatusPill, panelClass } from "@/components/bits";
import { useAdmin } from "@/components/providers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatRange } from "@/lib/format";
import { approvalReminder } from "@/lib/share";
import { displayWindow, findConflicts } from "@/lib/schedule";
import { composeRange } from "@/lib/time";
import type { AdminPayload, Booking } from "@/lib/types";

export function AdminQueue() {
  const { data, apply } = useAdmin();
  const now = data.now;
  const timeZone = data.household.timeZone;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const approvalUrl = `${origin}/a/${data.adminToken}`;
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declineFor, setDeclineFor] = useState<Booking | null>(null);
  const [declineNote, setDeclineNote] = useState("");
  const [suggestFor, setSuggestFor] = useState<Booking | null>(null);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [carChoice, setCarChoice] = useState<Record<string, string>>({});

  const waiting = data.bookings.filter((booking) => booking.status === "pending" || booking.status === "suggested");

  async function decide(bookingId: string, body: object, success: string) {
    setBusyId(bookingId);
    setError(null);
    try {
      const next = await api<AdminPayload>(`/api/admin/${data.adminToken}/bookings/${bookingId}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      apply(next);
      setNotice(success);
      setDeclineFor(null);
      setSuggestFor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that request.");
    } finally {
      setBusyId(null);
    }
  }

  const suggestion = suggestFor
    ? composeRange(date, start, end, timeZone)
    : null;
  const suggestionConflicts =
    suggestFor && suggestion
      ? findConflicts(data.bookings, {
          carId: suggestFor.carId,
          startsAt: suggestion.startsAt,
          endsAt: suggestion.endsAt,
          excludeId: suggestFor.id,
        })
      : [];

  return (
    <div data-testid="admin-queue">
      <p className="text-muted-foreground">
        Private. Approve, decline, or suggest another time. The family link cannot do this.
      </p>
      <div className="mt-3">
        <CopyButton text={approvalReminder(data.household.name, approvalUrl)} label="Copy approval link" variant="outline" />
      </div>
      {notice ? (
        <p role="status" className="mt-4 rounded-xl bg-free-bg px-3 py-3 font-semibold text-free">
          {notice}
        </p>
      ) : null}
      <div className="mt-4">
        <ErrorNote message={error} />
      </div>

      {waiting.length === 0 ? (
        <div className={`${panelClass} mt-4 p-5`}>
          <h1 className="text-2xl">Nothing waiting</h1>
          <p className="mt-2 text-muted-foreground">When someone requests a car, it shows up here.</p>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3">
          {waiting.map((booking) => {
            const window = displayWindow(booking);
            const conflicts = findConflicts(data.bookings, {
              carId: booking.carId,
              startsAt: booking.startsAt,
              endsAt: booking.endsAt,
              excludeId: booking.id,
            });
            const suggestedConflicts =
              booking.status === "suggested" && booking.suggestionStartsAt && booking.suggestionEndsAt
                ? findConflicts(data.bookings, {
                    carId: booking.carId,
                    startsAt: booking.suggestionStartsAt,
                    endsAt: booking.suggestionEndsAt,
                    excludeId: booking.id,
                  })
                : [];
            const when = formatRange(window.startsAt, window.endsAt, now, timeZone);
            return (
              <li key={booking.id} className={`${panelClass} p-4`}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xl">
                    {booking.driverName} · {booking.carName ?? "Any car"}
                  </h2>
                  <StatusPill tone={booking.status === "suggested" ? "suggested" : "pending"}>
                    {booking.status === "suggested" ? "New time" : "Pending"}
                  </StatusPill>
                </div>
                <p className="mt-1 font-semibold">{when}</p>
                <p className="text-muted-foreground">
                  {booking.reason} · {booking.place}
                </p>
                {booking.status === "suggested" ? (
                  <p className="mt-2 text-sm">
                    Original request: {formatRange(booking.startsAt, booking.endsAt, now, timeZone)}
                    {booking.suggestionNote ? `. ${booking.suggestionNote}` : ""}
                  </p>
                ) : null}
                <div className="mt-3">
                  <ConflictAlert
                    conflicts={booking.status === "suggested" ? suggestedConflicts : conflicts}
                    now={now}
                    timeZone={timeZone}
                  />
                </div>
                {!booking.carId ? (
                  <label className="mt-3 grid gap-1.5 text-sm font-bold">
                    Which car?
                    <select
                      className="h-12 rounded-xl border border-input bg-card px-3 text-base font-semibold"
                      value={carChoice[booking.id] ?? ""}
                      onChange={(event) =>
                        setCarChoice((current) => ({ ...current, [booking.id]: event.target.value }))
                      }
                    >
                      <option value="">Pick a car</option>
                      {data.cars.map((car) => (
                        <option key={car.id} value={car.id}>
                          {car.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className="mt-3 grid gap-2">
                  <Button
                    type="button"
                    size="xl"
                    className="w-full"
                    disabled={busyId === booking.id}
                    onClick={() =>
                      void decide(
                        booking.id,
                        {
                          action: "approve",
                          use: booking.status === "suggested" ? "suggested" : "original",
                          carId: booking.carId ?? carChoice[booking.id] ?? null,
                        },
                        `Approved. ${booking.driverName} has the ${booking.carName ?? "car"} ${when}.`,
                      )
                    }
                  >
                    {booking.status === "suggested" ? "Approve suggested time" : "Approve"}
                  </Button>
                  {booking.status === "suggested" ? (
                    <Button
                      type="button"
                      size="xl"
                      variant="outline"
                      className="w-full bg-card"
                      disabled={busyId === booking.id}
                      onClick={() =>
                        void decide(
                          booking.id,
                          { action: "approve", use: "original", carId: booking.carId ?? carChoice[booking.id] ?? null },
                          `Approved the original time for ${booking.driverName}.`,
                        )
                      }
                    >
                      Approve the original time
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="xl"
                    variant="outline"
                    className="w-full bg-card"
                    onClick={() => {
                      setSuggestFor(booking);
                      setDate(booking.startsAt.slice(0, 10));
                      setStart(booking.startsAt.slice(11, 16));
                      setEnd(booking.endsAt.slice(11, 16));
                      setNote("");
                    }}
                  >
                    Suggest another time
                  </Button>
                  <Button
                    type="button"
                    size="xl"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setDeclineFor(booking);
                      setDeclineNote("");
                    }}
                  >
                    Decline
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={declineFor !== null} onOpenChange={(open) => !open && setDeclineFor(null)}>
        <DialogContent>
          <DialogHeader className="pr-8">
            <DialogTitle className="text-xl">Decline this request?</DialogTitle>
            <DialogDescription className="text-base text-foreground">
              {declineFor
                ? `${declineFor.driverName} asked for the ${declineFor.carName ?? "car"}. A short note helps.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={declineNote}
            onChange={(event) => setDeclineNote(event.target.value)}
            placeholder="We need the car for a dentist appointment"
            maxLength={200}
          />
          <Button
            type="button"
            size="xl"
            variant="destructive"
            className="w-full"
            disabled={!declineFor || busyId === declineFor.id}
            onClick={() => {
              if (!declineFor) return;
              void decide(declineFor.id, { action: "decline", note: declineNote }, `Declined ${declineFor.driverName}’s request.`);
            }}
          >
            Decline request
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={suggestFor !== null} onOpenChange={(open) => !open && setSuggestFor(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-xl">Suggest another time</DialogTitle>
            <DialogDescription className="text-base text-foreground">
              {suggestFor ? `${suggestFor.driverName} can accept this from the family link.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="suggest-date">Date</Label>
              <Input id="suggest-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="suggest-start">Start</Label>
                <Input id="suggest-start" type="time" step={300} value={start} onChange={(event) => setStart(event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="suggest-end">End</Label>
                <Input id="suggest-end" type="time" step={300} value={end} onChange={(event) => setEnd(event.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="suggest-note">Note</Label>
              <Textarea
                id="suggest-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Can you take 7:30 instead? I need the car until 7."
                maxLength={200}
              />
            </div>
            <ConflictAlert conflicts={suggestionConflicts} now={now} timeZone={timeZone} />
            <Button
              type="button"
              size="xl"
              className="w-full"
              disabled={!suggestFor || busyId === suggestFor.id}
              onClick={() => {
                if (!suggestFor || !suggestion) {
                  setError("Pick a start and end time.");
                  return;
                }
                void decide(
                  suggestFor.id,
                  { action: "suggest", startsAt: suggestion.startsAt, endsAt: suggestion.endsAt, note },
                  `Suggested a new time to ${suggestFor.driverName}.`,
                );
              }}
            >
              Send suggestion
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
