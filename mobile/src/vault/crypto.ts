import { gcm } from '@noble/ciphers/aes.js';
export function seal(key: Uint8Array, nonce: Uint8Array, bytes: Uint8Array, context: string): Uint8Array {
  if (key.length !== 32 || nonce.length !== 12) throw new Error('Invalid encryption parameters.');
  const encrypted = gcm(key, nonce, new TextEncoder().encode(context)).encrypt(bytes);
  const result = new Uint8Array(13 + encrypted.length);
  result[0] = 1; result.set(nonce, 1); result.set(encrypted, 13); return result;
}
export function unseal(key: Uint8Array, value: Uint8Array, context: string): Uint8Array {
  if (value[0] !== 1 || value.length < 29) throw new Error('The saved file is damaged or unsupported.');
  return gcm(key, value.slice(1, 13), new TextEncoder().encode(context)).decrypt(value.slice(13));
}
