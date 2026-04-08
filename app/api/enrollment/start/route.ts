import { NextRequest, NextResponse } from "next/server";
import type { IdentityMatchInput } from "@/lib/shared/types";
import { buildMockCreditProof } from "@/lib/server/mock-credit-profile";
import { startEnrollment } from "@/lib/server/enrollment-service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      identityMatch: IdentityMatchInput;
      holderPublicKey: JsonWebKey;
    };

    if (!body.holderPublicKey) {
      throw new Error("Holder public key is required before issuance.");
    }

    const enrollment = await startEnrollment({
      proof: buildMockCreditProof(body.identityMatch),
      holderPublicKey: body.holderPublicKey
    });
    return NextResponse.json(enrollment);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start enrollment." },
      { status: 400 }
    );
  }
}
