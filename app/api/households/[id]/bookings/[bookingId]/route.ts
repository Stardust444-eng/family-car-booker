import { actOnBooking, getHouseholdPayload } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { parseFamilyAction } from "@/lib/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; bookingId: string }> },
) {
  try {
    const { id, bookingId } = await params;
    const action = parseFamilyAction(await request.json());
    actOnBooking(id, bookingId, action);
    return json(getHouseholdPayload(id));
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "That was not valid JSON." }, 400);
    return fail(error);
  }
}
