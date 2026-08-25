import { NextRequest, NextResponse } from "next/server";
import { createPhysicalStoreSession } from "@/lib/server/enrollment-service";
import { listPhysicalSessions } from "@/lib/server/storage";

export async function GET() {
  try {
    const sessions = await listPhysicalSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load store sessions." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      storeId?: string;
      storeName?: string;
      locationId?: string;
      entryMode?: "retail_card" | "self_directed";
    };
    const session = await createPhysicalStoreSession(body);
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create a store session." },
      { status: 400 }
    );
  }
}
