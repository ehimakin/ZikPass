import { NextRequest, NextResponse } from "next/server";
import { claimNativeAppHandoff } from "@/lib/server/mobile-handoff";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      token?: string;
      holderPublicKey?: JsonWebKey;
    };

    if (!body.token?.trim() || !body.holderPublicKey) {
      throw new Error("A handoff token and native public key are required.");
    }

    return NextResponse.json(
      await claimNativeAppHandoff({
        token: body.token.trim(),
        holderPublicKey: body.holderPublicKey
      })
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to claim the native app handoff." },
      { status: 400 }
    );
  }
}
