import { NextRequest, NextResponse } from "next/server";
import { lookupPhysicalStoreSessionByCode } from "@/lib/server/enrollment-service";
import { authenticateRetailVerifier } from "@/lib/server/retail-verifier";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { userCode: string };
    const verifierToken = request.headers.get("x-zik-retailer-token") ?? undefined;
    const verifier = authenticateRetailVerifier(verifierToken);
    const session = await lookupPhysicalStoreSessionByCode(body.userCode);
    if (session.store_id !== verifier.retailer_id || session.location_id !== verifier.location_id) {
      throw new Error("This verifier is not authorised for the requested store session.");
    }
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to find that session." },
      { status: 400 }
    );
  }
}
