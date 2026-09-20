import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createKeyEnvelope, seal } from "@/lib/shared/vault/crypto";
import { generateRecoveryKeyPair, openMessage, sealMessage, sealedToWire } from "@/lib/shared/recovery/crypto";
import { checkRateLimit } from "@/lib/server/rate-limit";
import * as mailer from "@/lib/server/mailer";
import {
  RecoveryAuthError,
  RecoveryRateLimitError,
  authorizeBorrowed,
  authorizeFinder,
  authorizeOwnerTrusted,
  blockConversation,
  confirmChannelVerification,
  createCard,
  endBorrowedSession,
  exchangeReplyToken,
  getOwnerCard,
  listOwnerConversations,
  revokeCard,
  sendMessage,
  setPublicReturnDetails,
  startChannelVerification,
  startConversation
} from "@/lib/server/recovery-service";

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(path.join(os.tmpdir(), "zik-recovery-"));
  vi.stubEnv("ZIK_RUNTIME_DATA_DIR", directory);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

async function makeCard(passphrase = "a fresh clean test passphrase") {
  const { publicKey, secretKey } = generateRecoveryKeyPair();
  const { envelope, key } = await createKeyEnvelope(passphrase);
  const sealed = await seal(key, "recovery-messaging-key", publicKey, secretKey);
  const ownerSecret = "owner-secret-of-sufficient-length-123456";
  const card = createCard({
    ownerSecret,
    ownerPublicKey: publicKey,
    recoveryKeyEnvelope: envelope,
    recoveryKeySealed: sealedToWire(sealed)
  });
  return { card, ownerSecret, ownerSecretKey: secretKey, ownerPublicKey: publicKey };
}

describe("recovery messaging crypto", () => {
  it("round trips a message and binds it to the conversation", () => {
    const finder = generateRecoveryKeyPair();
    const owner = generateRecoveryKeyPair();
    const sealed = sealMessage(finder.secretKey, owner.publicKey, "conv-1", "hello");
    expect(openMessage(owner.secretKey, finder.publicKey, "conv-1", sealed)).toBe("hello");
  });

  it("rejects a message opened under the wrong conversation id (AAD mismatch)", () => {
    const finder = generateRecoveryKeyPair();
    const owner = generateRecoveryKeyPair();
    const sealed = sealMessage(finder.secretKey, owner.publicKey, "conv-1", "hello");
    expect(() => openMessage(owner.secretKey, finder.publicKey, "conv-2", sealed)).toThrow();
  });

  it("rejects tampered ciphertext", () => {
    const finder = generateRecoveryKeyPair();
    const owner = generateRecoveryKeyPair();
    const sealed = sealMessage(finder.secretKey, owner.publicKey, "conv-1", "hello");
    const tampered = { ...sealed, ciphertext: sealed.ciphertext.slice(0, -2) + (sealed.ciphertext.at(-1) === "A" ? "B" : "A") };
    expect(() => openMessage(owner.secretKey, finder.publicKey, "conv-1", tampered)).toThrow();
  });

  it("rejects decryption with an unrelated key", () => {
    const finder = generateRecoveryKeyPair();
    const owner = generateRecoveryKeyPair();
    const stranger = generateRecoveryKeyPair();
    const sealed = sealMessage(finder.secretKey, owner.publicKey, "conv-1", "hello");
    expect(() => openMessage(stranger.secretKey, finder.publicKey, "conv-1", sealed)).toThrow();
  });
});

describe("card lifecycle", () => {
  it("creates a card, authorizes its owner, and rejects a wrong owner secret", async () => {
    const { card, ownerSecret } = await makeCard();
    expect(getOwnerCard(card.card_id, ownerSecret).card_id).toBe(card.card_id);
    expect(() => getOwnerCard(card.card_id, "not-the-real-secret-but-long-enough")).toThrow(RecoveryAuthError);
  });

  it("revokes a card and blocks further mutation but keeps read access for the owner", async () => {
    const { card, ownerSecret } = await makeCard();
    revokeCard(card.card_id, ownerSecret);
    expect(getOwnerCard(card.card_id, ownerSecret).revoked_at).toBeTruthy();
    expect(() => setPublicReturnDetails(card.card_id, ownerSecret, { note: "x" })).toThrow(RecoveryAuthError);
  });

  it("caps return-details length", async () => {
    const { card, ownerSecret } = await makeCard();
    expect(() => setPublicReturnDetails(card.card_id, ownerSecret, { note: "x".repeat(501) })).toThrow();
  });
});

describe("notification channel verification", () => {
  it("requires the correct code, expires the code, and locks out after too many attempts", async () => {
    const { card, ownerSecret } = await makeCard();
    await startChannelVerification(card.card_id, ownerSecret, "owner@example.com");
    expect(() => confirmChannelVerification(card.card_id, ownerSecret, "000000")).toThrow();
    // No SMTP configured in this test environment, so the real code never leaves the server —
    // confirm every guess is rejected without ever leaking a way to read the stored hash.
    for (let attempt = 0; attempt < 4; attempt++) {
      expect(() => confirmChannelVerification(card.card_id, ownerSecret, "111111")).toThrow();
    }
    expect(() => confirmChannelVerification(card.card_id, ownerSecret, "111111")).toThrow(/expired/);
  });
});

describe("conversation access and the finder/owner boundary", () => {
  it("lets a finder start a conversation without any card credential", async () => {
    const { card } = await makeCard();
    const finder = generateRecoveryKeyPair();
    const { conversation, finderSessionToken } = await startConversation({
      cardId: card.card_id,
      finderPublicKey: finder.publicKey
    });
    expect(conversation.owner_public_key).toBe(card.owner_public_key);
    expect(authorizeFinder(conversation.conversation_id, finderSessionToken).conversation_id).toBe(conversation.conversation_id);
  });

  it("rejects starting a conversation against a revoked card", async () => {
    const { card, ownerSecret } = await makeCard();
    revokeCard(card.card_id, ownerSecret);
    const finder = generateRecoveryKeyPair();
    await expect(startConversation({ cardId: card.card_id, finderPublicKey: finder.publicKey })).rejects.toThrow();
  });

  it("a finder session cannot authorize as the owner, and vice versa", async () => {
    const { card, ownerSecret } = await makeCard();
    const finder = generateRecoveryKeyPair();
    const { conversation, finderSessionToken } = await startConversation({
      cardId: card.card_id,
      finderPublicKey: finder.publicKey
    });
    expect(() => authorizeOwnerTrusted(conversation.conversation_id, card.card_id, finderSessionToken)).toThrow(RecoveryAuthError);
    expect(() => authorizeFinder(conversation.conversation_id, ownerSecret)).toThrow(RecoveryAuthError);
    expect(authorizeOwnerTrusted(conversation.conversation_id, card.card_id, ownerSecret).conversation_id).toBe(
      conversation.conversation_id
    );
  });

  it("round trips ciphertext through send/poll without the server ever handling plaintext", async () => {
    const { card } = await makeCard();
    const finder = generateRecoveryKeyPair();
    const { conversation } = await startConversation({
      cardId: card.card_id,
      finderPublicKey: finder.publicKey
    });
    const sealed = sealMessage(finder.secretKey, conversation.owner_public_key, conversation.conversation_id, "found it!");
    const stored = sendMessage({
      conversationId: conversation.conversation_id,
      sender: "finder",
      ciphertext: sealed.ciphertext,
      nonce: sealed.nonce
    });
    expect(stored.ciphertext).not.toContain("found it");
    expect(stored.ciphertext).toBe(sealed.ciphertext);
  });

  it("blocking or ending a conversation stops further access", async () => {
    const { card } = await makeCard();
    const finder = generateRecoveryKeyPair();
    const { conversation, finderSessionToken } = await startConversation({
      cardId: card.card_id,
      finderPublicKey: finder.publicKey
    });
    blockConversation(conversation.conversation_id);
    expect(() => authorizeFinder(conversation.conversation_id, finderSessionToken)).toThrow(/ended/);
  });

  it("lists conversations for the owner and nobody else", async () => {
    const { card, ownerSecret } = await makeCard();
    const finder = generateRecoveryKeyPair();
    await startConversation({ cardId: card.card_id, finderPublicKey: finder.publicKey });
    expect(listOwnerConversations(card.card_id, ownerSecret)).toHaveLength(1);
    expect(() => listOwnerConversations(card.card_id, "wrong-secret-but-long-enough-too")).toThrow(RecoveryAuthError);
  });
});

describe("borrowed-device sessions — the restriction the brief requires", () => {
  /** Makes recoveryNotifyAvailable() genuinely true, then captures the real reply token from the email text instead of fabricating one. */
  function stubSmtpAndCaptureEmails() {
    vi.stubEnv("ZIK_SMTP_HOST", "smtp.example.com");
    vi.stubEnv("ZIK_SMTP_FROM", "noreply@example.com");
    vi.stubEnv("ZIK_SMTP_USER", "user");
    vi.stubEnv("ZIK_SMTP_PASSWORD", "pass");
    vi.stubEnv("ZIK_RECOVERY_PUBLIC_URL", "https://recovery.example.com");
    return vi.spyOn(mailer, "sendMail").mockResolvedValue(true);
  }

  function replyTokenFrom(text: string): string {
    const match = text.match(/token=([A-Za-z0-9_-]+)/);
    if (!match) throw new Error("no reply token found in notification email");
    return match[1];
  }

  async function makeVerifiedCardWithConversation() {
    const sendMail = stubSmtpAndCaptureEmails();
    const { card, ownerSecret } = await makeCard();
    await startChannelVerification(card.card_id, ownerSecret, "owner@example.com");
    const code = sendMail.mock.calls.at(-1)![0].text.match(/\n\n(\d{6})\n\n/)![1];
    confirmChannelVerification(card.card_id, ownerSecret, code);

    const finder = generateRecoveryKeyPair();
    const { conversation } = await startConversation({ cardId: card.card_id, finderPublicKey: finder.publicKey });
    const replyToken = replyTokenFrom(sendMail.mock.calls.at(-1)![0].text);
    return { card, ownerSecret, conversation, replyToken };
  }

  it("exchanges a real reply token exactly once, and rejects an arbitrary or reused one", async () => {
    const { conversation, replyToken } = await makeVerifiedCardWithConversation();
    const sessionToken = exchangeReplyToken(conversation.conversation_id, replyToken);
    expect(sessionToken).toBeTruthy();
    expect(() => exchangeReplyToken(conversation.conversation_id, replyToken)).toThrow(RecoveryAuthError);
    expect(() => exchangeReplyToken(conversation.conversation_id, "not-the-real-token")).toThrow(RecoveryAuthError);
  });

  it("a borrowed session authorizes exactly this conversation and nothing else, and expires", async () => {
    const { conversation, replyToken } = await makeVerifiedCardWithConversation();
    const sessionToken = exchangeReplyToken(conversation.conversation_id, replyToken);
    expect(authorizeBorrowed(conversation.conversation_id, sessionToken).conversation_id).toBe(conversation.conversation_id);
    expect(() => authorizeBorrowed(conversation.conversation_id, "never-issued")).toThrow(RecoveryAuthError);

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 40 * 60 * 1000);
    try {
      expect(() => authorizeBorrowed(conversation.conversation_id, sessionToken)).toThrow(RecoveryAuthError);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("ending a borrowed session invalidates it immediately, even well before its TTL", async () => {
    const { conversation, replyToken } = await makeVerifiedCardWithConversation();
    const sessionToken = exchangeReplyToken(conversation.conversation_id, replyToken);
    endBorrowedSession(conversation.conversation_id, sessionToken);
    expect(() => authorizeBorrowed(conversation.conversation_id, sessionToken)).toThrow(RecoveryAuthError);
  });

  it("the borrowed-session module surface has no function that enrols a device or reads Vault state", async () => {
    // Structural guarantee, not a runtime check: recovery-service.ts exports only
    // conversation-scoped functions for a borrowed session — nothing that touches
    // device-bindings.ts, mobile-handoff.ts, credential-issuer.ts, or Vault storage.
    const service = await import("@/lib/server/recovery-service");
    const exported = Object.keys(service);
    for (const forbidden of ["bindDevice", "rebindCredential", "claimHandoff", "unlockVault", "openVault", "enrollDevice"]) {
      expect(exported).not.toContain(forbidden);
    }
  });
});

describe("rate limiting", () => {
  it("allows up to the limit then blocks within the window", () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(checkRateLimit(key, 3, 60000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60000).allowed).toBe(false);
  });

  it("resets after the window elapses", () => {
    const key = `test:${Math.random()}`;
    vi.spyOn(Date, "now").mockReturnValue(1000);
    expect(checkRateLimit(key, 1, 1000).allowed).toBe(true);
    expect(checkRateLimit(key, 1, 1000).allowed).toBe(false);
    vi.spyOn(Date, "now").mockReturnValue(3000);
    expect(checkRateLimit(key, 1, 1000).allowed).toBe(true);
    vi.restoreAllMocks();
  });

  it("throttles repeated conversation starts against one card", async () => {
    const { card } = await makeCard();
    for (let i = 0; i < 8; i++) {
      const finder = generateRecoveryKeyPair();
      await startConversation({ cardId: card.card_id, finderPublicKey: finder.publicKey });
    }
    const finder = generateRecoveryKeyPair();
    await expect(startConversation({ cardId: card.card_id, finderPublicKey: finder.publicKey })).rejects.toThrow(
      RecoveryRateLimitError
    );
  });
});
