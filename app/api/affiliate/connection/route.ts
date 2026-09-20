import { NextRequest, NextResponse } from "next/server";
import { authenticateAffiliateClient, isAllowedAffiliateRedirectUri } from "@/lib/server/affiliate-clients";
import { recordAffiliateEvidence } from "@/lib/server/affiliate-onboarding";
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const body = await request.json();
    if (typeof body.client_id !== "string" || typeof body.redirect_uri !== "string" || !authenticateAffiliateClient(body.client_id, request.headers.get("authorization")) || !isAllowedAffiliateRedirectUri(body.client_id, body.redirect_uri)) return NextResponse.json({ error: "Check your server credentials and registered callback URL." }, { status: 401, headers });
    recordAffiliateEvidence(body.client_id, "connectedAt");
    return NextResponse.json({ connected: true, client_id: body.client_id, redirect_uri: body.redirect_uri }, { headers });
  } catch { return NextResponse.json({ error: "Connection check failed. Please retry." }, { status: 400, headers }); }
}
