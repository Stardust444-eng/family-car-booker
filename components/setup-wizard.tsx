"use client";

import { useState } from "react";
import Link from "next/link";

import { CopyButton, ErrorNote, panelClass } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { CAR_COLORS, LIMITS } from "@/lib/constants";
import { familyInvite, approvalReminder } from "@/lib/share";
import { cn } from "cn";

type CarDraft = { key: string; name: string; color: string };
type DriverDraft = { key: string; name: string; isAdmin: boolean };
type Created = { householdId: string; adminToken: string; name: string };

export function SetupWizard() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [cars, setCars] = useState<CarDraft[]>([]);
  const [carName, setCarName] = useState("");
  const [carColor, setCarColor] = useState<string>(CAR_COLORS[0].hex);
  const [drivers, setDrivers] = useState<DriverDraft[]>([]);
  const [driverName, setDriverName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  function addCar() {
    const trimmed = carName.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      setError("Name the car.");
      return;
    }
    if (trimmed.length > LIMITS.carName) {
      setError(`Car names must be ${LIMITS.carName} characters or fewer.`);
      return;
    }
    if (cars.some((car) => car.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("That car is already on the list.");
      return;
    }
    if (cars.length >= LIMITS.cars) {
      setError(`A garage can have up to ${LIMITS.cars} cars.`);
      return;
    }
    const nextCars = [...cars, { key: crypto.randomUUID(), name: trimmed, color: carColor }];
    setCars(nextCars);
    setCarName("");
    const used = new Set(nextCars.map((car) => car.color));
    const nextColor = CAR_COLORS.find((color) => !used.has(color.hex));
    if (nextColor) setCarColor(nextColor.hex);
    setError(null);
  }

  function addDriver() {
    const trimmed = driverName.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      setError("Name the driver.");
      return;
    }
    if (trimmed.length > LIMITS.driverName) {
      setError(`Driver names must be ${LIMITS.driverName} characters or fewer.`);
      return;
    }
    if (drivers.some((driver) => driver.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("That driver is already on the list.");
      return;
    }
    if (drivers.length >= LIMITS.drivers) {
      setError(`A garage can have up to ${LIMITS.drivers} drivers.`);
      return;
    }
    setDrivers([...drivers, { key: crypto.randomUUID(), name: trimmed, isAdmin: false }]);
    setDriverName("");
    setError(null);
  }

  function toggleAdmin(key: string) {
    const target = drivers.find((driver) => driver.key === key);
    if (!target) return;
    if (!target.isAdmin && drivers.filter((driver) => driver.isAdmin).length >= LIMITS.admins) {
      setError("Only two people can be admins. Turn one off first.");
      return;
    }
    setError(null);
    setDrivers(drivers.map((driver) => (driver.key === key ? { ...driver, isAdmin: !driver.isAdmin } : driver)));
  }

  async function finish() {
    const trimmed = driverName.trim().replace(/\s+/g, " ");
    let nextDrivers = drivers;
    if (trimmed) {
      if (drivers.some((driver) => driver.name.toLowerCase() === trimmed.toLowerCase())) {
        setError("That driver is already on the list.");
        return;
      }
      nextDrivers = [...drivers, { key: crypto.randomUUID(), name: trimmed, isAdmin: false }];
      setDrivers(nextDrivers);
      setDriverName("");
    }
    const admins = nextDrivers.filter((driver) => driver.isAdmin).length;
    if (nextDrivers.length < 1) {
      setError("Add at least one driver.");
      return;
    }
    if (admins < 1) {
      setError("Choose one or two admins. They approve requests.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api<Created>("/api/households", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          cars: cars.map((car) => ({ name: car.name, color: car.color })),
          drivers: nextDrivers.map((driver) => ({ name: driver.name, isAdmin: driver.isAdmin })),
        }),
      });
      setCreated(result);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the garage.");
    } finally {
      setBusy(false);
    }
  }

  if (created && step === 3) {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const familyUrl = `${origin}/h/${created.householdId}`;
    const approvalUrl = `${origin}/a/${created.adminToken}`;
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-8" data-testid="setup-ready">
        <p className="text-sm font-extrabold tracking-wide text-muted-foreground">Family Car Booker</p>
        <h1 className="text-[2.2rem] leading-none">{created.name} is ready</h1>
        <p>Text the family link. Keep the approval link for the admins. It will not appear on the family board.</p>
        <section className={`${panelClass} border-l-4 border-l-free p-4`}>
          <h2 className="text-2xl">Family link</h2>
          <p className="mt-1 text-sm text-muted-foreground">Everyone who drives opens this. They can request, not approve.</p>
          <p className="mt-3 break-all text-sm font-semibold">{familyUrl}</p>
          <div className="mt-3 grid gap-2">
            <CopyButton text={familyUrl} label="Copy family link" />
            <CopyButton text={familyInvite(created.name, familyUrl)} label="Copy a text to send" variant="outline" />
          </div>
        </section>
        <section className={`${panelClass} border-l-4 border-l-foreground p-4`}>
          <h2 className="text-2xl">Approval link</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Private. This is the only way to approve, decline, or suggest another time.
          </p>
          <p className="mt-3 break-all text-sm font-semibold">{approvalUrl}</p>
          <div className="mt-3">
            <CopyButton text={approvalReminder(created.name, approvalUrl)} label="Copy approval link" variant="outline" />
          </div>
        </section>
        <Link
          href={`/h/${created.householdId}`}
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground"
        >
          Open the garage
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8">
      <p className="text-sm font-extrabold tracking-wide text-muted-foreground">
        Family Car Booker · Step {step + 1} of 3
      </p>
      {step === 0 ? (
        <form
          className="mt-6 grid gap-4"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim().replace(/\s+/g, " ");
            if (!trimmed) {
              setError("Name the household.");
              return;
            }
            if (trimmed.length > LIMITS.name) {
              setError(`Keep the name to ${LIMITS.name} characters or fewer.`);
              return;
            }
            setName(trimmed);
            setError(null);
            setStep(1);
          }}
        >
          <h1 className="text-[2.2rem] leading-none">What should we call the household?</h1>
          <p className="text-muted-foreground">This name shows on both links. It does not have to be a couple.</p>
          <div className="grid gap-1.5">
            <Label htmlFor="household-name" className="text-base">
              Household name
            </Label>
            <Input
              id="household-name"
              name="household-title"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="The Nolans"
              maxLength={LIMITS.name}
              autoComplete="off"
              autoFocus
            />
          </div>
          <ErrorNote message={error} />
          <Button type="submit" size="xl" className="w-full">
            Continue
          </Button>
        </form>
      ) : null}

      {step === 1 ? (
        <form
          className="mt-6 grid gap-4"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = carName.trim().replace(/\s+/g, " ");
            let next = cars;
            if (trimmed) {
              if (trimmed.length > LIMITS.carName) {
                setError(`Car names must be ${LIMITS.carName} characters or fewer.`);
                return;
              }
              if (cars.some((car) => car.name.toLowerCase() === trimmed.toLowerCase())) {
                setError("That car is already on the list.");
                return;
              }
              next = [...cars, { key: crypto.randomUUID(), name: trimmed, color: carColor }];
              setCars(next);
              setCarName("");
            }
            if (next.length === 0) {
              setError("Add at least one car.");
              return;
            }
            setError(null);
            setStep(2);
          }}
        >
          <h1 className="text-[2.2rem] leading-none">Which cars are in the driveway?</h1>
          <p className="text-muted-foreground">A short name and a color, so the board is easy to scan.</p>
          <div className="grid gap-1.5">
            <Label htmlFor="car-name" className="text-base">
              Car name
            </Label>
            <Input
              id="car-name"
              name="vehicle-label"
              value={carName}
              onChange={(event) => setCarName(event.target.value)}
              placeholder="Civic"
              maxLength={LIMITS.carName}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Car color">
            {CAR_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                aria-label={color.name}
                aria-checked={carColor === color.hex}
                role="radio"
                onClick={() => setCarColor(color.hex)}
                className={cn(
                  "size-11 rounded-full ring-2 ring-offset-2 ring-offset-background",
                  carColor === color.hex ? "ring-foreground" : "ring-transparent",
                )}
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
          <Button type="button" size="xl" variant="outline" className="w-full bg-card" onClick={addCar}>
            Add car
          </Button>
          {cars.length > 0 ? (
            <ul className="grid gap-2">
              {cars.map((car) => (
                <li key={car.key} className="flex items-center gap-3 rounded-xl bg-card px-3 py-3 ring-1 ring-foreground/10">
                  <span className="size-4 rounded-full" style={{ backgroundColor: car.color }} />
                  <span className="flex-1 font-bold">{car.name}</span>
                  <button
                    type="button"
                    className="text-sm font-bold text-muted-foreground"
                    onClick={() => setCars(cars.filter((item) => item.key !== car.key))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No cars yet.</p>
          )}
          <ErrorNote message={error} />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="xl" variant="outline" className="bg-card" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button type="submit" size="xl">
              Continue
            </Button>
          </div>
        </form>
      ) : null}

      {step === 2 ? (
        <form
          className="mt-6 grid gap-4"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            if (driverName.trim()) addDriver();
            else void finish();
          }}
        >
          <h1 className="text-[2.2rem] leading-none">Who drives?</h1>
          <p className="text-muted-foreground">
            Mark one or two admins. They approve from a private link. It does not have to be a couple.
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="driver-name" className="text-base">
              Driver name
            </Label>
            <Input
              id="driver-name"
              name="person-label"
              value={driverName}
              onChange={(event) => setDriverName(event.target.value)}
              placeholder="Priya"
              maxLength={LIMITS.driverName}
              autoComplete="off"
            />
          </div>
          <Button type="button" size="xl" variant="outline" className="w-full bg-card" onClick={addDriver}>
            Add driver
          </Button>
          {drivers.length > 0 ? (
            <ul className="grid gap-2">
              {drivers.map((driver) => (
                <li key={driver.key} className="flex items-center gap-2 rounded-xl bg-card px-3 py-3 ring-1 ring-foreground/10">
                  <span className="flex-1 font-bold">{driver.name}</span>
                  <button
                    type="button"
                    aria-pressed={driver.isAdmin}
                    onClick={() => toggleAdmin(driver.key)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm font-bold",
                      driver.isAdmin ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {driver.isAdmin ? "Admin" : "Make admin"}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-bold text-muted-foreground"
                    onClick={() => setDrivers(drivers.filter((item) => item.key !== driver.key))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No drivers yet.</p>
          )}
          <p className="text-sm text-muted-foreground">
            {drivers.filter((driver) => driver.isAdmin).length} of 2 admins
          </p>
          <ErrorNote message={error} />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="xl" variant="outline" className="bg-card" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="button" size="xl" disabled={busy} onClick={() => void finish()}>
              {busy ? "Creating…" : "Create links"}
            </Button>
          </div>
        </form>
      ) : null}
      <p className="mt-8 text-sm">
        <Link href="/" className="font-bold underline">
          Back to the start
        </Link>
      </p>
    </main>
  );
}
