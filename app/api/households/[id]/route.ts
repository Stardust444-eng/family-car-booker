import { getHouseholdPayload } from "@/lib/db";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return json(getHouseholdPayload(id));
  } catch (error) {
    return fail(error);
  }
}
