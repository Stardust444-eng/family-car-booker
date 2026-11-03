import { GarageError } from "@/lib/errors";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function fail(error: unknown): Response {
  if (error instanceof GarageError) return json({ error: error.message }, error.status);
  console.error(error);
  return json({ error: "Something went wrong in the garage." }, 500);
}
