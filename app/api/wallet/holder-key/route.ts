import { NextResponse } from "next/server";
import { generateKeyPair } from "@/lib/shared/crypto/ed25519";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Development key fallback is disabled." }, { status: 404 });
  }

  try {
    return NextResponse.json(await generateKeyPair());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create a holder key." },
      { status: 503 }
    );
  }
}
