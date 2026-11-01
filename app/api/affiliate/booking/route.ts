import { NextRequest, NextResponse } from "next/server";
import { developmentOnboardingEnabled } from "@/lib/server/affiliate-onboarding";
import { requestBooking, updateBooking, calendarOptions } from "@/lib/server/affiliate-booking";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (!developmentOnboardingEnabled()) return NextResponse.json({ error: "Development booking is unavailable." }, { status: 404, headers });
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid origin." }, { status: 403, headers });
  try {
    const raw = await request.text(); if (raw.length > 4096) throw new Error("Request too large.");
    const body = JSON.parse(raw); const auth = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    if (typeof body.id !== "string") throw new Error("Invalid setup.");
    if (body.action === "calendar" && ["setup", "pair"].includes(body.scope)) return NextResponse.json(calendarOptions(body.id, auth, body.scope, request.nextUrl.origin), { headers });
    if (body.action === "request" && typeof body.email === "string" && typeof body.startsAt === "string") return NextResponse.json(await requestBooking(body.id, auth, body.email, body.startsAt), { headers });
    if (body.action === "update" && ["confirmed", "cancelled"].includes(body.status)) return NextResponse.json(await updateBooking(body.id, auth, body.status), { headers });
    throw new Error("Invalid booking request.");
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Booking failed." }, { status: 400, headers }); }
}
