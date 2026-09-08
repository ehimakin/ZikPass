import { NextRequest, NextResponse } from "next/server";
import { createAffiliateAuthorizationRequest } from "@/lib/server/affiliate-verifier";
import { toErrorResponse } from "@/lib/server/api-errors";
import { authenticateAffiliateClient } from "@/lib/server/affiliate-clients";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      client_id?: string;
      redirect_uri?: string;
      state?: string;
    };

    if (!authenticateAffiliateClient(body.client_id ?? "", request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Invalid affiliate credentials." }, { status: 401 });
    }
    const authorizationRequest = await createAffiliateAuthorizationRequest({
      clientId: body.client_id ?? "",
      redirectUri: body.redirect_uri ?? "",
      state: body.state ?? ""
    });

    return NextResponse.json({
      request_id: authorizationRequest.request_id,
      nonce: authorizationRequest.nonce,
      challenge: authorizationRequest.challenge,
      challenge_expires_at: authorizationRequest.challenge_expires_at,
      confirm_url: `/affiliate-demo/confirm?request_id=${encodeURIComponent(authorizationRequest.request_id)}`
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
