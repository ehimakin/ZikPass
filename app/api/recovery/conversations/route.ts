import { NextRequest, NextResponse } from "next/server";
import { RecoveryError, listOwnerConversations } from "@/lib/server/recovery-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403, headers });
  }

  try {
    const raw = await request.text();
    if (raw.length > 4096) throw new RecoveryError("Request too large.");
    const body = JSON.parse(raw || "{}");
    if (typeof body.cardId !== "string") throw new RecoveryError("Missing card id.");

    const ownerSecret = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
    const conversations = listOwnerConversations(body.cardId, ownerSecret);
    return NextResponse.json({ conversations }, { headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not list conversations." },
      { status: error instanceof RecoveryError ? 400 : 401, headers }
    );
  }
}
