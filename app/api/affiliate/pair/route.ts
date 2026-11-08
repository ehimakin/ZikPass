import { NextRequest, NextResponse } from "next/server";
import { createPair, developmentOnboardingEnabled, joinPair, pairProgress } from "@/lib/server/affiliate-onboarding";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (!developmentOnboardingEnabled()) return NextResponse.json({ error: "Development pairing is unavailable." }, { status: 404, headers });
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid origin." }, { status: 403, headers });
  try {
    const raw = await request.text(); if (raw.length > 16384) throw new Error("Request too large.");
    const body = JSON.parse(raw); if (typeof body.id !== "string") throw new Error("Invalid session.");
    const credential = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    if (body.action === "create") return NextResponse.json(createPair(body.id, credential), { headers });
    if (body.action === "join") {
      if (typeof body.key !== "string" || !["client", "agent"].includes(body.role)) throw new Error("Choose a role and enter your pairing key.");
      return NextResponse.json(joinPair(body.id, body.key, body.role, credential), { headers });
    }
    if (body.action === "progress") return NextResponse.json(pairProgress(body.id, credential, body.input), { headers });
    throw new Error("Unknown pairing action.");
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update session." }, { status: 400, headers }); }
}
