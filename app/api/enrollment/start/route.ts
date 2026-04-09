import { NextRequest, NextResponse } from "next/server";
import type { IdentityMatchInput } from "@/lib/shared/types";
import { buildMockCreditProof } from "@/lib/server/mock-credit-profile";
import { startEnrollment } from "@/lib/server/enrollment-service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      identityMatch: IdentityMatchInput;
      holderPublicKey: JsonWebKey;
      bankName: string;
    };

    if (!body.holderPublicKey) {
      throw new Error("Holder public key is required before issuance.");
    }

    if (!body.bankName?.trim()) {
      throw new Error("A bank must be selected for the refundable verification step.");
    }

    const enrollment = await startEnrollment({
      proof: buildMockCreditProof(body.identityMatch),
      holderPublicKey: body.holderPublicKey,
      bankName: body.bankName.trim()
    });
    return NextResponse.json(enrollment);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start enrollment." },
      { status: 400 }
    );
  }
}
