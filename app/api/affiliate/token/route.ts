import { NextRequest, NextResponse } from "next/server";
import { exchangeAffiliateAuthorizationCode } from "@/lib/server/affiliate-verifier";
import { AFFILIATE_DENIAL_MESSAGE } from "@/lib/shared/affiliate-verifier";
import { authenticateAffiliateClient } from "@/lib/server/affiliate-clients";

/**
 * The one route a real affiliate's own backend would call server-to-server.
 * On any failure this returns only the single calm, generic message — the
 * specific reason (expired code, replay, audience mismatch, ...) is never
 * exposed here, since this is the boundary the affiliate actually trusts.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      code?: string;
      client_id?: string;
      redirect_uri?: string;
      state?: string;
    };

    if (!authenticateAffiliateClient(body.client_id ?? "", request.headers.get("authorization"))) {
      return NextResponse.json({ error: AFFILIATE_DENIAL_MESSAGE }, { status: 401 });
    }
    const result = await exchangeAffiliateAuthorizationCode({
      code: body.code ?? "",
      clientId: body.client_id ?? "",
      redirectUri: body.redirect_uri ?? "",
      state: body.state ?? ""
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: AFFILIATE_DENIAL_MESSAGE }, { status: 400 });
  }
}
