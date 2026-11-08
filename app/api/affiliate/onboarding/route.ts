import { NextRequest, NextResponse } from "next/server";
import { createRegistration, developmentOnboardingEnabled, getRegistration, updateRegistration } from "@/lib/server/affiliate-onboarding";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: NextRequest) {
  if (!developmentOnboardingEnabled()) return NextResponse.json({ error: "Development onboarding is unavailable." }, { status: 404, headers });
  try {
    const registration = getRegistration(request.nextUrl.searchParams.get("id") ?? "", request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
    return NextResponse.json({ registration }, { headers });
  } catch { return NextResponse.json({ error: "This setup link is invalid or expired." }, { status: 401, headers }); }
}
export async function POST(request: NextRequest) {
  if (!developmentOnboardingEnabled()) return NextResponse.json({ error: "Development onboarding is unavailable." }, { status: 404, headers });
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid origin." }, { status: 403, headers });
  try {
    const raw = await request.text(); if (raw.length > 8192) throw new Error("Request is too large.");
    const body = JSON.parse(raw);
    if (body.action === "create") {
      if (![body.name, body.website, body.callback].every(v => typeof v === "string")) throw new Error("Enter your site details.");
      return NextResponse.json(createRegistration(body.name, body.website, body.callback), { status: 201, headers });
    }
    if (typeof body.id !== "string" || typeof body.action !== "string" || (body.email !== undefined && typeof body.email !== "string") || (body.note !== undefined && typeof body.note !== "string")) throw new Error("Invalid setup request.");
    return NextResponse.json(updateRegistration(body.id, request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "", body.action, body), { headers });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save setup." }, { status: 400, headers }); }
}
