import { createBooking, getHouseholdPayload } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { findConflicts } from "@/lib/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const created = createBooking(id, body);
    const payload = getHouseholdPayload(id);
    const booking = payload.bookings.find((item) => item.id === created.id);
    const conflicts = booking
      ? findConflicts(payload.bookings, {
          carId: booking.carId,
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
          excludeId: booking.id,
        })
      : [];
    return json({ ...payload, createdId: created.id, conflicts }, 201);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "That was not valid JSON." }, 400);
    return fail(error);
  }
}
