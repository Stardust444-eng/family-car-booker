import { bookingCalendar } from "@/lib/db";
import { fail } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; bookingId: string }> },
) {
  try {
    const { id, bookingId } = await params;
    const file = bookingCalendar(id, bookingId);
    return new Response(file.body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
