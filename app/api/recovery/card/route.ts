import { NextRequest, NextResponse } from "next/server";
import {
  RecoveryError,
  confirmChannelVerification,
  createCard,
  getOwnerCard,
  revokeCard,
  setPublicReturnDetails,
  startChannelVerification
} from "@/lib/server/recovery-service";
import { publicCard } from "@/lib/shared/recovery/types";

export const runtime = "nodejs";

function ownerSecretFrom(request: NextRequest): string {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403, headers });
  }

  try {
    const raw = await request.text();
    if (raw.length > 16384) throw new RecoveryError("Request too large.");
    const body = JSON.parse(raw || "{}");
    const ownerSecret = ownerSecretFrom(request);

    if (body.action === "create") {
      const card = createCard({
        ownerSecret,
        ownerPublicKey: body.ownerPublicKey,
        recoveryKeyEnvelope: body.recoveryKeyEnvelope,
        recoveryKeySealed: body.recoveryKeySealed,
        replacesCardId: typeof body.replacesCardId === "string" ? body.replacesCardId : undefined
      });
      return NextResponse.json({ card: publicOwnerView(card) }, { headers });
    }

    if (typeof body.cardId !== "string") throw new RecoveryError("Missing card id.");

    if (body.action === "get") {
      return NextResponse.json({ card: publicOwnerView(getOwnerCard(body.cardId, ownerSecret)) }, { headers });
    }
    if (body.action === "revoke") {
      revokeCard(body.cardId, ownerSecret);
      return NextResponse.json({ revoked: true }, { headers });
    }
    if (body.action === "return-details") {
      const card = setPublicReturnDetails(body.cardId, ownerSecret, body.details ?? {});
      return NextResponse.json({ card: publicOwnerView(card) }, { headers });
    }
    if (body.action === "channel-start") {
      if (typeof body.address !== "string") throw new RecoveryError("Enter an email address.");
      await startChannelVerification(body.cardId, ownerSecret, body.address);
      return NextResponse.json({ started: true }, { headers });
    }
    if (body.action === "channel-verify") {
      if (typeof body.code !== "string") throw new RecoveryError("Enter the code from your email.");
      const card = confirmChannelVerification(body.cardId, ownerSecret, body.code);
      return NextResponse.json({ card: publicOwnerView(card) }, { headers });
    }

    throw new RecoveryError("Unknown card action.");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update this card." },
      { status: error instanceof RecoveryError ? 400 : 500, headers }
    );
  }
}

/**
 * Owner-facing view: everything except the owner_secret_hash. The key
 * envelope is included as ciphertext only — the trusted device needs it to
 * re-derive its messaging key after a reload (it never persists the raw
 * key), and unwrapping happens locally with the recovery passphrase.
 */
function publicOwnerView(card: ReturnType<typeof getOwnerCard>) {
  const pub = publicCard(card);
  return {
    ...pub,
    owner_public_key: card.owner_public_key,
    recovery_key_envelope: card.recovery_key_envelope,
    recovery_key_sealed: card.recovery_key_sealed,
    channel: card.channel
      ? { kind: card.channel.kind, address: card.channel.address, verified_at: card.channel.verified_at }
      : undefined,
    created_at: card.created_at
  };
}
