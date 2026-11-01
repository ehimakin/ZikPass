import type { PublicReturnDetails, RecoveryConversation, RecoveryMessage, SealedKeyWire } from "@/lib/shared/recovery/types";
import type { VaultKeyEnvelopeV2 } from "@/lib/shared/vault/crypto";

async function call(url: string, options: { body?: unknown; token?: string } = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: JSON.stringify(options.body ?? {})
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

// --- Owner card management ---------------------------------------------------

export type OwnerCardView = {
  card_id: string;
  revoked: boolean;
  owner_public_key: string;
  recovery_key_envelope: VaultKeyEnvelopeV2;
  recovery_key_sealed: SealedKeyWire;
  public_return_details?: PublicReturnDetails;
  channel?: { kind: "email"; address: string; verified_at?: string };
  created_at: string;
};

export async function createCard(input: {
  ownerSecret: string;
  ownerPublicKey: string;
  recoveryKeyEnvelope: VaultKeyEnvelopeV2;
  recoveryKeySealed: SealedKeyWire;
  replacesCardId?: string;
}): Promise<OwnerCardView> {
  const data = await call("/api/recovery/card", {
    token: input.ownerSecret,
    body: {
      action: "create",
      ownerPublicKey: input.ownerPublicKey,
      recoveryKeyEnvelope: input.recoveryKeyEnvelope,
      recoveryKeySealed: input.recoveryKeySealed,
      replacesCardId: input.replacesCardId
    }
  });
  return data.card;
}

export async function getOwnerCard(cardId: string, ownerSecret: string): Promise<OwnerCardView> {
  const data = await call("/api/recovery/card", { token: ownerSecret, body: { action: "get", cardId } });
  return data.card;
}

export async function revokeCard(cardId: string, ownerSecret: string): Promise<void> {
  await call("/api/recovery/card", { token: ownerSecret, body: { action: "revoke", cardId } });
}

export async function setReturnDetails(cardId: string, ownerSecret: string, details: PublicReturnDetails): Promise<OwnerCardView> {
  const data = await call("/api/recovery/card", { token: ownerSecret, body: { action: "return-details", cardId, details } });
  return data.card;
}

export async function startChannelVerification(cardId: string, ownerSecret: string, address: string): Promise<void> {
  await call("/api/recovery/card", { token: ownerSecret, body: { action: "channel-start", cardId, address } });
}

export async function confirmChannelVerification(cardId: string, ownerSecret: string, code: string): Promise<OwnerCardView> {
  const data = await call("/api/recovery/card", { token: ownerSecret, body: { action: "channel-verify", cardId, code } });
  return data.card;
}

// --- Finder ------------------------------------------------------------------

export async function getPublicCard(cardId: string) {
  const response = await fetch(`/api/r/${encodeURIComponent(cardId)}`, { headers: { "Cache-Control": "no-store" } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "This recovery card is not recognised.");
  return data.card as { card_id: string; revoked: boolean; public_return_details?: PublicReturnDetails };
}

export async function startConversation(cardId: string, finderPublicKey: string) {
  const response = await fetch(`/api/r/${encodeURIComponent(cardId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ finderPublicKey })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Could not start this conversation.");
  return data as { conversationId: string; ownerPublicKey: string; finderSessionToken: string; ownerNotified: boolean };
}

// --- Conversation (shared by all three roles) ---------------------------------

export type ConversationRole = "finder" | "owner-trusted" | "owner-borrowed";

function conversationUrl(conversationId: string, role: ConversationRole, cardId?: string) {
  const query = new URLSearchParams({ role, ...(cardId ? { cardId } : {}) });
  return `/api/recovery/conversation/${encodeURIComponent(conversationId)}?${query.toString()}`;
}

export async function pollMessages(conversationId: string, role: ConversationRole, token: string, cardId?: string): Promise<RecoveryMessage[]> {
  const response = await fetch(conversationUrl(conversationId, role, cardId), {
    headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-store" }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Could not load this conversation.");
  return data.messages;
}

/** One-time fetch for an owner-side page's initial load, to unwrap the messaging key locally with the recovery passphrase. */
export async function getConversationKeyMaterial(
  conversationId: string,
  role: Extract<ConversationRole, "owner-trusted" | "owner-borrowed">,
  token: string,
  cardId?: string
): Promise<{ envelope: VaultKeyEnvelopeV2; sealed: SealedKeyWire }> {
  const response = await fetch(conversationUrl(conversationId, role, cardId), {
    headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-store" }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Could not load this conversation.");
  return { envelope: data.envelope, sealed: data.sealed };
}

async function conversationAction(
  conversationId: string,
  role: ConversationRole,
  token: string,
  body: Record<string, unknown>,
  cardId?: string
) {
  const response = await fetch(conversationUrl(conversationId, role, cardId), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Could not update this conversation.");
  return data;
}

export async function sendCiphertext(
  conversationId: string,
  role: ConversationRole,
  token: string,
  ciphertext: string,
  nonce: string,
  cardId?: string
): Promise<RecoveryMessage> {
  const data = await conversationAction(conversationId, role, token, { action: "send", ciphertext, nonce }, cardId);
  return data.message;
}

export async function endConversation(conversationId: string, role: ConversationRole, token: string, cardId?: string) {
  await conversationAction(conversationId, role, token, { action: "end" }, cardId);
}

export async function blockConversation(conversationId: string, role: ConversationRole, token: string, cardId?: string) {
  await conversationAction(conversationId, role, token, { action: "block" }, cardId);
}

export async function reportConversation(conversationId: string, role: ConversationRole, token: string, cardId?: string) {
  await conversationAction(conversationId, role, token, { action: "report" }, cardId);
}

export async function listOwnerConversations(cardId: string, ownerSecret: string): Promise<RecoveryConversation[]> {
  const data = await call("/api/recovery/conversations", { token: ownerSecret, body: { cardId } });
  return data.conversations;
}

// --- Borrowed-device exchange ---------------------------------------------------

export async function exchangeReplyToken(
  conversationId: string,
  replyToken: string
): Promise<{
  sessionToken: string;
  ownerPublicKey: string;
  finderPublicKey: string;
  envelope: VaultKeyEnvelopeV2;
  sealed: SealedKeyWire;
}> {
  const response = await fetch(`/api/recovery/borrowed/${encodeURIComponent(conversationId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "exchange", replyToken })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Could not open this reply link.");
  return data;
}

export async function endBorrowedSession(conversationId: string, sessionToken: string): Promise<void> {
  await fetch(`/api/recovery/borrowed/${encodeURIComponent(conversationId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ action: "end" })
  });
}
