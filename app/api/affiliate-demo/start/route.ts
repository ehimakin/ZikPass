import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAffiliateAuthorizationRequest } from "@/lib/server/affiliate-verifier";
import { AGE_REQUEST_COOKIE, DEMO_AFFILIATE_ID, DEMO_AFFILIATE_REDIRECT, affiliateCookieOptions } from "@/lib/server/affiliate-demo-session";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const state = randomBytes(32).toString("base64url");
    const authorization = await createAffiliateAuthorizationRequest({ clientId: DEMO_AFFILIATE_ID, redirectUri: DEMO_AFFILIATE_REDIRECT, state });
    const response = NextResponse.json({ confirm_url: `/affiliate-demo/confirm?request_id=${encodeURIComponent(authorization.request_id)}` }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(AGE_REQUEST_COOKIE, state, { ...affiliateCookieOptions(), maxAge: 600 });
    return response;
  } catch {
    return NextResponse.json({ error: "Could not start verification. Please try again." }, { status: 503 });
  }
}
