import { NextRequest, NextResponse } from "next/server";
import { createAffiliateAuthorizationRequest } from "@/lib/server/affiliate-verifier";
import { toErrorResponse } from "@/lib/server/api-errors";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      client_id?: string;
      redirect_uri?: string;
      state?: string;
    };

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
