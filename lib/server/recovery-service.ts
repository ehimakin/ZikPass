import { randomBytes } from "node:crypto";
import { randomNumericCode } from "@/lib/shared/utils";
import type {
  PublicReturnDetails,
  RecoveryCard,
  RecoveryConversation,
  RecoveryMessage,
  SealedKeyWire
} from "@/lib/shared/recovery/types";
import { publicCard } from "@/lib/shared/recovery/types";
import type { VaultKeyEnvelopeV2 } from "@/lib/shared/vault/crypto";
import { checkRateLimit } from "./rate-limit";
import { equalHash, getActiveChannel, getCard, getConversation, hashSecret, listMessages, mutateRecoveryStore, readRecoveryStore } from "./recovery-store";
import { generateReplyToken, notifyOwnerOfConversation, recoveryNotifyAvailable, sendVerificationCode } from "./recovery-notify";

const CHANNEL_CODE_TTL_MS = 15 * 60 * 1000;
const CHANNEL_MAX_ATTEMPTS = 5;
const BORROWED_SESSION_TTL_MS = 30 * 60 * 1000;
const FINDER_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RETURN_NOTE = 500;

export class RecoveryError extends Error {}
export class RecoveryAuthError extends RecoveryError {}
export class RecoveryRateLimitError extends RecoveryError {}

function newOpaqueId(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

// --- Card lifecycle -------------------------------------------------------

export function createCard(input: {
  ownerSecret: string;
  ownerPublicKey: string;
  recoveryKeyEnvelope: VaultKeyEnvelopeV2;
  recoveryKeySealed: SealedKeyWire;
  replacesCardId?: string;
}): RecoveryCard {
  if (!input.ownerSecret || input.ownerSecret.length < 24) throw new RecoveryError("Invalid owner secret.");
  if (!input.ownerPublicKey || input.ownerPublicKey.length < 40) throw new RecoveryError("Invalid owner public key.");

  const card: RecoveryCard = {
    card_id: newOpaqueId(16),
    owner_secret_hash: hashSecret(input.ownerSecret),
    owner_public_key: input.ownerPublicKey,
    recovery_key_envelope: input.recoveryKeyEnvelope,
    recovery_key_sealed: input.recoveryKeySealed,
    created_at: new Date().toISOString()
  };

  return mutateRecoveryStore((store) => {
    if (input.replacesCardId) {
      const previous = store.cards.find((existing) => existing.card_id === input.replacesCardId);
      if (previous) {
        previous.revoked_at = new Date().toISOString();
        previous.replaced_by_card_id = card.card_id;
      }
    }
    store.cards.push(card);
    return card;
  });
}

/** Owner-secret check only — used for reading history, which should keep working after a card is revoked. */
function authorizeOwnerSecret(cardId: string, ownerSecret: string): RecoveryCard {
  const card = getCard(cardId);
  if (!card || !equalHash(ownerSecret, card.owner_secret_hash)) {
    throw new RecoveryAuthError("This recovery card is not recognised.");
  }
  return card;
}

/** Owner-secret check plus "still active" — used for mutations (revoke, return details, channel). */
function authorizeOwner(cardId: string, ownerSecret: string): RecoveryCard {
  const card = authorizeOwnerSecret(cardId, ownerSecret);
  if (card.revoked_at) throw new RecoveryAuthError("This recovery card has been revoked. Set up a new one.");
  return card;
}

export function getOwnerCard(cardId: string, ownerSecret: string): RecoveryCard {
  return authorizeOwnerSecret(cardId, ownerSecret);
}

export function revokeCard(cardId: string, ownerSecret: string): void {
  mutateRecoveryStore((store) => {
    const card = store.cards.find((existing) => existing.card_id === cardId);
    if (!card || card.revoked_at || !equalHash(ownerSecret, card.owner_secret_hash)) {
      throw new RecoveryAuthError("This recovery card is not recognised.");
    }
    card.revoked_at = new Date().toISOString();
  });
}

export function setPublicReturnDetails(
  cardId: string,
  ownerSecret: string,
  details: PublicReturnDetails
): RecoveryCard {
  if ((details.note?.length ?? 0) > MAX_RETURN_NOTE || (details.address?.length ?? 0) > MAX_RETURN_NOTE) {
    throw new RecoveryError(`Return details must be ${MAX_RETURN_NOTE} characters or fewer.`);
  }
  return mutateRecoveryStore((store) => {
    const card = store.cards.find((existing) => existing.card_id === cardId);
    if (!card || card.revoked_at || !equalHash(ownerSecret, card.owner_secret_hash)) {
      throw new RecoveryAuthError("This recovery card is not recognised.");
    }
    card.public_return_details = details;
    return card;
  });
}

// --- Notification channel --------------------------------------------------

export async function startChannelVerification(cardId: string, ownerSecret: string, address: string): Promise<void> {
  authorizeOwner(cardId, ownerSecret);
  const limit = checkRateLimit(`recovery-channel-start:${cardId}`, 5, CHANNEL_CODE_TTL_MS);
  if (!limit.allowed) throw new RecoveryRateLimitError("Too many verification attempts. Try again later.");

  const code = randomNumericCode(6);
  mutateRecoveryStore((store) => {
    const card = store.cards.find((existing) => existing.card_id === cardId)!;
    card.channel = {
      kind: "email",
      address,
      verify_code_hash: hashSecret(code),
      verify_expires_at: new Date(Date.now() + CHANNEL_CODE_TTL_MS).toISOString(),
      verify_attempts: 0
    };
  });

  if (recoveryNotifyAvailable()) {
    await sendVerificationCode(address, code);
  }
}

export function confirmChannelVerification(cardId: string, ownerSecret: string, code: string): RecoveryCard {
  return mutateRecoveryStore((store) => {
    const card = store.cards.find((existing) => existing.card_id === cardId);
    if (!card || card.revoked_at || !equalHash(ownerSecret, card.owner_secret_hash)) {
      throw new RecoveryAuthError("This recovery card is not recognised.");
    }
    const channel = card.channel;
    if (!channel?.verify_code_hash || !channel.verify_expires_at) {
      throw new RecoveryError("Start verification before confirming a code.");
    }
    if (channel.verify_attempts >= CHANNEL_MAX_ATTEMPTS || Date.parse(channel.verify_expires_at) <= Date.now()) {
      throw new RecoveryError("This code has expired. Request a new one.");
    }
    channel.verify_attempts += 1;
    if (!equalHash(code, channel.verify_code_hash)) {
      throw new RecoveryError("Incorrect code.");
    }
    channel.verified_at = new Date().toISOString();
    delete channel.verify_code_hash;
    delete channel.verify_expires_at;
    return card;
  });
}

// --- Finder-facing -----------------------------------------------------------

export function getPublicCard(cardId: string) {
  const card = getCard(cardId);
  if (!card) throw new RecoveryError("This recovery card is not recognised.");
  return publicCard(card);
}

export async function startConversation(input: {
  cardId: string;
  finderPublicKey: string;
}): Promise<{ conversation: RecoveryConversation; finderSessionToken: string; ownerNotified: boolean }> {
  const card = getCard(input.cardId);
  if (!card || card.revoked_at) throw new RecoveryError("This recovery card is not recognised.");
  if (!input.finderPublicKey || input.finderPublicKey.length < 40) {
    throw new RecoveryError("Invalid finder public key.");
  }

  const startLimit = checkRateLimit(`recovery-start:${input.cardId}`, 8, 60 * 60 * 1000);
  if (!startLimit.allowed) throw new RecoveryRateLimitError("Too many attempts to contact this card's owner. Try again later.");

  const conversation: RecoveryConversation = {
    conversation_id: newOpaqueId(16),
    card_id: input.cardId,
    finder_public_key: input.finderPublicKey,
    owner_public_key: card.owner_public_key,
    status: "open",
    created_at: new Date().toISOString(),
    last_message_at: new Date().toISOString()
  };

  const finderSessionToken = newOpaqueId(24);
  const replyToken = generateReplyToken();

  mutateRecoveryStore((store) => {
    conversation.reply_token_hash = hashSecret(replyToken);
    store.conversations.push(conversation);
    store.finder_sessions.push({
      session_token_hash: hashSecret(finderSessionToken),
      conversation_id: conversation.conversation_id,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + FINDER_SESSION_TTL_MS).toISOString()
    });
  });

  const channel = getActiveChannel(card);
  let ownerNotified = false;
  if (channel && recoveryNotifyAvailable()) {
    ownerNotified = await notifyOwnerOfConversation({
      address: channel.address,
      conversationId: conversation.conversation_id,
      replyToken
    });
  }

  return { conversation, finderSessionToken, ownerNotified };
}

// --- Conversation access -----------------------------------------------------

export type ConversationRole = "finder" | "owner-trusted" | "owner-borrowed";

function requireOpenConversation(conversationId: string): RecoveryConversation {
  const conversation = getConversation(conversationId);
  if (!conversation) throw new RecoveryError("This conversation is not recognised.");
  if (conversation.status !== "open") throw new RecoveryError("This conversation has ended.");
  return conversation;
}

export function authorizeFinder(conversationId: string, sessionToken: string): RecoveryConversation {
  const conversation = requireOpenConversation(conversationId);
  const store = readRecoveryStore();
  const session = store.finder_sessions.find((candidate) => candidate.conversation_id === conversationId);
  if (!session || !equalHash(sessionToken, session.session_token_hash) || Date.parse(session.expires_at) <= Date.now()) {
    throw new RecoveryAuthError("This finder session is invalid or has expired.");
  }
  return conversation;
}

export function authorizeOwnerTrusted(conversationId: string, cardId: string, ownerSecret: string): RecoveryConversation {
  const conversation = requireOpenConversation(conversationId);
  if (conversation.card_id !== cardId) throw new RecoveryAuthError("This conversation does not belong to that card.");
  authorizeOwnerSecret(cardId, ownerSecret);
  return conversation;
}

/** Exchanges the emailed reply_token for a time-boxed BorrowedSession. The token is single-use: exchanging it clears reply_token_hash. */
export function exchangeReplyToken(conversationId: string, replyToken: string): string {
  const sessionToken = newOpaqueId(24);
  mutateRecoveryStore((store) => {
    const conversation = store.conversations.find((existing) => existing.conversation_id === conversationId);
    if (!conversation || conversation.status !== "open") throw new RecoveryError("This conversation is not recognised.");
    if (!conversation.reply_token_hash || !equalHash(replyToken, conversation.reply_token_hash)) {
      throw new RecoveryAuthError("This reply link is invalid or has already been used.");
    }
    conversation.reply_token_hash = undefined;
    store.borrowed_sessions.push({
      session_token_hash: hashSecret(sessionToken),
      conversation_id: conversationId,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + BORROWED_SESSION_TTL_MS).toISOString()
    });
  });
  return sessionToken;
}

export function authorizeBorrowed(conversationId: string, sessionToken: string): RecoveryConversation {
  const conversation = requireOpenConversation(conversationId);
  const store = readRecoveryStore();
  const session = store.borrowed_sessions.find((candidate) => candidate.conversation_id === conversationId);
  if (
    !session ||
    session.ended_at ||
    !equalHash(sessionToken, session.session_token_hash) ||
    Date.parse(session.expires_at) <= Date.now()
  ) {
    throw new RecoveryAuthError("This borrowed-device session is invalid or has expired.");
  }
  return conversation;
}

/** Ciphertext only — lets an owner-side device (trusted or borrowed) fetch the wrapped key material it must unwrap locally with the recovery passphrase. Never exposed to the finder role. */
export function getKeyMaterialForConversation(
  conversation: RecoveryConversation
): { envelope: VaultKeyEnvelopeV2; sealed: SealedKeyWire } {
  const card = getCard(conversation.card_id);
  if (!card) throw new RecoveryError("This recovery card is not recognised.");
  return { envelope: card.recovery_key_envelope, sealed: card.recovery_key_sealed };
}

export function endBorrowedSession(conversationId: string, sessionToken: string): void {
  mutateRecoveryStore((store) => {
    const session = store.borrowed_sessions.find(
      (candidate) => candidate.conversation_id === conversationId && equalHash(sessionToken, candidate.session_token_hash)
    );
    if (session) session.ended_at = new Date().toISOString();
  });
}

// --- Messages ----------------------------------------------------------------

export function getConversationMessages(conversationId: string): RecoveryMessage[] {
  return listMessages(conversationId);
}

export function sendMessage(input: {
  conversationId: string;
  sender: "finder" | "owner";
  ciphertext: string;
  nonce: string;
}): RecoveryMessage {
  const limit = checkRateLimit(`recovery-message:${input.conversationId}`, 60, 5 * 60 * 1000);
  if (!limit.allowed) throw new RecoveryRateLimitError("Too many messages. Slow down and try again shortly.");
  if (!input.ciphertext || !input.nonce || input.ciphertext.length > 20000) {
    throw new RecoveryError("Invalid message.");
  }

  const message: RecoveryMessage = {
    message_id: newOpaqueId(12),
    conversation_id: input.conversationId,
    sender: input.sender,
    ciphertext: input.ciphertext,
    nonce: input.nonce,
    sent_at: new Date().toISOString()
  };

  return mutateRecoveryStore((store) => {
    const conversation = store.conversations.find((existing) => existing.conversation_id === input.conversationId);
    if (!conversation || conversation.status !== "open") throw new RecoveryError("This conversation has ended.");
    conversation.last_message_at = message.sent_at;
    store.messages.push(message);
    return message;
  });
}

export function endConversation(conversationId: string): void {
  mutateRecoveryStore((store) => {
    const conversation = store.conversations.find((existing) => existing.conversation_id === conversationId);
    if (conversation) conversation.status = "ended";
  });
}

export function blockConversation(conversationId: string): void {
  mutateRecoveryStore((store) => {
    const conversation = store.conversations.find((existing) => existing.conversation_id === conversationId);
    if (conversation) conversation.status = "blocked";
  });
}

export function reportConversation(conversationId: string): void {
  mutateRecoveryStore((store) => {
    const conversation = store.conversations.find((existing) => existing.conversation_id === conversationId);
    if (conversation) conversation.reported_at = new Date().toISOString();
  });
}

export function listOwnerConversations(cardId: string, ownerSecret: string): RecoveryConversation[] {
  authorizeOwnerSecret(cardId, ownerSecret);
  return readRecoveryStore()
    .conversations.filter((conversation) => conversation.card_id === cardId)
    .sort((a, b) => Date.parse(b.last_message_at) - Date.parse(a.last_message_at));
}
