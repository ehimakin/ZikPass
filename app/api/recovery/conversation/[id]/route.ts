import { NextRequest, NextResponse } from "next/server";
import {
  RecoveryError,
  authorizeBorrowed,
  authorizeFinder,
  authorizeOwnerTrusted,
  blockConversation,
  endConversation,
  getConversationMessages,
  getKeyMaterialForConversation,
  reportConversation,
  sendMessage
} from "@/lib/server/recovery-service";

export const runtime = "nodejs";

type Role = "finder" | "owner-trusted" | "owner-borrowed";

function bearerToken(request: NextRequest): string {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

/** Every role maps to one of the three conversation-scoped credentials from recovery-service.ts. Nothing here ever sees Vault, wallet, or device-binding state — those modules simply aren't imported on this path. */
function authorize(request: NextRequest, conversationId: string) {
  const role = request.nextUrl.searchParams.get("role") as Role | null;
  const token = bearerToken(request);

  if (role === "finder") {
    const conversation = authorizeFinder(conversationId, token);
    return { role, sender: "finder" as const, conversation };
  }
  if (role === "owner-trusted") {
    const cardId = request.nextUrl.searchParams.get("cardId") ?? "";
    const conversation = authorizeOwnerTrusted(conversationId, cardId, token);
    return { role, sender: "owner" as const, conversation };
  }
  if (role === "owner-borrowed") {
    const conversation = authorizeBorrowed(conversationId, token);
    return { role, sender: "owner" as const, conversation };
  }
  throw new RecoveryError("Unknown role.");
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "no-store" };
  const { id } = await context.params;
  try {
    const { role, conversation } = authorize(request, id);
    const keyMaterial = role === "finder" ? undefined : getKeyMaterialForConversation(conversation);
    return NextResponse.json(
      { messages: getConversationMessages(id), envelope: keyMaterial?.envelope, sealed: keyMaterial?.sealed },
      { headers }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load this conversation." },
      { status: 401, headers }
    );
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "no-store" };
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403, headers });
  }
  const { id } = await context.params;

  try {
    const { sender } = authorize(request, id);
    const raw = await request.text();
    if (raw.length > 24576) throw new RecoveryError("Request too large.");
    const body = JSON.parse(raw || "{}");

    if (body.action === "send") {
      if (typeof body.ciphertext !== "string" || typeof body.nonce !== "string") {
        throw new RecoveryError("Invalid message.");
      }
      const message = sendMessage({ conversationId: id, sender, ciphertext: body.ciphertext, nonce: body.nonce });
      return NextResponse.json({ message }, { headers });
    }
    if (body.action === "end") {
      endConversation(id);
      return NextResponse.json({ ended: true }, { headers });
    }
    if (body.action === "block") {
      blockConversation(id);
      return NextResponse.json({ blocked: true }, { headers });
    }
    if (body.action === "report") {
      reportConversation(id);
      return NextResponse.json({ reported: true }, { headers });
    }

    throw new RecoveryError("Unknown conversation action.");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update this conversation." },
      { status: error instanceof RecoveryError ? 400 : 401, headers }
    );
  }
}
