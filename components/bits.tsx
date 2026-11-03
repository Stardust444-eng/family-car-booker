"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGarage } from "@/components/providers";
import { copyText } from "@/lib/clipboard";
import { formatRange } from "@/lib/format";
import type { Booking, Conflict, Driver } from "@/lib/types";
import { cn } from "cn";

export const panelClass =
  "overflow-hidden rounded-2xl bg-card shadow-[0_1px_0_rgba(28,25,21,0.04),0_10px_28px_rgba(28,25,21,0.05)] ring-1 ring-foreground/10";

export function StatusPill({
  tone,
  children,
}: {
  tone: "free" | "booked" | "pending" | "suggested" | "muted";
  children: React.ReactNode;
}) {
  const toneClass = {
    free: "bg-free-bg text-free",
    booked: "bg-booked-bg text-booked",
    pending: "bg-pending-bg text-pending",
    suggested: "bg-suggested-bg text-suggested",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold", toneClass)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

export function CopyButton({
  text,
  label,
  variant = "default",
}: {
  text: string;
  label: string;
  variant?: "default" | "outline";
}) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      size="xl"
      variant={variant}
      className={cn("w-full", variant === "outline" && "bg-card")}
      disabled={!text}
      onClick={() => {
        void copyText(text).then((ok) => {
          if (!ok) return;
          setDone(true);
          window.setTimeout(() => setDone(false), 1800);
        });
      }}
    >
      {done ? <Check /> : <Copy />}
      {done ? "Copied" : label}
    </Button>
  );
}

export function ConflictAlert({
  conflicts,
  driverName,
  now,
  timeZone,
}: {
  conflicts: Conflict[];
  driverName?: string;
  now: string;
  timeZone: string;
}) {
  if (conflicts.length === 0) return null;
  const approved = conflicts.filter((conflict) => conflict.kind === "approved");
  const waiting = conflicts.filter((conflict) => conflict.kind === "waiting");
  const hot = approved.length > 0;
  return (
    <div
      role="status"
      data-testid="conflict-warning"
      className={cn(
        "grid gap-1 rounded-xl px-3 py-3 text-sm leading-snug",
        hot ? "bg-booked-bg text-booked" : "bg-pending-bg text-pending",
      )}
    >
      {approved.map((conflict) => (
        <p key={`${conflict.bookingId}-approved`}>
          <strong>
            {conflict.driverName === driverName ? "You already have" : `${conflict.driverName} already has`} the{" "}
            {conflict.carName ?? "car"}
          </strong>{" "}
          {formatRange(conflict.startsAt, conflict.endsAt, now, timeZone)}
          {conflict.reason ? ` for ${conflict.reason}` : ""}.
        </p>
      ))}
      {waiting.map((conflict) => (
        <p key={`${conflict.bookingId}-waiting`}>
          {conflict.driverName} already asked for the {conflict.carName ?? "car"}{" "}
          {formatRange(conflict.startsAt, conflict.endsAt, now, timeZone)}. An admin has not answered yet.
        </p>
      ))}
      {hot ? <p>You can still send this. An admin will see the overlap.</p> : null}
    </div>
  );
}

export function WhoDialog({
  open,
  onOpenChange,
  drivers,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drivers: Driver[];
  onChoose: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl">Who is using this phone?</DialogTitle>
          <DialogDescription className="text-base text-foreground">
            Pick your name. This phone remembers it. There is no account.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {drivers.map((driver) => (
            <Button
              key={driver.id}
              type="button"
              size="xl"
              variant="outline"
              className="w-full justify-between bg-card"
              onClick={() => {
                onChoose(driver.id);
                onOpenChange(false);
              }}
            >
              {driver.name}
              {driver.isAdmin ? <span className="text-sm font-semibold text-muted-foreground">Admin</span> : null}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function GarageHeader({ title, backHref }: { title?: string; backHref?: string }) {
  const { data, driver, chooseDriver } = useGarage();
  const [open, setOpen] = useState(false);
  return (
    <header className="mb-5">
      {backHref ? (
        <Link href={backHref} className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-muted-foreground">
          <ChevronLeft className="size-4" />
          Now
        </Link>
      ) : (
        <p className="text-sm font-extrabold tracking-wide text-muted-foreground">Family Car Booker</p>
      )}
      <div className="mt-1 flex items-start justify-between gap-3">
        <h1 className="text-[2rem] leading-[1.05]">{title ?? data.household.name}</h1>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1 shrink-0 rounded-full bg-secondary px-3 py-2 text-sm font-bold"
        >
          {driver ? driver.name : "Who are you?"}
        </button>
      </div>
      <WhoDialog
        open={open}
        onOpenChange={setOpen}
        drivers={data.drivers}
        onChoose={chooseDriver}
      />
    </header>
  );
}

export function ReturnDialog({
  booking,
  now,
  timeZone,
  busy,
  onOpenChange,
  onConfirm,
}: {
  booking: Booking | null;
  now: string;
  timeZone: string;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={booking !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl">Is the {booking?.carName ?? "car"} back?</DialogTitle>
          <DialogDescription className="text-base text-foreground">
            {booking
              ? `This ends ${booking.driverName}’s booking now. It was supposed to run ${formatRange(booking.startsAt, booking.endsAt, now, timeZone)}.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Button type="button" size="xl" className="w-full" disabled={busy} onClick={onConfirm}>
            Yes, it is back
          </Button>
          <Button type="button" size="xl" variant="outline" className="w-full bg-card" onClick={() => onOpenChange(false)}>
            Not yet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
      {message}
    </p>
  );
}
