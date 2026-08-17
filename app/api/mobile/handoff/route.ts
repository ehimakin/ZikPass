import { NextRequest, NextResponse } from "next/server";
import { buildNativeAppHandoffUrls, createNativeAppHandoff } from "@/lib/server/mobile-handoff";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { enrollmentId?: string };
    if (!body.enrollmentId?.trim()) {
      throw new Error("An enrollment is required before the native app can be opened.");
    }

    const handoff = await createNativeAppHandoff(body.enrollmentId.trim());
    return NextResponse.json({
      expires_at: handoff.expiresAt,
      ...buildNativeAppHandoffUrls(new URL(request.url).origin, handoff.token)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to prepare the native app handoff." },
      { status: 400 }
    );
  }
}
