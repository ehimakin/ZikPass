/**
 * Lost-phone recovery card + E2E recovery messaging.
 *
 * The server only ever stores hashes of owner/session secrets and ciphertext
 * message bodies. It never sees an owner secret, a channel verify code, a
 * borrowed-device session token, a message's plaintext, or a recovery
 * passphrase. Two separate secrets are involved and neither is emailed:
 * `owner_secret` is a random device-bound capability (like the affiliate
 * pairing tokens elsewhere in this app) that authorizes managing the card;
 * the recovery passphrase (never persisted anywhere, chosen by the owner)
 * protects the long-term messaging key via the same envelope construction
 * Vault already uses (`lib/shared/vault/crypto.ts`) — wrap once, unwrap
 * locally on whichever device is replying, borrowed or not.
 */

import type { VaultKeyEnvelopeV2 } from "@/lib/shared/vault/crypto";

export type { VaultKeyEnvelopeV2 as RecoveryKeyEnvelope } from "@/lib/shared/vault/crypto";

/** Wire-safe form of Vault's SealedCell (whose ciphertext is a raw Uint8Array, unsuitable for JSON storage/transport): both fields base64url via lib/shared/vault's encode/decode. */
export type SealedKeyWire = { iv: string; ciphertext: string };

export type NotificationChannel = {
  kind: "email";
  address: string;
  verify_code_hash?: string;
  verify_expires_at?: string;
  verify_attempts: number;
  verified_at?: string;
};

export type PublicReturnDetails = {
  note?: string;
  address?: string;
};

export type RecoveryCard = {
  card_id: string;
  owner_secret_hash: string;
  /**
   * Long-term X25519 public key for recovery messaging, generated once at
   * card setup. Its secret half is never stored in plaintext, on the server
   * or any device — only `recovery_key_envelope` below, wrapping it under
   * the owner's recovery passphrase. Any device (trusted or borrowed) that
   * knows the passphrase can unwrap it locally and reply. Rotating this key
   * (setup again) only re-keys future conversations — it cannot revoke
   * access already taken from an unwrapped copy, and old conversations stay
   * readable only with the old key.
   */
  owner_public_key: string;
  /**
   * Vault's own envelope construction, reused as-is: `recovery_key_envelope`
   * wraps a random AES-256 KEK under the recovery passphrase (PBKDF2), and
   * `recovery_key_sealed` is the X25519 secret key sealed under that KEK
   * (same `seal`/`open` used for Vault documents — the DEK just protects 32
   * bytes of key material here instead of a file). Both are ciphertext only;
   * the server can store but never unwrap either.
   */
  recovery_key_envelope: VaultKeyEnvelopeV2;
  recovery_key_sealed: SealedKeyWire;
  channel?: NotificationChannel;
  public_return_details?: PublicReturnDetails;
  created_at: string;
  revoked_at?: string;
  replaced_by_card_id?: string;
};

export type RecoveryConversationStatus = "open" | "ended" | "blocked";

export type RecoveryConversation = {
  conversation_id: string;
  card_id: string;
  finder_public_key: string;
  /** Snapshotted from the card's owner_public_key at creation, so a later key rotation doesn't strand this transcript. */
  owner_public_key: string;
  /** Single-use bearer, hashed; lets a borrowed device exchange it for a BorrowedSession. Cleared once a session is issued. */
  reply_token_hash?: string;
  status: RecoveryConversationStatus;
  created_at: string;
  last_message_at: string;
  reported_at?: string;
};

export type RecoveryMessageSender = "finder" | "owner";

export type RecoveryMessage = {
  message_id: string;
  conversation_id: string;
  sender: RecoveryMessageSender;
  ciphertext: string;
  nonce: string;
  sent_at: string;
};

export type BorrowedSession = {
  session_token_hash: string;
  conversation_id: string;
  created_at: string;
  expires_at: string;
  ended_at?: string;
};

/** The finder's own bearer session, minted when they start a conversation. Same shape as BorrowedSession, longer TTL — the finder isn't the party the brief restricts. */
export type FinderSession = {
  session_token_hash: string;
  conversation_id: string;
  created_at: string;
  expires_at: string;
};

export type PublicRecoveryCard = {
  card_id: string;
  public_return_details?: PublicReturnDetails;
  revoked: boolean;
};

export function publicCard(card: RecoveryCard): PublicRecoveryCard {
  return {
    card_id: card.card_id,
    public_return_details: card.public_return_details,
    revoked: Boolean(card.revoked_at)
  };
}
