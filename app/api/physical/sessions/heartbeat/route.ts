import { NextRequest, NextResponse } from "next/server";
import { touchPhysicalStoreSession } from "@/lib/server/enrollment-service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sessionId?: string };
    if (!body.sessionId?.trim()) {
      throw new Error("A physical session is required.");
    }

    return NextResponse.json(await touchPhysicalStoreSession(body.sessionId.trim()));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update the physical session." },
      { status: 400 }
    );
  }
}
