import { NextRequest, NextResponse } from "next/server";
import { verifyPhysicalIdCheck } from "@/lib/server/enrollment-service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userCode: string;
      checkedBy?: string;
      note?: string;
    };
    const enrollment = await verifyPhysicalIdCheck(body);
    return NextResponse.json(enrollment);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to confirm the ID check." },
      { status: 400 }
    );
  }
}
