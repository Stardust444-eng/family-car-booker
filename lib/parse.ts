import { isCarColor, LIMITS } from "@/lib/constants";
import { GarageError } from "@/lib/errors";
import { isId } from "@/lib/ids";
import { isValidTimeZone, isWall } from "@/lib/time";

export type HouseholdInput = {
  name: string;
  timeZone: string;
  cars: { name: string; color: string }[];
  drivers: { name: string; isAdmin: boolean }[];
};

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GarageError("Expected an object.");
  }
  return value as Record<string, unknown>;
}

export function cleanText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string") throw new GarageError(`${label} is required.`);
  const text = value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) throw new GarageError(`${label} is required.`);
  if (text.length > max) throw new GarageError(`${label} must be ${max} characters or fewer.`);
  return text;
}

function optionalNote(value: unknown): string | null {
  if (value == null || value === "") return null;
  return cleanText(value, "Note", LIMITS.note);
}

export function parseHouseholdInput(value: unknown): HouseholdInput {
  const body = asRecord(value);
  const name = cleanText(body.name, "Household name", LIMITS.name);
  if (typeof body.timeZone !== "string" || !isValidTimeZone(body.timeZone)) {
    throw new GarageError("Pick a valid timezone.");
  }
  if (!Array.isArray(body.cars) || body.cars.length < 1) {
    throw new GarageError("Add at least one car.");
  }
  if (body.cars.length > LIMITS.cars) {
    throw new GarageError(`A garage can have up to ${LIMITS.cars} cars.`);
  }
  if (!Array.isArray(body.drivers) || body.drivers.length < 1) {
    throw new GarageError("Add at least one driver.");
  }
  if (body.drivers.length > LIMITS.drivers) {
    throw new GarageError(`A garage can have up to ${LIMITS.drivers} drivers.`);
  }

  const cars = body.cars.map((car) => {
    const record = asRecord(car);
    const carName = cleanText(record.name, "Car name", LIMITS.carName);
    if (typeof record.color !== "string" || !isCarColor(record.color)) {
      throw new GarageError(`Pick a color for ${carName}.`);
    }
    return { name: carName, color: record.color.toLowerCase() };
  });
  const carNames = new Set(cars.map((car) => car.name.toLowerCase()));
  if (carNames.size !== cars.length) throw new GarageError("Two cars have the same name.");

  const drivers = body.drivers.map((driver) => {
    const record = asRecord(driver);
    return {
      name: cleanText(record.name, "Driver name", LIMITS.driverName),
      isAdmin: record.isAdmin === true,
    };
  });
  const driverNames = new Set(drivers.map((driver) => driver.name.toLowerCase()));
  if (driverNames.size !== drivers.length) throw new GarageError("Two drivers have the same name.");
  const admins = drivers.filter((driver) => driver.isAdmin).length;
  if (admins < 1) throw new GarageError("Choose one or two admins. They approve requests.");
  if (admins > LIMITS.admins) throw new GarageError("Only two people can be admins.");

  return { name, timeZone: body.timeZone, cars, drivers };
}

export function parseBookingInput(value: unknown): {
  carId: string | null;
  driverId: string;
  startsAt: string;
  endsAt: string;
  place: string;
  reason: string;
} {
  const body = asRecord(value);
  const driverId = typeof body.driverId === "string" ? body.driverId : "";
  if (!isId(driverId)) throw new GarageError("Pick who is requesting the car.");
  let carId: string | null = null;
  if (body.carId != null && body.carId !== "" && body.carId !== "any") {
    if (typeof body.carId !== "string" || !isId(body.carId)) throw new GarageError("Pick a car.");
    carId = body.carId;
  }
  if (typeof body.startsAt !== "string" || !isWall(body.startsAt)) {
    throw new GarageError("Pick a start time.");
  }
  if (typeof body.endsAt !== "string" || !isWall(body.endsAt)) {
    throw new GarageError("Pick an end time.");
  }
  return {
    carId,
    driverId,
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    place: cleanText(body.place, "Where", LIMITS.place),
    reason: cleanText(body.reason, "Why", LIMITS.reason),
  };
}

export type AdminDecision =
  | { action: "approve"; use: "original" | "suggested"; carId: string | null }
  | { action: "decline"; note: string | null }
  | { action: "suggest"; startsAt: string; endsAt: string; note: string | null };

export function parseAdminDecision(value: unknown): AdminDecision {
  const body = asRecord(value);
  if (body.action === "approve") {
    let carId: string | null = null;
    if (typeof body.carId === "string" && body.carId) {
      if (!isId(body.carId)) throw new GarageError("Pick a car.");
      carId = body.carId;
    }
    return {
      action: "approve",
      use: body.use === "suggested" ? "suggested" : "original",
      carId,
    };
  }
  if (body.action === "decline") return { action: "decline", note: optionalNote(body.note) };
  if (body.action === "suggest") {
    if (typeof body.startsAt !== "string" || !isWall(body.startsAt)) {
      throw new GarageError("Pick a suggested start time.");
    }
    if (typeof body.endsAt !== "string" || !isWall(body.endsAt)) {
      throw new GarageError("Pick a suggested end time.");
    }
    return {
      action: "suggest",
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      note: optionalNote(body.note),
    };
  }
  throw new GarageError("Choose approve, decline, or suggest another time.");
}

export type FamilyAction =
  | { action: "return" }
  | { action: "cancel" }
  | { action: "accept-suggestion"; driverId: string }
  | { action: "decline-suggestion"; driverId: string };

export function parseFamilyAction(value: unknown): FamilyAction {
  const body = asRecord(value);
  if (body.action === "return") return { action: "return" };
  if (body.action === "cancel") return { action: "cancel" };
  if (body.action === "accept-suggestion" || body.action === "decline-suggestion") {
    if (typeof body.driverId !== "string" || !isId(body.driverId)) {
      throw new GarageError("Pick the driver this request belongs to.");
    }
    return { action: body.action, driverId: body.driverId };
  }
  throw new GarageError("That action is not available.");
}
