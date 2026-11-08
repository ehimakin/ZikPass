import { x25519 } from "@noble/curves/ed25519.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { toUtf8Bytes } from "@/lib/shared/utils";
import { decode, encode } from "@/lib/shared/vault";
import type { SealedCell } from "@/lib/shared/vault/crypto";
import type { SealedKeyWire } from "@/lib/shared/recovery/types";

/**
 * End-to-end encryption for one recovery conversation. Both sides (finder,
 * owner, or a borrowed-device dashboard holding the owner's share) generate
 * an ephemeral X25519 keypair locally; the server only ever relays the two
 * public keys and ciphertext. X25519 + HKDF-SHA256 + XChaCha20-Poly1305, all
 * from the audited @noble family already used for the device key in mobile/.
 * base64url via lib/shared/vault's encode/decode — browser-safe (btoa/atob),
 * not Buffer, since this module runs in the finder's and owner's browsers.
 */

const HKDF_INFO = toUtf8Bytes("zik-recovery-conversation-v1");
const PUBLIC_KEY_BYTES = 32;
const NONCE_BYTES = 24;
const MAX_CIPHERTEXT_BYTES = 24000;

export type RecoveryKeyPair = { publicKey: string; secretKey: Uint8Array };

export function generateRecoveryKeyPair(): RecoveryKeyPair {
  const secretKey = x25519.utils.randomSecretKey();
  return { publicKey: encode(x25519.getPublicKey(secretKey)), secretKey };
}

/** Binds the shared secret to this conversation: a key derived for one conversation cannot open another. */
function deriveConversationKey(secretKey: Uint8Array, peerPublicKey: string, conversationId: string): Uint8Array {
  const shared = x25519.getSharedSecret(secretKey, decode(peerPublicKey, PUBLIC_KEY_BYTES));
  return hkdf(sha256, shared, toUtf8Bytes(conversationId), HKDF_INFO, 32);
}

export type SealedMessage = { ciphertext: string; nonce: string };

export function sealMessage(
  secretKey: Uint8Array,
  peerPublicKey: string,
  conversationId: string,
  plaintext: string
): SealedMessage {
  const key = deriveConversationKey(secretKey, peerPublicKey, conversationId);
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const ciphertext = xchacha20poly1305(key, nonce, toUtf8Bytes(conversationId)).encrypt(toUtf8Bytes(plaintext));
  return { ciphertext: encode(ciphertext), nonce: encode(nonce) };
}

export function openMessage(
  secretKey: Uint8Array,
  peerPublicKey: string,
  conversationId: string,
  message: SealedMessage
): string {
  const key = deriveConversationKey(secretKey, peerPublicKey, conversationId);
  const plaintext = xchacha20poly1305(key, decode(message.nonce, NONCE_BYTES), toUtf8Bytes(conversationId)).decrypt(
    decode(message.ciphertext, 16, MAX_CIPHERTEXT_BYTES)
  );
  return new TextDecoder().decode(plaintext);
}

/** Converts Vault's SealedCell (raw Uint8Array ciphertext) to/from the base64url wire form used for storage and transport. */
export function sealedToWire(cell: SealedCell): SealedKeyWire {
  return { iv: cell.iv, ciphertext: encode(cell.ciphertext) };
}

export function wireToSealed(wire: SealedKeyWire): SealedCell {
  return { iv: wire.iv, ciphertext: decode(wire.ciphertext, 16, MAX_CIPHERTEXT_BYTES) };
}
