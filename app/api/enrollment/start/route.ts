import { NextRequest, NextResponse } from "next/server";
import type { IdentityMatchInput } from "@/lib/shared/types";
import type { ProviderSimulatorScenario } from "@/lib/shared/provider-contracts";
import type { PhysicalStoreContext } from "@/lib/shared/types";
import {
  buildApplicationFingerprint,
  buildPhysicalApplicationFingerprint
} from "@/lib/server/application-guard";
import { startEnrollment } from "@/lib/server/enrollment-service";

function validateIdentityMatchInput(input: IdentityMatchInput) {
  if (!input.first_name.trim() || !input.last_name.trim()) {
    throw new Error("Full name is required.");
  }

  if (!input.current_home_address.trim()) {
    throw new Error("Current home address is required.");
  }

  const dob = new Date(input.date_of_birth);
  if (Number.isNaN(dob.getTime())) {
    throw new Error("Date of birth must be a valid date.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      identityMatch: IdentityMatchInput;
      holderPublicKey: JsonWebKey;
      bankName: string;
      demoScenario?: ProviderSimulatorScenario;
      lane?: "remote" | "physical";
      physicalContext?: PhysicalStoreContext;
    };

    if (!body.holderPublicKey) {
      throw new Error("Holder public key is required before issuance.");
    }

    if (body.lane === "physical") {
      if (!body.physicalContext?.session_id) {
        throw new Error("A physical store session is required.");
      }
    } else if (!body.bankName?.trim()) {
      throw new Error("A bank must be selected for the refundable verification step.");
    } else {
      validateIdentityMatchInput(body.identityMatch);
    }

    const enrollment = await startEnrollment({
      application: {
        identity_match: body.lane === "physical" ? undefined : body.identityMatch,
        bank_name:
          body.lane === "physical"
            ? "In-store verification"
            : body.bankName.trim(),
        submitted_at: new Date().toISOString(),
        demo_scenario: body.demoScenario,
        lane: body.lane ?? "remote",
        physical_context: body.physicalContext
      },
      holderPublicKey: body.holderPublicKey,
      applicationFingerprint:
        body.lane === "physical"
          ? buildPhysicalApplicationFingerprint({
              sessionId: body.physicalContext?.session_id ?? "",
              holderPublicKey: body.holderPublicKey
            })
          : buildApplicationFingerprint(body.identityMatch)
    });
    return NextResponse.json(enrollment);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start enrollment." },
      { status: 400 }
    );
  }
}
