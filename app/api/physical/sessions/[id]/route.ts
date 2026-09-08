import { NextResponse } from "next/server";
import { getPhysicalStoreSessionOrThrow } from "@/lib/server/enrollment-service";
import { PhysicalSessionError } from "@/lib/server/physical-session-error";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const session = await getPhysicalStoreSessionOrThrow(params.id);
    return NextResponse.json(session, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PhysicalSessionError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "session_expired" ? 410 : 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { error: "Unable to check the store session. Please retry.", code: "session_status_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
