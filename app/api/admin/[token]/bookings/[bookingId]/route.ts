import { decideBooking, getAdminPayload } from "@/lib/db";
import { fail, json } from "@/lib/http";
import { parseAdminDecision } from "@/lib/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string; bookingId: string }> },
) {
  try {
    const { token, bookingId } = await params;
    const decision = parseAdminDecision(await request.json());
    decideBooking(token, bookingId, decision);
    return json(getAdminPayload(token));
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "That was not valid JSON." }, 400);
    return fail(error);
  }
}
