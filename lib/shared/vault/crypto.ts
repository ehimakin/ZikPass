import { boundedString, decode, encode, strictObject, utf8 } from '@/lib/shared/vault';

/**
 * Vault v2 key hierarchy. The passphrase derives a key-encryption key (KEK) that
 * only ever wraps a random data-encryption key (DEK); every record is sealed
 * under the DEK with its own nonce and its own identity as additional data.
 *
 * Why not v1's "derive straight from the passphrase per write": a Vault now holds
 * document bytes, so re-deriving 600k PBKDF2 rounds for each of many records, on
 * every edit, is not workable on a phone. Wrapping one DEK keeps a passphrase
 * change to a single rewrap and keeps lock/zeroise to dropping one key.
 *
 * What this does NOT do: it does not persist the passphrase or the DEK, and it is
 * not protected by device biometrics. Unlocking always needs the passphrase again.
 */
export const VAULT_KDF_ITERATIONS = 600000;

export type VaultKeyEnvelopeV2 = {
  version: 2;
  kdf: 'PBKDF2-SHA256';
  iterations: typeof VAULT_KDF_ITERATIONS;
  salt: string;
  wrap_iv: string;
  wrapped_key: string;
  created_at: string;
};

export type SealedCell = { iv: string; ciphertext: Uint8Array };

const WRAP_CONTEXT = utf8(JSON.stringify(['zik-vault-key', 2, 'PBKDF2-SHA256', VAULT_KDF_ITERATIONS]));

export function parseKeyEnvelope(value: unknown): VaultKeyEnvelopeV2 {
  const r = strictObject(value, ['version', 'kdf', 'iterations', 'salt', 'wrap_iv', 'wrapped_key', 'created_at']);
  if (r.version !== 2 || r.kdf !== 'PBKDF2-SHA256' || r.iterations !== VAULT_KDF_ITERATIONS) throw new Error('unsupported_version');
  if (typeof r.created_at !== 'string' || !Number.isFinite(Date.parse(r.created_at))) throw new Error('invalid_schema');
  decode(r.salt, 16); decode(r.wrap_iv, 12); decode(r.wrapped_key, 32, 64);
  return r as VaultKeyEnvelopeV2;
}

async function deriveKek(secret: string, salt: string): Promise<CryptoKey> {
  if (secret.length < 12 || secret.length > 1024) throw new Error('invalid_secret');
  const bytes = utf8(secret);
  try {
    const material = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey']);
    return await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: decode(salt, 16), iterations: VAULT_KDF_ITERATIONS }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  } finally { bytes.fill(0); }
}

async function importDek(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as unknown as BufferSource, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Creates a fresh DEK and the envelope that protects it. The raw DEK never leaves this call. */
export async function createKeyEnvelope(secret: string, now = new Date()): Promise<{ envelope: VaultKeyEnvelopeV2; key: CryptoKey }> {
  const salt = encode(crypto.getRandomValues(new Uint8Array(16)));
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const raw = crypto.getRandomValues(new Uint8Array(32));
  try {
    const kek = await deriveKek(secret, salt);
    const wrapped = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: wrapIv, additionalData: WRAP_CONTEXT, tagLength: 128 }, kek, raw as unknown as BufferSource));
    return {
      envelope: { version: 2, kdf: 'PBKDF2-SHA256', iterations: VAULT_KDF_ITERATIONS, salt, wrap_iv: encode(wrapIv), wrapped_key: encode(wrapped), created_at: now.toISOString() },
      key: await importDek(raw),
    };
  } finally { raw.fill(0); }
}

export async function openKeyEnvelope(value: unknown, secret: string): Promise<CryptoKey> {
  const envelope = parseKeyEnvelope(value);
  const kek = await deriveKek(secret, envelope.salt);
  const raw = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(envelope.wrap_iv, 12), additionalData: WRAP_CONTEXT, tagLength: 128 }, kek, decode(envelope.wrapped_key, 32, 64)));
  try { return await importDek(raw); } finally { raw.fill(0); }
}

/** Changing the passphrase rewraps the same DEK, so stored records are untouched. */
export async function rewrapKeyEnvelope(value: unknown, currentSecret: string, nextSecret: string, now = new Date()): Promise<VaultKeyEnvelopeV2> {
  const envelope = parseKeyEnvelope(value);
  const kek = await deriveKek(currentSecret, envelope.salt);
  const raw = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(envelope.wrap_iv, 12), additionalData: WRAP_CONTEXT, tagLength: 128 }, kek, decode(envelope.wrapped_key, 32, 64)));
  try {
    const salt = encode(crypto.getRandomValues(new Uint8Array(16)));
    const wrapIv = crypto.getRandomValues(new Uint8Array(12));
    const nextKek = await deriveKek(nextSecret, salt);
    const wrapped = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: wrapIv, additionalData: WRAP_CONTEXT, tagLength: 128 }, nextKek, raw as unknown as BufferSource));
    return { version: 2, kdf: 'PBKDF2-SHA256', iterations: VAULT_KDF_ITERATIONS, salt, wrap_iv: encode(wrapIv), wrapped_key: encode(wrapped), created_at: now.toISOString() };
  } finally { raw.fill(0); }
}

/**
 * Binds a record to its slot: ciphertext moved to another store, id or schema
 * version fails to open rather than silently decrypting somewhere it never belonged.
 */
export function recordContext(store: string, id: string): Uint8Array {
  return utf8(JSON.stringify(['zik-vault-record', 2, boundedString(store, 32), boundedString(id, 128)]));
}

export async function seal(key: CryptoKey, store: string, id: string, plaintext: Uint8Array): Promise<SealedCell> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: recordContext(store, id) as unknown as BufferSource, tagLength: 128 }, key, plaintext as unknown as BufferSource));
  return { iv: encode(iv), ciphertext };
}

export async function open(key: CryptoKey, store: string, id: string, cell: SealedCell): Promise<Uint8Array> {
  if (!(cell?.ciphertext instanceof Uint8Array) || cell.ciphertext.byteLength < 16) throw new Error('invalid_schema');
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(cell.iv, 12) as unknown as BufferSource, additionalData: recordContext(store, id) as unknown as BufferSource, tagLength: 128 }, key, cell.ciphertext as unknown as BufferSource));
}

export async function sealJson(key: CryptoKey, store: string, id: string, value: unknown): Promise<SealedCell> {
  const bytes = utf8(JSON.stringify(value));
  try { return await seal(key, store, id, bytes); } finally { bytes.fill(0); }
}

export async function openJson(key: CryptoKey, store: string, id: string, cell: SealedCell): Promise<unknown> {
  const bytes = await open(key, store, id, cell);
  try { return JSON.parse(new TextDecoder().decode(bytes)); } finally { bytes.fill(0); }
}

/** Exact-duplicate detection only. Two documents with the same hash are the same bytes, nothing more. */
export async function contentHash(bytes: Uint8Array): Promise<string> {
  return encode(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)));
}

export function randomId(): string { return encode(crypto.getRandomValues(new Uint8Array(16))); }
