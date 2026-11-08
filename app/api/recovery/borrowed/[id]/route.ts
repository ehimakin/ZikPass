import { NextRequest, NextResponse } from "next/server";
import {
  RecoveryError,
  authorizeBorrowed,
  endBorrowedSession,
  exchangeReplyToken,
  getKeyMaterialForConversation
} from "@/lib/server/recovery-service";

export const runtime = "nodejs";

function bearerToken(request: NextRequest): string {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "no-store" };
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403, headers });
  }
  const { id } = await context.params;

  try {
    const raw = await request.text();
    if (raw.length > 4096) throw new RecoveryError("Request too large.");
    const body = JSON.parse(raw || "{}");

    if (body.action === "exchange") {
      if (typeof body.replyToken !== "string") throw new RecoveryError("Missing reply link token.");
      const sessionToken = exchangeReplyToken(id, body.replyToken);
      const conversation = authorizeBorrowed(id, sessionToken);
      const keyMaterial = getKeyMaterialForConversation(conversation);
      return NextResponse.json(
        {
          sessionToken,
          ownerPublicKey: conversation.owner_public_key,
          finderPublicKey: conversation.finder_public_key,
          envelope: keyMaterial.envelope,
          sealed: keyMaterial.sealed
        },
        { headers }
      );
    }
    if (body.action === "end") {
      endBorrowedSession(id, bearerToken(request));
      return NextResponse.json({ ended: true }, { headers });
    }

    throw new RecoveryError("Unknown borrowed-session action.");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start this borrowed session." },
      { status: error instanceof RecoveryError ? 400 : 401, headers }
    );
  }
}
