import { CAR_COLORS } from "@/lib/constants";
import { addDays, addMinutes } from "@/lib/time";

/**
 * Demo household ids. Import this module only from server code.
 * The approval token is the admin secret for the labeled sample garage.
 */
export const DEMO_HOUSEHOLD_ID = "hh_demo_7kQ2mN9pL4xW8vR1";
export const DEMO_ADMIN_TOKEN = "ad_demo_3sD6fH8jK2nP5qT7";
export const DEMO_TIME_ZONE = "America/Chicago";
export const DEMO_NAME = "Chen family";

export const DEMO_CARS = [
  { id: "car_demo_civicHarbor01", name: "Civic", color: CAR_COLORS[0].hex },
  { id: "car_demo_rav4Brake0001", name: "RAV4", color: CAR_COLORS[1].hex },
] as const;

export const DEMO_DRIVERS = [
  { id: "drv_demo_mayaChen00001", name: "Maya", isAdmin: true },
  { id: "drv_demo_samChen000001", name: "Sam", isAdmin: true },
  { id: "drv_demo_jakeChen00001", name: "Jake", isAdmin: false },
  { id: "drv_demo_priyaChen0001", name: "Priya", isAdmin: false },
] as const;

export type DemoBookingDraft = {
  carId: string;
  driverId: string;
  startsAt: string;
  endsAt: string;
  place: string;
  reason: string;
  status: "pending" | "approved";
};

export function buildDemoBookings(now: string, timeZone = DEMO_TIME_ZONE): DemoBookingDraft[] {
  const civic = DEMO_CARS[0].id;
  const rav4 = DEMO_CARS[1].id;
  const jake = DEMO_DRIVERS[2].id;
  const priya = DEMO_DRIVERS[3].id;
  const sam = DEMO_DRIVERS[1].id;
  const maya = DEMO_DRIVERS[0].id;

  const tonight = `${now.slice(0, 10)}T21:30`;
  const jakeEnd = tonight > addMinutes(now, 90, timeZone) ? tonight : addMinutes(now, 180, timeZone);
  const jakeStart = addMinutes(now, -90, timeZone);
  let priyaStart = addMinutes(jakeEnd, -120, timeZone);
  if (priyaStart < jakeStart) priyaStart = jakeStart;

  const tomorrow = addDays(now.slice(0, 10), 1, timeZone);
  const plusTwo = addDays(now.slice(0, 10), 2, timeZone);
  const plusThree = addDays(now.slice(0, 10), 3, timeZone);

  return [
    {
      carId: civic,
      driverId: jake,
      startsAt: jakeStart,
      endsAt: jakeEnd,
      place: "Riverside High",
      reason: "Practice, then dinner at a friend’s",
      status: "approved",
    },
    {
      carId: civic,
      driverId: priya,
      startsAt: priyaStart,
      endsAt: jakeEnd,
      place: "Ms. Alvarez’s",
      reason: "Tutoring",
      status: "pending",
    },
    {
      carId: rav4,
      driverId: priya,
      startsAt: `${tomorrow}T07:15`,
      endsAt: `${tomorrow}T08:10`,
      place: "Lincoln High",
      reason: "School drop-off",
      status: "approved",
    },
    {
      carId: civic,
      driverId: jake,
      startsAt: `${tomorrow}T15:30`,
      endsAt: `${tomorrow}T18:00`,
      place: "Riverside fields",
      reason: "Soccer practice",
      status: "pending",
    },
    {
      carId: rav4,
      driverId: sam,
      startsAt: `${plusTwo}T17:00`,
      endsAt: `${plusTwo}T19:30`,
      place: "Market & Main",
      reason: "Groceries and the hardware store",
      status: "approved",
    },
    {
      carId: civic,
      driverId: maya,
      startsAt: `${plusThree}T18:00`,
      endsAt: `${plusThree}T20:30`,
      place: "The Garcias",
      reason: "Dinner",
      status: "approved",
    },
  ];
}
