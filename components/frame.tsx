"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CarFront, Plus } from "lucide-react";

import { cn } from "cn";

function tabClass(active: boolean) {
  return cn(
    "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-bold",
    active ? "text-foreground" : "text-muted-foreground",
  );
}

export function FamilyFrame({
  householdId,
  children,
}: {
  householdId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const now = pathname === `/h/${householdId}`;
  const request = pathname === `/h/${householdId}/request`;
  const week = pathname === `/h/${householdId}/week`;
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto w-full max-w-md px-4 pt-5 pb-28">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-md px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
          <Link href={`/h/${householdId}`} className={tabClass(now)} aria-current={now ? "page" : undefined}>
            <CarFront />
            Now
          </Link>
          <Link
            href={`/h/${householdId}/request`}
            className={tabClass(request)}
            aria-current={request ? "page" : undefined}
          >
            <Plus />
            Request
          </Link>
          <Link
            href={`/h/${householdId}/week`}
            className={tabClass(week)}
            aria-current={week ? "page" : undefined}
          >
            <CalendarDays />
            Week
          </Link>
        </div>
      </nav>
    </div>
  );
}

export function AdminFrame({
  token,
  householdId,
  name,
  children,
}: {
  token: string;
  householdId?: string;
  name?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const requests = pathname === `/a/${token}`;
  const week = pathname === `/a/${token}/week`;
  return (
    <div className="min-h-dvh bg-background">
      <div className="bg-foreground text-background">
        <div className="mx-auto w-full max-w-md px-4 py-4">
          <p className="text-xs font-bold tracking-[0.16em] text-background/70 uppercase">Approval link</p>
          <p className="mt-1 font-heading text-3xl leading-none">{name ?? "Loading"}</p>
        </div>
      </div>
      <main className="mx-auto w-full max-w-md px-4 pt-5 pb-28">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-md px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
          <Link href={`/a/${token}`} className={tabClass(requests)} aria-current={requests ? "page" : undefined}>
            <Plus />
            Requests
          </Link>
          <Link href={`/a/${token}/week`} className={tabClass(week)} aria-current={week ? "page" : undefined}>
            <CalendarDays />
            Week
          </Link>
          {householdId ? (
            <Link href={`/h/${householdId}`} className={tabClass(false)}>
              <CarFront />
              Now
            </Link>
          ) : null}
        </div>
      </nav>
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-live="polite">
      <p className="text-sm font-semibold text-muted-foreground">Loading the garage…</p>
      <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="h-36 animate-pulse rounded-2xl bg-muted" />
      <div className="h-36 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10" role="alert">
      <h1 className="text-2xl">This link did not open</h1>
      <p className="mt-2 text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-4 font-bold text-primary-foreground"
      >
        Try again
      </button>
      <p className="mt-4 text-sm">
        <Link href="/" className="font-bold underline">
          Back to the start
        </Link>
      </p>
    </div>
  );
}
