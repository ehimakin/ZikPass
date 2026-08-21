import { NextResponse } from "next/server";
import { getAffiliateAuthorizationStatus } from "@/lib/server/affiliate-verifier";

/**
 * Status only — never the verification result itself. This exists for the
 * confirm screen's own UX (e.g. recovering state after a reload); it is
 * never a trust source for the affiliate's access decision, which only
 * ever comes from the one-time code exchange at /api/affiliate/token.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const status = await getAffiliateAuthorizationStatus(params.id);

  if (!status) {
    return NextResponse.json({ error: "This verification request was not found." }, { status: 404 });
  }

  return NextResponse.json(status);
}
