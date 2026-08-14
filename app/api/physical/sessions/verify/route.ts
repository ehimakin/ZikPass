import { NextRequest, NextResponse } from "next/server";
import { rejectPhysicalIdCheck, verifyPhysicalIdCheck } from "@/lib/server/enrollment-service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userCode: string;
      decision?: "confirm" | "reject";
      checkedBy?: string;
      note?: string;
    };
    const verifierToken = request.headers.get("x-zik-retailer-token") ?? undefined;
    const enrollment =
      body.decision === "reject"
        ? await rejectPhysicalIdCheck({ ...body, verifierToken })
        : await verifyPhysicalIdCheck({ ...body, verifierToken });
    return NextResponse.json(enrollment);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to confirm the ID check." },
      { status: 400 }
    );
  }
}
