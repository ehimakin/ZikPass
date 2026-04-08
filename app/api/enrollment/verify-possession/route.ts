import { NextRequest, NextResponse } from "next/server";
import { verifyPossessionCode } from "@/lib/server/enrollment-service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { enrollmentId: string; code: string };
    const enrollment = await verifyPossessionCode(body.enrollmentId, body.code);
    return NextResponse.json(enrollment);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Possession verification failed." },
      { status: 400 }
    );
  }
}
