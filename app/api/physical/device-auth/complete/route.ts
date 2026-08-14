import { NextRequest, NextResponse } from "next/server";
import { completePhysicalDeviceAuth } from "@/lib/server/enrollment-service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      enrollmentId: string;
      challengeId: string;
      method: "webauthn" | "demo_device_check";
      webauthnCredentialId?: string;
      clientDataJson?: string;
    };
    const enrollment = await completePhysicalDeviceAuth(body);
    return NextResponse.json(enrollment);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to complete device authentication." },
      { status: 400 }
    );
  }
}
