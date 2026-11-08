import { generateMnemonic, mnemonicToSeed, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { base64UrlToBytes, bytesToBase64Url, stableStringify } from '@/lib/shared/utils';
import type { ExportedKeyPair } from '@/lib/shared/crypto/ed25519';
import type { RecoveryCiphertext, RecoveryRequest } from './types';

const utf8 = (value: string) => new TextEncoder().encode(value);
export function generateRecoveryPhrase(): string { return generateMnemonic(wordlist, 256); }
export function normalizeRecoveryPhrase(value: string): string {
  const phrase = value.normalize('NFKD').trim().toLowerCase().split(/\s+/).join(' ');
  if (phrase.split(' ').length !== 24 || !validateMnemonic(phrase, wordlist)) throw new Error('Enter all 24 recovery words in order. Check the spelling.');
  return phrase;
}
export async function recoveryKeys(value: string): Promise<{ id: string; signing: ExportedKeyPair; encryption: CryptoKey }> {
  const seed = await mnemonicToSeed(normalizeRecoveryPhrase(value));
  const signingSeed = hkdf(sha256, seed, utf8('zik-account-recovery-v1'), utf8('authorization'), 32);
  const encryptionBytes = hkdf(sha256, seed, utf8('zik-account-recovery-v1'), utf8('backup-encryption'), 32);
  try {
    const publicBytes = ed25519.getPublicKey(signingSeed);
    const publicKeyJwk: JsonWebKey = { kty: 'OKP', crv: 'Ed25519', x: bytesToBase64Url(publicBytes) };
    return {
      id: bytesToBase64Url(sha256(utf8(`zik-recovery-id-v1:${publicKeyJwk.x}`))),
      signing: { publicKeyJwk, privateKeyJwk: { ...publicKeyJwk, d: bytesToBase64Url(signingSeed) } },
      encryption: await crypto.subtle.importKey('raw', new Uint8Array(encryptionBytes), 'AES-GCM', false, ['encrypt', 'decrypt'])
    };
  } finally { seed.fill(0); signingSeed.fill(0); encryptionBytes.fill(0); }
}
export function recoverySigningText(request: RecoveryRequest): string {
  return `zik-account-recovery-v1\n${stableStringify(request)}`;
}
export async function encryptBackup(key: CryptoKey, id: string, value: unknown): Promise<RecoveryCiphertext> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = utf8(JSON.stringify(value));
  try {
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: utf8(`zik-backup-v1:${id}`) }, key, bytes);
    return { version: 1, iv: bytesToBase64Url(iv), ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)) };
  } finally { bytes.fill(0); }
}
export async function decryptBackup(key: CryptoKey, id: string, backup: RecoveryCiphertext): Promise<unknown> {
  if (backup.version !== 1) throw new Error('Unsupported recovery backup version.');
  const bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(base64UrlToBytes(backup.iv)), additionalData: utf8(`zik-backup-v1:${id}`) }, key, new Uint8Array(base64UrlToBytes(backup.ciphertext))));
  try { return JSON.parse(new TextDecoder().decode(bytes)); } finally { bytes.fill(0); }
}
