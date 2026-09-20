import { NextRequest, NextResponse } from "next/server";
import { RecoveryError, getPublicCard, startConversation } from "@/lib/server/recovery-service";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: { params: Promise<{ cardId: string }> }) {
  const headers = { "Cache-Control": "no-store" };
  const { cardId } = await context.params;
  try {
    return NextResponse.json({ card: getPublicCard(cardId) }, { headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "This recovery card is not recognised." },
      { status: 404, headers }
    );
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ cardId: string }> }) {
  const headers = { "Cache-Control": "no-store" };
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403, headers });
  }
  const { cardId } = await context.params;

  try {
    const raw = await request.text();
    if (raw.length > 8192) throw new RecoveryError("Request too large.");
    const body = JSON.parse(raw || "{}");
    if (typeof body.finderPublicKey !== "string") throw new RecoveryError("Missing finder public key.");

    const { conversation, finderSessionToken, ownerNotified } = await startConversation({
      cardId,
      finderPublicKey: body.finderPublicKey
    });

    return NextResponse.json(
      {
        conversationId: conversation.conversation_id,
        ownerPublicKey: conversation.owner_public_key,
        finderSessionToken,
        ownerNotified
      },
      { headers }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start this conversation." },
      { status: error instanceof RecoveryError ? 400 : 500, headers }
    );
  }
}
