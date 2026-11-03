import { getAdminPayload } from "@/lib/db";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    return json(getAdminPayload(token));
  } catch (error) {
    return fail(error);
  }
}
