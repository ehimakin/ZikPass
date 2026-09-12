/** Device-only profile contract. Never add this to WalletState or enrollment types. */
export type SelfEntered = { value: string; provenance: 'self_entered'; updated_at: string };
export type VaultProfileV1 = { version: 1; legal_name: SelfEntered; delivery_address: SelfEntered; email?: SelfEntered };
export const PROFILE_FIELDS = ['legal_name', 'delivery_address', 'email'] as const;
export type ProfileField = typeof PROFILE_FIELDS[number];
export function strictObject(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_schema');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(k => !required.includes(k) && !optional.includes(k)) || required.some(k => !(k in record))) throw new Error('invalid_schema');
  return record;
}
export function boundedString(value: unknown, max = 512): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('invalid_schema');
  return value;
}
export function selfEntered(value: unknown): SelfEntered {
  const r = strictObject(value, ['value', 'provenance', 'updated_at']);
  if (r.provenance !== 'self_entered' || typeof r.updated_at !== 'string' || !Number.isFinite(Date.parse(r.updated_at))) throw new Error('invalid_schema');
  return { value: boundedString(r.value), provenance: 'self_entered', updated_at: r.updated_at };
}
export function parseProfile(value: unknown): VaultProfileV1 {
  const r = strictObject(value, ['version', 'legal_name', 'delivery_address'], ['email']);
  if (r.version !== 1) throw new Error('unsupported_version');
  return { version: 1, legal_name: selfEntered(r.legal_name), delivery_address: selfEntered(r.delivery_address), ...(r.email === undefined ? {} : { email: selfEntered(r.email) }) };
}
export function encode(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export function decode(value: unknown, min: number, max = min): Uint8Array<ArrayBuffer> {
  const s = boundedString(value, Math.ceil(max * 4 / 3) + 4);
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('invalid_encoding');
  const bytes = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  if (bytes.length < min || bytes.length > max || encode(bytes) !== s) throw new Error('invalid_encoding');
  return bytes;
}
export const utf8 = (value: string) => new TextEncoder().encode(value);
export type VaultEnvelopeV1 = { version: 1; kdf: 'PBKDF2-SHA256'; iterations: 600000; salt: string; iv: string; ciphertext: string };
export function parseVaultEnvelope(value: unknown): VaultEnvelopeV1 {
  const r = strictObject(value, ['version', 'kdf', 'iterations', 'salt', 'iv', 'ciphertext']);
  if (r.version !== 1 || r.kdf !== 'PBKDF2-SHA256' || r.iterations !== 600000) throw new Error('unsupported_version');
  decode(r.salt, 16); decode(r.iv, 12); decode(r.ciphertext, 16, 8192);
  return r as VaultEnvelopeV1;
}
function context(e: Omit<VaultEnvelopeV1, 'ciphertext'>): Uint8Array<ArrayBuffer> {
  return utf8(JSON.stringify(['zik-vault', e.version, e.kdf, e.iterations, e.salt, e.iv]));
}
async function derive(secret: string, salt: string): Promise<CryptoKey> {
  if (secret.length < 12 || secret.length > 1024) throw new Error('invalid_secret');
  const bytes = utf8(secret);
  try {
    const material = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey']);
    return await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: decode(salt, 16), iterations: 600000 }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  } finally { bytes.fill(0); }
}
export async function encryptVault(profile: unknown, secret: string): Promise<VaultEnvelopeV1> {
  const e = { version: 1, kdf: 'PBKDF2-SHA256', iterations: 600000, salt: encode(crypto.getRandomValues(new Uint8Array(16))), iv: encode(crypto.getRandomValues(new Uint8Array(12))) } as const;
  const key = await derive(secret, e.salt);
  const bytes = utf8(JSON.stringify(parseProfile(profile)));
  try { return { ...e, ciphertext: encode(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: decode(e.iv, 12), additionalData: context(e), tagLength: 128 }, key, bytes))) }; }
  finally { bytes.fill(0); }
}
export async function decryptVault(value: unknown, secret: string): Promise<VaultProfileV1> {
  const e = parseVaultEnvelope(value);
  const key = await derive(secret, e.salt);
  const bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(e.iv, 12), additionalData: context(e), tagLength: 128 }, key, decode(e.ciphertext, 16, 8192)));
  try { return parseProfile(JSON.parse(new TextDecoder().decode(bytes))); } finally { bytes.fill(0); }
}
