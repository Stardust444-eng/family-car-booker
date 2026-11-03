export const STATUSES = [
  "pending",
  "approved",
  "declined",
  "suggested",
  "returned",
  "cancelled",
] as const;

export type Status = (typeof STATUSES)[number];

export type Car = {
  id: string;
  name: string;
  color: string;
};

export type Driver = {
  id: string;
  name: string;
  isAdmin: boolean;
};

export type Booking = {
  id: string;
  carId: string | null;
  carName: string | null;
  carColor: string | null;
  driverId: string;
  driverName: string;
  startsAt: string;
  endsAt: string;
  place: string;
  reason: string;
  status: Status;
  suggestionStartsAt: string | null;
  suggestionEndsAt: string | null;
  suggestionNote: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
  returnedAt: string | null;
};

export type Household = {
  id: string;
  name: string;
  timeZone: string;
  isDemo: boolean;
  createdAt: string;
};

export type HouseholdPayload = {
  household: Household;
  cars: Car[];
  drivers: Driver[];
  bookings: Booking[];
  now: string;
};

export type AdminPayload = HouseholdPayload & {
  adminToken: string;
};

export type Conflict = {
  bookingId: string;
  carId: string | null;
  carName: string | null;
  driverName: string;
  startsAt: string;
  endsAt: string;
  status: Status;
  place: string;
  reason: string;
  kind: "approved" | "waiting";
};

export type Interval = {
  startsAt: string;
  endsAt: string;
};
