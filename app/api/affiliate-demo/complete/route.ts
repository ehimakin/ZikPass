import { NextRequest, NextResponse } from "next/server";
import { exchangeAffiliateAuthorizationCode } from "@/lib/server/affiliate-verifier";
import { AGE_REQUEST_COOKIE, AGE_SESSION_COOKIE, DEMO_AFFILIATE_ID, DEMO_AFFILIATE_REDIRECT, affiliateCookieOptions, createAffiliateAgeSession } from "@/lib/server/affiliate-demo-session";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const { code, state } = await request.json();
    const expected = request.cookies.get(AGE_REQUEST_COOKIE)?.value;
    if (!expected || !state || state !== expected || typeof code !== "string") throw new Error("Invalid callback");
    // This demo backend represents the affiliate, which exchanges the one-time code itself.
    const result = await exchangeAffiliateAuthorizationCode({ code, state, clientId: DEMO_AFFILIATE_ID, redirectUri: DEMO_AFFILIATE_REDIRECT });
    if (!result.age_over || result.threshold !== 18) throw new Error("Age not confirmed");
    const session = await createAffiliateAgeSession(result.expires_at);
    const response = NextResponse.json({ verified: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(AGE_SESSION_COOKIE, session.token, { ...affiliateCookieOptions(), expires: new Date(session.expiresAt) });
    response.cookies.set(AGE_REQUEST_COOKIE, "", { ...affiliateCookieOptions(), maxAge: 0 });
    return response;
  } catch {
    return NextResponse.json({ error: "Age verification was not confirmed. Please try again." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
