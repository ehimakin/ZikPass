import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import type { SignedCredential } from '../../lib/shared/types';
import { stableStringify } from '../../lib/shared/canonical-json';
import { bytesToBase64Url, base64UrlToBytes } from './encoding';
import { requireOrigin } from './config';
import { validCredential } from './credential-policy';

ed.hashes.sha512 = sha512;
const PRIVATE_KEY_STORAGE = 'zikpass.native.ed25519.private-key';
const CREDENTIAL_STORAGE = 'zikpass.native.credential';
const ISSUER_STORAGE = 'zikpass.native.issuer-key';
const PRODUCT_STORAGE = 'zikpass.native.product';
const protectedKey = { requireAuthentication: true, keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, authenticationPrompt: 'Confirm with Zik' };
const localOnly = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
export type NativePass = { credential: SignedCredential; physicalCard: boolean };
let claiming: Promise<SignedCredential> | null = null;

async function issuerKey(): Promise<JsonWebKey> {
  const response = await fetch(`${requireOrigin()}/api/config/public-key`);
  if (!response.ok) throw new Error('Could not verify the issuer. Try again when online.');
  const data = await response.json();
  const key = data.issuer_public_key as JsonWebKey;
  if (key?.kty !== 'OKP' || key.crv !== 'Ed25519' || !key.x || !/^[A-Za-z0-9_-]{43}$/.test(key.x) || key.d) throw new Error('Invalid issuer key.');
  return key;
}
function verify(credential: unknown, key: JsonWebKey): asserts credential is SignedCredential {
  if (!validCredential(credential) || !key.x || !ed.verify(base64UrlToBytes(credential.zignature), new TextEncoder().encode(stableStringify(credential.payload)), base64UrlToBytes(key.x))) throw new Error('This pass could not be verified. Nothing was imported.');
}
export async function loadNativePass(): Promise<NativePass | null> {
  const raw = await SecureStore.getItemAsync(CREDENTIAL_STORAGE);
  if (!raw) return null;
  const savedIssuer = await SecureStore.getItemAsync(ISSUER_STORAGE);
  // Migrate the original scaffold only after verifying against the configured issuer.
  const key = savedIssuer ? JSON.parse(savedIssuer) as JsonWebKey : await issuerKey();
  const credential: unknown = JSON.parse(raw); verify(credential, key);
  if (!savedIssuer) await SecureStore.setItemAsync(ISSUER_STORAGE, JSON.stringify(key), localOnly);
  return { credential, physicalCard: await SecureStore.getItemAsync(PRODUCT_STORAGE) === 'physical_card' };
}
export async function loadNativeCredential(): Promise<SignedCredential | null> { return (await loadNativePass())?.credential ?? null; }
export async function authenticateWallet(): Promise<void> {
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Open your Zik Card', biometricsSecurityLevel: 'strong' });
  if (!result.success) throw new Error('Unlock cancelled.');
}
export function claimHandoff(token: string): Promise<SignedCredential> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return Promise.reject(new Error('This activation link is invalid.'));
  if (claiming) return Promise.reject(new Error('A pass is already being linked.'));
  claiming = claim(token).finally(() => { claiming = null; });
  return claiming;
}
async function claim(token: string): Promise<SignedCredential> {
  await authenticateWallet();
  const existing = await SecureStore.getItemAsync(CREDENTIAL_STORAGE);
  if (existing) throw new Error('This phone already has a pass. Open Card to view it.');
  const holderPublicKey = await getOrCreateHolderPublicKey();
  const response = await fetch(`${requireOrigin()}/api/mobile/handoff/claim`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, holderPublicKey })
  });
  if (!response.ok) { const result = await response.json(); throw new Error(result.error ?? 'Could not link this pass.'); }
  const value: unknown = await response.json();
  const key = await issuerKey(); verify(value, key);
  if (value.payload.subject_public_key.x !== holderPublicKey.x) throw new Error('This pass belongs to another device.');
  await SecureStore.setItemAsync(ISSUER_STORAGE, JSON.stringify(key), localOnly);
  await SecureStore.setItemAsync(PRODUCT_STORAGE, response.headers.get('X-Zik-Product') === 'physical_card' ? 'physical_card' : 'digital', localOnly);
  await SecureStore.setItemAsync(CREDENTIAL_STORAGE, JSON.stringify(value), localOnly);
  return value;
}
async function getOrCreateHolderPublicKey(): Promise<JsonWebKey> {
  const saved = await SecureStore.getItemAsync(PRIVATE_KEY_STORAGE, protectedKey);
  const bytes = saved ? base64UrlToBytes(saved) : Crypto.getRandomBytes(32);
  try {
    if (!saved) await SecureStore.setItemAsync(PRIVATE_KEY_STORAGE, bytesToBase64Url(bytes), protectedKey);
    return { kty: 'OKP', crv: 'Ed25519', x: bytesToBase64Url(ed.getPublicKey(bytes)) };
  } finally { bytes.fill(0); }
}
