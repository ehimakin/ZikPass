import { NextResponse } from "next/server";
import { createZikIdSignalSession } from "@/lib/server/zik-id-sessions";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { offer?: unknown };
    const session = createZikIdSignalSession(body.offer);
    const verifyUrl = new URL("/verify/id", request.url);
    verifyUrl.searchParams.set("session", session.id);
    verifyUrl.searchParams.set("code", session.code);
    return NextResponse.json({ sessionId: session.id, code: session.code, challenge: session.challenge, expiresAt: session.expiresAt, verifyUrl: verifyUrl.toString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create Zik ID request." }, { status: 400 });
  }
}
