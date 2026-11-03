import { resetDemo } from "@/lib/db";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return json(resetDemo());
  } catch (error) {
    return fail(error);
  }
}
