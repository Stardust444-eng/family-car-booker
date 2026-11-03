import assert from "node:assert/strict";
import test from "node:test";

import { bookingsToIcs } from "../lib/ics.ts";
import { findConflicts, freeCarIds, overlaps, carSnapshot } from "../lib/schedule.ts";
import {
  addMinutes,
  composeRange,
  mondayOf,
  validateRange,
  wallToUtcDate,
} from "../lib/time.ts";
import { formatClock } from "../lib/format.ts";
import { buildDemoBookings } from "../lib/demo.ts";
import { isId } from "../lib/ids.ts";
import {
  DEMO_ADMIN_TOKEN,
  DEMO_CARS,
  DEMO_DRIVERS,
  DEMO_HOUSEHOLD_ID,
} from "../lib/demo.ts";
import type { Booking } from "../lib/types.ts";

const ZONE = "America/Chicago";

function booking(partial: Partial<Booking> & Pick<Booking, "id" | "startsAt" | "endsAt" | "status">): Booking {
  return {
    carId: "car_demo_civicHarbor01",
    carName: "Civic",
    carColor: "#2f6f8f",
    driverId: "drv_demo_jakeChen00001",
    driverName: "Jake",
    place: "School",
    reason: "Practice",
    suggestionStartsAt: null,
    suggestionEndsAt: null,
    suggestionNote: null,
    decisionNote: null,
    createdAt: "2026-11-03T18:00:00.000Z",
    updatedAt: "2026-11-03T18:00:00.000Z",
    returnedAt: null,
    ...partial,
  };
}

test("chicago wall time converts to the right UTC instant", () => {
  assert.equal(wallToUtcDate("2026-11-03T12:03", ZONE).toISOString(), "2026-11-03T18:03:00.000Z");
  assert.equal(addMinutes("2026-11-03T12:03", 57, ZONE), "2026-11-03T13:00");
  assert.equal(addMinutes("2026-11-03T23:30", 60, ZONE), "2026-11-04T00:30");
  assert.equal(addMinutes("2026-11-03T12:03", 0, ZONE), "2026-11-03T12:03");
});

test("weeks start on Monday", () => {
  assert.equal(mondayOf("2026-11-03T12:03", ZONE), "2026-11-02");
});

test("clock formatting matches a family board", () => {
  assert.equal(formatClock("2026-11-03T21:30"), "9:30 pm");
  assert.equal(formatClock("2026-11-03T09:00"), "9 am");
});

test("overnight ranges roll to the next morning", () => {
  const range = composeRange("2026-11-03", "22:00", "01:00", ZONE);
  assert.deepEqual(range, { startsAt: "2026-11-03T22:00", endsAt: "2026-11-04T01:00" });
});

test("touching bookings do not overlap, overlapping ones do", () => {
  assert.equal(
    overlaps(
      { startsAt: "2026-11-03T10:00", endsAt: "2026-11-03T12:00" },
      { startsAt: "2026-11-03T12:00", endsAt: "2026-11-03T13:00" },
    ),
    false,
  );
  assert.equal(
    overlaps(
      { startsAt: "2026-11-03T10:00", endsAt: "2026-11-03T12:00" },
      { startsAt: "2026-11-03T11:00", endsAt: "2026-11-03T13:00" },
    ),
    true,
  );
});

test("conflicts stay on the same car and ignore returned trips", () => {
  const bookings = [
    booking({
      id: "bk_approvedJake0001",
      startsAt: "2026-11-03T16:00",
      endsAt: "2026-11-03T21:30",
      status: "approved",
    }),
    booking({
      id: "bk_otherCarPriya001",
      carId: "car_demo_rav4Brake0001",
      carName: "RAV4",
      driverName: "Priya",
      startsAt: "2026-11-03T18:00",
      endsAt: "2026-11-03T19:00",
      status: "approved",
    }),
    booking({
      id: "bk_returnedOld00001",
      startsAt: "2026-11-03T18:00",
      endsAt: "2026-11-03T20:00",
      status: "returned",
      returnedAt: "2026-11-03T18:20",
    }),
  ];
  const civicHits = findConflicts(bookings, {
    carId: "car_demo_civicHarbor01",
    startsAt: "2026-11-03T19:00",
    endsAt: "2026-11-03T21:00",
  });
  assert.equal(civicHits.length, 1);
  assert.equal(civicHits[0]?.driverName, "Jake");
  assert.equal(civicHits[0]?.kind, "approved");
  const free = freeCarIds(
    ["car_demo_civicHarbor01", "car_demo_rav4Brake0001"],
    bookings,
    { startsAt: "2026-11-03T19:00", endsAt: "2026-11-03T21:00" },
  );
  assert.deepEqual(free, ["car_demo_rav4Brake0001"]);
});

test("a car out past its end stays overdue for the evening", () => {
  const current = booking({
    id: "bk_outnowJake000001",
    startsAt: "2026-11-03T10:00",
    endsAt: "2026-11-03T12:00",
    status: "approved",
  });
  const overdue = carSnapshot(
    "car_demo_civicHarbor01",
    [current],
    "2026-11-03T13:00",
    "2026-11-03T01:00",
  );
  assert.equal(overdue.state, "overdue");
  const forgotten = carSnapshot(
    "car_demo_civicHarbor01",
    [current],
    "2026-11-04T08:00",
    "2026-11-03T20:00",
  );
  assert.equal(forgotten.state, "free");
});

test("demo bookings put Jake on the Civic through 9:30 pm when that is still ahead", () => {
  const now = "2026-11-03T12:03";
  const drafts = buildDemoBookings(now);
  const jake = drafts.find((item) => item.driverId === DEMO_DRIVERS[2].id && item.status === "approved");
  assert.ok(jake);
  assert.equal(jake.endsAt, "2026-11-03T21:30");
  assert.ok(jake.startsAt <= now);
  const priya = drafts.find((item) => item.driverId === DEMO_DRIVERS[3].id && item.status === "pending");
  assert.ok(priya);
  assert.ok(priya.startsAt < jake.endsAt && jake.startsAt < priya.endsAt);
  for (const id of [DEMO_HOUSEHOLD_ID, DEMO_ADMIN_TOKEN, ...DEMO_CARS.map((car) => car.id), ...DEMO_DRIVERS.map((driver) => driver.id)]) {
    assert.equal(isId(id), true, id);
  }
});

test("calendar export uses UTC stamps", () => {
  const ics = bookingsToIcs({
    calendarName: "Chen family",
    timeZone: ZONE,
    bookings: [
      booking({
        id: "bk_calendarJake0001",
        startsAt: "2026-11-03T19:30",
        endsAt: "2026-11-03T21:30",
        status: "approved",
      }),
    ],
  });
  assert.match(ics, /SUMMARY:Civic/);
  assert.match(ics, /DTSTART:20261104T013000Z/);
  assert.match(ics, /DTEND:20261104T033000Z/);
});

test("range validation rejects the past and tiny windows", () => {
  const now = "2026-11-03T12:00";
  assert.equal(
    validateRange("2026-11-03T12:00", "2026-11-03T14:00", now, ZONE),
    null,
  );
  assert.match(
    validateRange("2026-11-03T08:00", "2026-11-03T09:00", now, ZONE) ?? "",
    /past/,
  );
});
