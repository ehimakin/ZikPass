import { NextRequest, NextResponse } from "next/server";
import { startPhysicalDeviceAuth } from "@/lib/server/enrollment-service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { enrollmentId: string };
    const result = await startPhysicalDeviceAuth(body.enrollmentId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start device authentication." },
      { status: 400 }
    );
  }
}
