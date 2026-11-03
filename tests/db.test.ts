import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { CAR_COLORS } from "../lib/constants.ts";
import { DEMO_ADMIN_TOKEN, DEMO_HOUSEHOLD_ID } from "../lib/demo.ts";

const directory = mkdtempSync(path.join(tmpdir(), "garage-"));
process.env.GARAGE_DB = path.join(directory, "garage.sqlite");

test("demo garage is labeled, Jake has the Civic, and the family payload hides the approval token", async () => {
  const { getHouseholdPayload, getAdminPayload, resetDemo } = await import("../lib/db.ts");
  const { findConflicts, carSnapshot } = await import("../lib/schedule.ts");
  const { addMinutes } = await import("../lib/time.ts");

  const payload = resetDemo();
  assert.equal(payload.household.isDemo, true);
  assert.equal(payload.household.name, "Chen family");
  assert.equal(JSON.stringify(payload).includes(DEMO_ADMIN_TOKEN), false);
  assert.equal("adminToken" in payload, false);

  const jake = payload.bookings.find(
    (booking) => booking.driverName === "Jake" && booking.status === "approved" && booking.carName === "Civic",
  );
  assert.ok(jake);
  assert.ok(jake.startsAt <= payload.now && jake.endsAt > payload.now);
  const snapshot = carSnapshot(
    jake.carId ?? "",
    payload.bookings,
    payload.now,
    addMinutes(payload.now, -12 * 60, payload.household.timeZone),
  );
  assert.equal(snapshot.state, "out");
  assert.equal(snapshot.current?.driverName, "Jake");

  const priya = payload.bookings.find(
    (booking) => booking.driverName === "Priya" && booking.status === "pending" && booking.carName === "Civic",
  );
  assert.ok(priya);
  const conflicts = findConflicts(payload.bookings, {
    carId: priya.carId,
    startsAt: priya.startsAt,
    endsAt: priya.endsAt,
    excludeId: priya.id,
  });
  assert.ok(conflicts.some((conflict) => conflict.kind === "approved" && conflict.driverName === "Jake"));

  const admin = getAdminPayload(DEMO_ADMIN_TOKEN);
  assert.equal(admin.adminToken, DEMO_ADMIN_TOKEN);
  assert.equal(getHouseholdPayload(DEMO_HOUSEHOLD_ID).household.id, DEMO_HOUSEHOLD_ID);
});

test("create, conflict, approve, suggest, and mark returned", async () => {
  const {
    createHousehold,
    createBooking,
    getHouseholdPayload,
    getAdminPayload,
    decideBooking,
    actOnBooking,
  } = await import("../lib/db.ts");
  const { findConflicts, carSnapshot } = await import("../lib/schedule.ts");
  const { addMinutes } = await import("../lib/time.ts");

  const created = createHousehold({
    name: "The Parkers",
    timeZone: "America/Chicago",
    cars: [{ name: "Wagon", color: CAR_COLORS[2].hex }],
    drivers: [
      { name: "Alex", isAdmin: true },
      { name: "Riley", isAdmin: false },
    ],
  });
  const garage = getHouseholdPayload(created.householdId);
  assert.equal(JSON.stringify(garage).includes(created.adminToken), false);
  const car = garage.cars[0];
  const alex = garage.drivers.find((driver) => driver.name === "Alex");
  const riley = garage.drivers.find((driver) => driver.name === "Riley");
  assert.ok(car && alex && riley);

  const now = garage.now;
  const first = createBooking(created.householdId, {
    carId: car.id,
    driverId: alex.id,
    startsAt: addMinutes(now, -10, garage.household.timeZone),
    endsAt: addMinutes(now, 120, garage.household.timeZone),
    place: "Clinic",
    reason: "Dentist",
  });
  decideBooking(created.adminToken, first.id, { action: "approve", use: "original", carId: null });

  const overlapStart = addMinutes(now, 30, garage.household.timeZone);
  const overlapEnd = addMinutes(now, 150, garage.household.timeZone);
  const second = createBooking(created.householdId, {
    carId: car.id,
    driverId: riley.id,
    startsAt: overlapStart,
    endsAt: overlapEnd,
    place: "Library",
    reason: "Study group",
  });
  const afterRequest = getHouseholdPayload(created.householdId);
  const conflicts = findConflicts(afterRequest.bookings, {
    carId: car.id,
    startsAt: overlapStart,
    endsAt: overlapEnd,
    excludeId: second.id,
  });
  assert.equal(conflicts.some((conflict) => conflict.kind === "approved"), true);

  const suggestedStart = addMinutes(now, 300, garage.household.timeZone);
  const suggestedEnd = addMinutes(now, 420, garage.household.timeZone);
  decideBooking(created.adminToken, second.id, {
    action: "suggest",
    startsAt: suggestedStart,
    endsAt: suggestedEnd,
    note: "Can you take the later slot?",
  });
  actOnBooking(created.householdId, second.id, {
    action: "accept-suggestion",
    driverId: riley.id,
  });
  const accepted = getAdminPayload(created.adminToken).bookings.find((booking) => booking.id === second.id);
  assert.equal(accepted?.status, "approved");
  assert.equal(accepted?.startsAt, suggestedStart);

  actOnBooking(created.householdId, first.id, { action: "return" });
  const returned = getHouseholdPayload(created.householdId);
  const closed = returned.bookings.find((booking) => booking.id === first.id);
  assert.equal(closed?.status, "returned");
  const snapshot = carSnapshot(
    car.id,
    returned.bookings,
    returned.now,
    addMinutes(returned.now, -12 * 60, returned.household.timeZone),
  );
  assert.notEqual(snapshot.current?.id, first.id);
});
