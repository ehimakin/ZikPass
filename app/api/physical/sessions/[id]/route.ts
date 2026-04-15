import { NextResponse } from "next/server";
import { getPhysicalStoreSessionOrThrow } from "@/lib/server/enrollment-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const session = await getPhysicalStoreSessionOrThrow(params.id);
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Store session not found." },
      { status: 404 }
    );
  }
}
