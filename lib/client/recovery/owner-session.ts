import { createKeyEnvelope, openKeyEnvelope, seal, open } from "@/lib/shared/vault/crypto";
import { encode } from "@/lib/shared/vault";
import { generateRecoveryKeyPair, sealedToWire, wireToSealed } from "@/lib/shared/recovery/crypto";
import { clearLocalCard, loadLocalCard, saveLocalCard } from "@/lib/client/recovery/local";
import * as api from "@/lib/client/recovery/api";
import type { OwnerCardView } from "@/lib/client/recovery/api";

const KEY_LABEL = "recovery-messaging-key";

function randomOwnerSecret(): string {
  return encode(crypto.getRandomValues(new Uint8Array(32)));
}

/**
 * Sets up a new card end to end: generates the device-bound owner_secret
 * (never typed, never shown), a fresh X25519 messaging keypair, and seals
 * its secret half under a recovery-passphrase-derived KEK using Vault's own
 * envelope + seal construction (createKeyEnvelope wraps a random AES key
 * under the passphrase; seal() then encrypts the 32 raw X25519 bytes under
 * that key, exactly like a Vault document). The server receives only
 * ciphertext and a hash of owner_secret — never the passphrase or the key.
 */
export async function setUpCard(recoveryPassphrase: string, replacesCardId?: string): Promise<OwnerCardView> {
  const ownerSecret = randomOwnerSecret();
  const { publicKey, secretKey } = generateRecoveryKeyPair();

  try {
    const { envelope, key } = await createKeyEnvelope(recoveryPassphrase);
    const sealed = await seal(key, KEY_LABEL, publicKey, secretKey);

    const card = await api.createCard({
      ownerSecret,
      ownerPublicKey: publicKey,
      recoveryKeyEnvelope: envelope,
      recoveryKeySealed: sealedToWire(sealed),
      replacesCardId
    });
    await saveLocalCard({ cardId: card.card_id, ownerSecret });
    return card;
  } finally {
    secretKey.fill(0);
  }
}

export async function loadOwnedCard(): Promise<OwnerCardView | undefined> {
  const local = await loadLocalCard();
  if (!local) return undefined;
  return api.getOwnerCard(local.cardId, local.ownerSecret);
}

export async function currentOwnerSecret(): Promise<{ cardId: string; ownerSecret: string } | undefined> {
  return loadLocalCard();
}

export async function forgetLocalCard(): Promise<void> {
  await clearLocalCard();
}

/** Unwraps the messaging secret key using the recovery passphrase. Never persisted — callers hold it in memory only for the reply session. */
export async function unwrapMessagingKey(
  envelope: OwnerCardView["recovery_key_envelope"],
  sealed: OwnerCardView["recovery_key_sealed"],
  ownerPublicKey: string,
  passphrase: string
): Promise<Uint8Array> {
  const key = await openKeyEnvelope(envelope, passphrase);
  return open(key, KEY_LABEL, ownerPublicKey, wireToSealed(sealed));
}
