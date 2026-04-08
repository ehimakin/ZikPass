"use client";

import { generateKeyPair, signString } from "@/lib/shared/crypto/ed25519";
import type { PresentationBundle, SignedCredential, WalletState } from "@/lib/shared/types";

const WALLET_STORAGE_KEY = "zik-pass-wallet";

export function loadWalletState(): WalletState {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.localStorage.getItem(WALLET_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as WalletState;
  } catch {
    return {};
  }
}

export function saveWalletState(state: WalletState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(state));
}

export async function ensureHolderKeyPair(existing?: WalletState): Promise<WalletState> {
  const wallet = existing ?? loadWalletState();

  if (wallet.holderKeyPair) {
    return wallet;
  }

  const keyPair = await generateKeyPair();
  const nextWallet = { ...wallet, holderKeyPair: keyPair };
  saveWalletState(nextWallet);
  return nextWallet;
}

export function storeCredential(credential: SignedCredential, enrollmentId?: string): WalletState {
  const wallet = loadWalletState();
  const nextWallet = {
    ...wallet,
    credential,
    enrollmentId: enrollmentId ?? wallet.enrollmentId
  };

  saveWalletState(nextWallet);
  return nextWallet;
}

export function storeEnrollmentId(enrollmentId: string): WalletState {
  const wallet = loadWalletState();
  const nextWallet = { ...wallet, enrollmentId };
  saveWalletState(nextWallet);
  return nextWallet;
}

export async function createPresentationBundle(
  challenge: string,
  options?: {
    credentialOverride?: SignedCredential;
    wrongChallenge?: string;
  }
): Promise<PresentationBundle> {
  const wallet = loadWalletState();

  if (!wallet.holderKeyPair?.privateKeyJwk || !wallet.credential) {
    throw new Error("Wallet does not have a holder keypair and credential yet.");
  }

  const signedChallenge = options?.wrongChallenge ?? challenge;
  const holderSignature = await signString(wallet.holderKeyPair.privateKeyJwk, signedChallenge);

  return {
    credential: options?.credentialOverride ?? wallet.credential,
    challenge,
    holder_signature: holderSignature,
    holder_algorithm: "Ed25519",
    presented_at: new Date().toISOString()
  };
}

export function clearWallet(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(WALLET_STORAGE_KEY);
}
