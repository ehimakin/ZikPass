import { NextRequest, NextResponse } from "next/server";
import { advanceCoolingOff } from "@/lib/server/enrollment-service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { enrollmentId: string };
    const enrollment = await advanceCoolingOff(body.enrollmentId);
    return NextResponse.json(enrollment);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to advance cooling-off." },
      { status: 400 }
    );
  }
}
