import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLValue } from "node:sqlite";

import {
  DEMO_ADMIN_TOKEN,
  DEMO_CARS,
  DEMO_DRIVERS,
  DEMO_HOUSEHOLD_ID,
  DEMO_NAME,
  DEMO_TIME_ZONE,
  buildDemoBookings,
} from "@/lib/demo";
import { GarageError } from "@/lib/errors";
import { fileSlug, bookingsToIcs } from "@/lib/ics";
import { assertId, isId, newId } from "@/lib/ids";
import type { AdminDecision, FamilyAction, HouseholdInput } from "@/lib/parse";
import { parseBookingInput, parseHouseholdInput } from "@/lib/parse";
import type { AdminPayload, Booking, Car, Driver, HouseholdPayload, Status } from "@/lib/types";
import { addDays, mondayOf, validateRange, wallNowInZone } from "@/lib/time";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  admin_token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cars (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  is_admin INTEGER NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  car_id TEXT REFERENCES cars(id),
  driver_id TEXT NOT NULL REFERENCES drivers(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  place TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  suggestion_starts_at TEXT,
  suggestion_ends_at TEXT,
  suggestion_note TEXT,
  decision_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  returned_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_bookings_household ON bookings(household_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_cars_household ON cars(household_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_drivers_household ON drivers(household_id, sort_order);
`;

type Store = { db: DatabaseSync };

const globalStore = globalThis as typeof globalThis & { __garage?: Store };

function databasePath(): string {
  return process.env.GARAGE_DB || path.join(process.cwd(), "data", "garage.sqlite");
}

function str(value: SQLValue | undefined): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
}

function strOrNull(value: SQLValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function flag(value: SQLValue | undefined): boolean {
  return value === 1 || value === "1";
}

function getDb(): DatabaseSync {
  if (!globalStore.__garage) {
    const file = databasePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new DatabaseSync(file);
    db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");
    db.exec(SCHEMA);
    globalStore.__garage = { db };
    ensureDemo(db);
  }
  return globalStore.__garage.db;
}

function isoNow(): string {
  return new Date().toISOString();
}

function ensureDemo(db: DatabaseSync): void {
  const existing = db.prepare("SELECT id FROM households WHERE id = ?").get(DEMO_HOUSEHOLD_ID);
  if (existing) return;
  try {
    insertDemo(db);
  } catch (error) {
    const again = db.prepare("SELECT id FROM households WHERE id = ?").get(DEMO_HOUSEHOLD_ID);
    if (!again) throw error;
  }
}

function insertDemo(db: DatabaseSync): void {
  const created = isoNow();
  db.exec("BEGIN");
  try {
    db.prepare(
      "INSERT INTO households (id, admin_token, name, time_zone, is_demo, created_at) VALUES (?, ?, ?, ?, 1, ?)",
    ).run(DEMO_HOUSEHOLD_ID, DEMO_ADMIN_TOKEN, DEMO_NAME, DEMO_TIME_ZONE, created);
    insertDemoPeople(db);
    insertDemoBookings(db);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function insertDemoPeople(db: DatabaseSync): void {
  const carStmt = db.prepare(
    "INSERT INTO cars (id, household_id, name, color, sort_order) VALUES (?, ?, ?, ?, ?)",
  );
  DEMO_CARS.forEach((car, index) => {
    carStmt.run(car.id, DEMO_HOUSEHOLD_ID, car.name, car.color, index);
  });
  const driverStmt = db.prepare(
    "INSERT INTO drivers (id, household_id, name, is_admin, sort_order) VALUES (?, ?, ?, ?, ?)",
  );
  DEMO_DRIVERS.forEach((driver, index) => {
    driverStmt.run(driver.id, DEMO_HOUSEHOLD_ID, driver.name, driver.isAdmin ? 1 : 0, index);
  });
}

function insertDemoBookings(db: DatabaseSync): void {
  const now = wallNowInZone(DEMO_TIME_ZONE);
  const stamp = isoNow();
  const stmt = db.prepare(
    `INSERT INTO bookings (
      id, household_id, car_id, driver_id, starts_at, ends_at, place, reason, status,
      suggestion_starts_at, suggestion_ends_at, suggestion_note, decision_note,
      created_at, updated_at, returned_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, NULL)`,
  );
  for (const draft of buildDemoBookings(now)) {
    stmt.run(
      newId("bk"),
      DEMO_HOUSEHOLD_ID,
      draft.carId,
      draft.driverId,
      draft.startsAt,
      draft.endsAt,
      draft.place,
      draft.reason,
      draft.status,
      stamp,
      stamp,
    );
  }
}

type Loaded = {
  id: string;
  adminToken: string;
  name: string;
  timeZone: string;
  isDemo: boolean;
  createdAt: string;
  cars: Car[];
  drivers: Driver[];
  bookings: Booking[];
};

function load(column: "id" | "admin_token", value: string): Loaded | null {
  assertId(value);
  const db = getDb();
  const household = db
    .prepare(`SELECT * FROM households WHERE ${column} = ?`)
    .get(value);
  if (!household) return null;
  const id = str(household.id);
  const cars = db
    .prepare(
      "SELECT id, name, color FROM cars WHERE household_id = ? ORDER BY sort_order ASC, name ASC",
    )
    .all(id)
    .map((row) => ({ id: str(row.id), name: str(row.name), color: str(row.color) }));
  const drivers = db
    .prepare(
      "SELECT id, name, is_admin FROM drivers WHERE household_id = ? ORDER BY sort_order ASC, name ASC",
    )
    .all(id)
    .map((row) => ({
      id: str(row.id),
      name: str(row.name),
      isAdmin: flag(row.is_admin),
    }));
  const bookings = db
    .prepare(
      `SELECT b.*, c.name AS car_name, c.color AS car_color, d.name AS driver_name
       FROM bookings b
       JOIN drivers d ON d.id = b.driver_id
       LEFT JOIN cars c ON c.id = b.car_id
       WHERE b.household_id = ?
       ORDER BY b.starts_at ASC, b.created_at ASC`,
    )
    .all(id)
    .map((row) => mapBooking(row));
  return {
    id,
    adminToken: str(household.admin_token),
    name: str(household.name),
    timeZone: str(household.time_zone),
    isDemo: flag(household.is_demo),
    createdAt: str(household.created_at),
    cars,
    drivers,
    bookings,
  };
}

function mapBooking(row: Record<string, SQLValue>): Booking {
  return {
    id: str(row.id),
    carId: strOrNull(row.car_id),
    carName: strOrNull(row.car_name),
    carColor: strOrNull(row.car_color),
    driverId: str(row.driver_id),
    driverName: str(row.driver_name),
    startsAt: str(row.starts_at),
    endsAt: str(row.ends_at),
    place: str(row.place),
    reason: str(row.reason),
    status: str(row.status) as Status,
    suggestionStartsAt: strOrNull(row.suggestion_starts_at),
    suggestionEndsAt: strOrNull(row.suggestion_ends_at),
    suggestionNote: strOrNull(row.suggestion_note),
    decisionNote: strOrNull(row.decision_note),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    returnedAt: strOrNull(row.returned_at),
  };
}

function toPayload(loaded: Loaded): HouseholdPayload {
  return {
    household: {
      id: loaded.id,
      name: loaded.name,
      timeZone: loaded.timeZone,
      isDemo: loaded.isDemo,
      createdAt: loaded.createdAt,
    },
    cars: loaded.cars,
    drivers: loaded.drivers,
    bookings: loaded.bookings,
    now: wallNowInZone(loaded.timeZone),
  };
}

function requireById(id: string): Loaded {
  const loaded = load("id", id);
  if (!loaded) throw new GarageError("This link does not match a garage.", 404);
  return loaded;
}

function requireByToken(token: string): Loaded {
  const loaded = load("admin_token", token);
  if (!loaded) throw new GarageError("This approval link does not match a garage.", 404);
  return loaded;
}

export function getHouseholdPayload(id: string): HouseholdPayload {
  return toPayload(requireById(id));
}

export function getAdminPayload(token: string): AdminPayload {
  const loaded = requireByToken(token);
  return { ...toPayload(loaded), adminToken: loaded.adminToken };
}

export function createHousehold(value: unknown): {
  householdId: string;
  adminToken: string;
  name: string;
} {
  const input = parseHouseholdInput(value);
  const db = getDb();
  const householdId = newId("hh");
  const adminToken = newId("ad");
  const created = isoNow();
  db.exec("BEGIN");
  try {
    db.prepare(
      "INSERT INTO households (id, admin_token, name, time_zone, is_demo, created_at) VALUES (?, ?, ?, ?, 0, ?)",
    ).run(householdId, adminToken, input.name, input.timeZone, created);
    const carStmt = db.prepare(
      "INSERT INTO cars (id, household_id, name, color, sort_order) VALUES (?, ?, ?, ?, ?)",
    );
    input.cars.forEach((car, index) => {
      carStmt.run(newId("car"), householdId, car.name, car.color, index);
    });
    const driverStmt = db.prepare(
      "INSERT INTO drivers (id, household_id, name, is_admin, sort_order) VALUES (?, ?, ?, ?, ?)",
    );
    input.drivers.forEach((driver, index) => {
      driverStmt.run(newId("drv"), householdId, driver.name, driver.isAdmin ? 1 : 0, index);
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { householdId, adminToken, name: input.name };
}

function requireDriver(loaded: Loaded, driverId: string): Driver {
  const driver = loaded.drivers.find((item) => item.id === driverId);
  if (!driver) throw new GarageError("That driver is not in this garage.");
  return driver;
}

function requireCar(loaded: Loaded, carId: string): Car {
  const car = loaded.cars.find((item) => item.id === carId);
  if (!car) throw new GarageError("That car is not in this garage.");
  return car;
}

export function createBooking(householdId: string, value: unknown): { id: string } {
  const input = parseBookingInput(value);
  const loaded = requireById(householdId);
  requireDriver(loaded, input.driverId);
  if (input.carId) requireCar(loaded, input.carId);
  const now = wallNowInZone(loaded.timeZone);
  const problem = validateRange(input.startsAt, input.endsAt, now, loaded.timeZone);
  if (problem) throw new GarageError(problem);
  const id = newId("bk");
  const stamp = isoNow();
  getDb()
    .prepare(
      `INSERT INTO bookings (
        id, household_id, car_id, driver_id, starts_at, ends_at, place, reason, status,
        suggestion_starts_at, suggestion_ends_at, suggestion_note, decision_note,
        created_at, updated_at, returned_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, NULL, ?, ?, NULL)`,
    )
    .run(
      id,
      loaded.id,
      input.carId,
      input.driverId,
      input.startsAt,
      input.endsAt,
      input.place,
      input.reason,
      stamp,
      stamp,
    );
  return { id };
}

function requireBooking(loaded: Loaded, bookingId: string): Booking {
  if (!isId(bookingId)) throw new GarageError("That request was not found.", 404);
  const booking = loaded.bookings.find((item) => item.id === bookingId);
  if (!booking) throw new GarageError("That request was not found.", 404);
  return booking;
}

export function decideBooking(token: string, bookingId: string, decision: AdminDecision): void {
  const loaded = requireByToken(token);
  const booking = requireBooking(loaded, bookingId);
  const now = wallNowInZone(loaded.timeZone);
  const stamp = isoNow();
  const db = getDb();

  if (decision.action === "decline") {
    if (booking.status !== "pending" && booking.status !== "suggested") {
      throw new GarageError("This request was already decided.");
    }
    db.prepare(
      "UPDATE bookings SET status = 'declined', decision_note = ?, updated_at = ? WHERE id = ?",
    ).run(decision.note, stamp, booking.id);
    return;
  }

  if (decision.action === "suggest") {
    if (booking.status !== "pending" && booking.status !== "suggested") {
      throw new GarageError("This request was already decided.");
    }
    const problem = validateRange(decision.startsAt, decision.endsAt, now, loaded.timeZone);
    if (problem) throw new GarageError(problem);
    db.prepare(
      `UPDATE bookings
       SET status = 'suggested', suggestion_starts_at = ?, suggestion_ends_at = ?, suggestion_note = ?, updated_at = ?
       WHERE id = ?`,
    ).run(decision.startsAt, decision.endsAt, decision.note, stamp, booking.id);
    return;
  }

  if (booking.status !== "pending" && booking.status !== "suggested") {
    throw new GarageError("This request was already decided.");
  }
  let startsAt = booking.startsAt;
  let endsAt = booking.endsAt;
  if (decision.use === "suggested") {
    if (!booking.suggestionStartsAt || !booking.suggestionEndsAt) {
      throw new GarageError("There is no suggested time to approve.");
    }
    startsAt = booking.suggestionStartsAt;
    endsAt = booking.suggestionEndsAt;
  }
  let carId = booking.carId;
  if (!carId) {
    if (!decision.carId) throw new GarageError("Pick which car to approve.");
    requireCar(loaded, decision.carId);
    carId = decision.carId;
  }
  db.prepare(
    `UPDATE bookings
     SET status = 'approved', car_id = ?, starts_at = ?, ends_at = ?,
         suggestion_starts_at = NULL, suggestion_ends_at = NULL, suggestion_note = NULL,
         updated_at = ?
     WHERE id = ?`,
  ).run(carId, startsAt, endsAt, stamp, booking.id);
}

export function actOnBooking(householdId: string, bookingId: string, action: FamilyAction): void {
  const loaded = requireById(householdId);
  const booking = requireBooking(loaded, bookingId);
  const now = wallNowInZone(loaded.timeZone);
  const stamp = isoNow();
  const db = getDb();

  if (action.action === "accept-suggestion" || action.action === "decline-suggestion") {
    if (booking.driverId !== action.driverId) {
      throw new GarageError("Only the person who requested the car can answer a new time.");
    }
    if (booking.status !== "suggested" || !booking.suggestionStartsAt || !booking.suggestionEndsAt) {
      throw new GarageError("There is no suggested time waiting.");
    }
    if (!booking.carId) {
      throw new GarageError("An admin still needs to pick which car.");
    }
    if (action.action === "decline-suggestion") {
      db.prepare(
        "UPDATE bookings SET status = 'declined', decision_note = ?, updated_at = ? WHERE id = ?",
      ).run("Turned down the suggested time.", stamp, booking.id);
      return;
    }
    db.prepare(
      `UPDATE bookings
       SET status = 'approved', starts_at = ?, ends_at = ?, updated_at = ?
       WHERE id = ?`,
    ).run(booking.suggestionStartsAt, booking.suggestionEndsAt, stamp, booking.id);
    return;
  }

  if (action.action === "return") {
    if (booking.status !== "approved") throw new GarageError("Only an approved trip can be marked returned.");
    if (booking.startsAt > now) throw new GarageError("That trip has not started. Cancel it instead.");
    db.prepare(
      "UPDATE bookings SET status = 'returned', returned_at = ?, updated_at = ? WHERE id = ?",
    ).run(now, stamp, booking.id);
    return;
  }

  const canCancel =
    booking.status === "pending" ||
    booking.status === "suggested" ||
    (booking.status === "approved" && booking.startsAt > now);
  if (!canCancel) {
    throw new GarageError("That booking can no longer be cancelled.");
  }
  db.prepare("UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE id = ?").run(
    stamp,
    booking.id,
  );
}

export function resetDemo(): HouseholdPayload {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM households WHERE id = ?").get(DEMO_HOUSEHOLD_ID);
  if (!existing) {
    insertDemo(db);
    return getHouseholdPayload(DEMO_HOUSEHOLD_ID);
  }
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM bookings WHERE household_id = ?").run(DEMO_HOUSEHOLD_ID);
    insertDemoBookings(db);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getHouseholdPayload(DEMO_HOUSEHOLD_ID);
}

export function householdCalendar(
  householdId: string,
  week: string | null,
  carId: string | null,
): { body: string; filename: string } {
  const loaded = requireById(householdId);
  const now = wallNowInZone(loaded.timeZone);
  const monday = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : mondayOf(now, loaded.timeZone);
  const nextMonday = addDays(monday, 7, loaded.timeZone);
  if (carId) requireCar(loaded, carId);
  const bookings = loaded.bookings.filter((booking) => {
    if (carId && booking.carId !== carId) return false;
    if (booking.status !== "approved" && booking.status !== "returned") return false;
    return booking.startsAt < `${nextMonday}T00:00` && booking.endsAt > `${monday}T00:00`;
  });
  return {
    body: bookingsToIcs({
      calendarName: loaded.name,
      timeZone: loaded.timeZone,
      bookings,
    }),
    filename: `${fileSlug(loaded.name)}-week.ics`,
  };
}

export function bookingCalendar(
  householdId: string,
  bookingId: string,
): { body: string; filename: string } {
  const loaded = requireById(householdId);
  const booking = requireBooking(loaded, bookingId);
  if (booking.status === "declined" || booking.status === "cancelled") {
    throw new GarageError("That booking is not on the calendar.");
  }
  return {
    body: bookingsToIcs({
      calendarName: loaded.name,
      timeZone: loaded.timeZone,
      bookings: [booking],
    }),
    filename: `${fileSlug(booking.carName ?? "car")}.ics`,
  };
}

export function demoHouseholdId(): string {
  getDb();
  return DEMO_HOUSEHOLD_ID;
}

export function demoAdminToken(): string {
  getDb();
  return DEMO_ADMIN_TOKEN;
}

export type { HouseholdInput };
