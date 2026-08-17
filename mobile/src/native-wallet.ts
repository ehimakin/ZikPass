import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as ed from "@noble/ed25519";
import type { SignedCredential } from "../../lib/shared/types";

const PRIVATE_KEY_STORAGE = "zikpass.native.ed25519.private-key";
const CREDENTIAL_STORAGE = "zikpass.native.credential";
const API_ORIGIN = process.env.EXPO_PUBLIC_ZIK_API_ORIGIN ?? "http://localhost:3000";

export async function claimHandoff(token: string): Promise<SignedCredential> {
  const holderPublicKey = await getOrCreateHolderPublicKey();
  const response = await fetch(`${API_ORIGIN}/api/mobile/handoff/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, holderPublicKey })
  });
  const data = (await response.json()) as SignedCredential | { error?: string };

  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? "Unable to claim this ZikPass.");
  }

  const credential = data as SignedCredential;
  await SecureStore.setItemAsync(CREDENTIAL_STORAGE, JSON.stringify(credential));
  return credential;
}

export async function loadNativeCredential(): Promise<SignedCredential | null> {
  const value = await SecureStore.getItemAsync(CREDENTIAL_STORAGE);
  return value ? (JSON.parse(value) as SignedCredential) : null;
}

export async function authenticateWallet(): Promise<void> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock your ZikPass",
    biometricsSecurityLevel: "strong",
    disableDeviceFallback: false
  });

  if (!result.success) {
    throw new Error("Device authentication was not completed.");
  }

  await SecureStore.getItemAsync(PRIVATE_KEY_STORAGE, { requireAuthentication: true });
}

async function getOrCreateHolderPublicKey(): Promise<JsonWebKey> {
  const storedPrivateKey = await SecureStore.getItemAsync(PRIVATE_KEY_STORAGE, {
    requireAuthentication: true
  });
  const privateKey = storedPrivateKey ? base64UrlToBytes(storedPrivateKey) : await createPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  if (!storedPrivateKey) {
    await SecureStore.setItemAsync(PRIVATE_KEY_STORAGE, bytesToBase64Url(privateKey), {
      requireAuthentication: true
    });
  }

  return {
    kty: "OKP",
    crv: "Ed25519",
    x: bytesToBase64Url(publicKey)
  };
}

async function createPrivateKey(): Promise<Uint8Array> {
  return Crypto.getRandomBytesAsync(32);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
