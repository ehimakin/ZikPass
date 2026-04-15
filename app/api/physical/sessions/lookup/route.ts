import { NextRequest, NextResponse } from "next/server";
import { lookupPhysicalStoreSessionByCode } from "@/lib/server/enrollment-service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { userCode: string };
    const session = await lookupPhysicalStoreSessionByCode(body.userCode);
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to find that session." },
      { status: 400 }
    );
  }
}
