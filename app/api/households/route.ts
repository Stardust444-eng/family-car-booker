import { createHousehold } from "@/lib/db";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return json(createHousehold(body), 201);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "That was not valid JSON." }, 400);
    return fail(error);
  }
}
