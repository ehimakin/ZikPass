"use client";

import { generateKeyPair, signString } from "@/lib/shared/crypto/ed25519";
import type { ExportedKeyPair } from "@/lib/shared/crypto/ed25519";
import type { PresentationBundle, SignedCredential, WalletState } from "@/lib/shared/types";

const DB_NAME = "zik-pass-wallet";
const DB_VERSION = 1;
const STORE_NAME = "wallet";
const PRIMARY_KEY = "primary";
const LEGACY_STORAGE_KEY = "zik-pass-wallet";

interface WalletRecord {
  id: string;
  state: WalletState;
}

export async function loadWalletState(): Promise<WalletState> {
  if (typeof window === "undefined") {
    return {};
  }

  await migrateLegacyWalletIfPresent();
  const db = await openWalletDatabase();
  const record = await readRecord(db, PRIMARY_KEY);
  return normalizeWalletState(record?.state);
}

export async function saveWalletState(state: WalletState): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const db = await openWalletDatabase();
  await writeRecord(db, {
    id: PRIMARY_KEY,
    state: normalizeWalletState(state)
  });
}

export async function ensureHolderKeyPair(existing?: WalletState): Promise<WalletState> {
  const wallet = normalizeWalletState(existing ?? (await loadWalletState()));

  if (wallet.holderKeyPair) {
    return wallet;
  }

  let keyPair: ExportedKeyPair;

  try {
    keyPair = await generateKeyPair();
  } catch (error) {
    if (!canUseDevelopmentKeyFallback()) {
      throw error;
    }

    keyPair = await requestDevelopmentKeyPair();
  }

  const nextWallet: WalletState = {
    ...wallet,
    holderKeyPair: keyPair
  };
  await saveWalletState(nextWallet);
  return nextWallet;
}

function canUseDevelopmentKeyFallback(): boolean {
  // Some mobile browsers expose a secure context but still do not implement Ed25519.
  return process.env.NODE_ENV !== "production" && typeof window !== "undefined";
}

async function requestDevelopmentKeyPair(): Promise<ExportedKeyPair> {
  const response = await fetch("/api/wallet/holder-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  const data = (await response.json()) as ExportedKeyPair | { error?: string };

  if (!response.ok) {
    throw new Error(
      (data as { error?: string }).error ??
        "Unable to create a local demo holder key. Use HTTPS or localhost instead."
    );
  }

  return data as ExportedKeyPair;
}

export async function storeCredential(
  credential: SignedCredential,
  enrollmentId?: string
): Promise<WalletState> {
  const wallet = await loadWalletState();
  const nextWallet: WalletState = {
    ...wallet,
    credential,
    enrollmentId: enrollmentId ?? wallet.enrollmentId,
    localCredentialStoredAt: new Date().toISOString()
  };

  await saveWalletState(nextWallet);
  return nextWallet;
}

export async function storeEnrollmentId(enrollmentId: string): Promise<WalletState> {
  const wallet = await loadWalletState();
  const nextWallet: WalletState = {
    ...wallet,
    enrollmentId
  };
  await saveWalletState(nextWallet);
  return nextWallet;
}

export async function storeEnrollmentContext(
  input: {
    enrollmentId: string;
    enrollmentLane: WalletState["enrollmentLane"];
    physicalSessionId?: string;
  }
): Promise<WalletState> {
  const wallet = await loadWalletState();
  const nextWallet: WalletState = {
    ...wallet,
    enrollmentId: input.enrollmentId,
    enrollmentLane: input.enrollmentLane,
    physicalSessionId: input.physicalSessionId
  };
  await saveWalletState(nextWallet);
  return nextWallet;
}

export async function markPwaInstalled(): Promise<WalletState> {
  const wallet = await loadWalletState();
  const nextWallet: WalletState = {
    ...wallet,
    pwaInstalledAt: wallet.pwaInstalledAt ?? new Date().toISOString()
  };
  await saveWalletState(nextWallet);
  return nextWallet;
}

export async function claimPwaHandoff(token: string): Promise<WalletState> {
  const wallet = await ensureHolderKeyPair(await loadWalletState());
  const response = await fetch("/api/mobile/handoff/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      holderPublicKey: wallet.holderKeyPair?.publicKeyJwk
    })
  });
  const data = (await response.json()) as SignedCredential | { error?: string };

  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? "Unable to restore the ZikPass on this device.");
  }

  return storeCredential(data as SignedCredential, wallet.enrollmentId);
}

export async function createPresentationBundle(
  challenge: string,
  options?: {
    credentialOverride?: SignedCredential;
    wrongChallenge?: string;
  }
): Promise<PresentationBundle> {
  const wallet = await loadWalletState();

  if (!wallet.holderKeyPair?.privateKeyJwk || !wallet.credential) {
    throw new Error("This device does not currently hold both the Zik Pass credential and holder key.");
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

export async function removeHolderKeyPair(): Promise<WalletState> {
  const wallet = normalizeWalletState(await loadWalletState());
  const nextWallet: WalletState = {
    ...wallet,
    holderKeyPair: undefined
  };
  await saveWalletState(nextWallet);
  return nextWallet;
}

export async function clearWallet(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  // Future mobile wallets should swap this browser storage for secure device-backed key storage.
  await saveWalletState({});
}

function openWalletDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("This browser does not support IndexedDB, so Zik Pass cannot store a device-bound credential."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to open secure wallet storage."));
  });
}

function readRecord(db: IDBDatabase, id: string): Promise<WalletRecord | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result as WalletRecord | undefined);
      db.close();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("Unable to read local wallet storage."));
      db.close();
    };
  });
}

function writeRecord(db: IDBDatabase, record: WalletRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put(record);

    transaction.oncomplete = () => {
      resolve();
      db.close();
    };
    transaction.onerror = () => {
      reject(transaction.error ?? new Error("Unable to update local wallet storage."));
      db.close();
    };
  });
}

async function migrateLegacyWalletIfPresent(): Promise<void> {
  const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacyRaw) {
    return;
  }

  try {
    const legacyState = JSON.parse(legacyRaw) as WalletState;
    const currentState = await readExistingWalletWithoutMigration();

    if (!currentState.holderKeyPair && !currentState.credential && !currentState.enrollmentId) {
      await saveWalletState(normalizeWalletState(legacyState));
    }
  } finally {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}

async function readExistingWalletWithoutMigration(): Promise<WalletState> {
  const db = await openWalletDatabase();
  const record = await readRecord(db, PRIMARY_KEY);
  return normalizeWalletState(record?.state);
}

export function normalizeWalletState(input: unknown): WalletState {
  if (!input || typeof input !== "object") {
    return {};
  }

  const candidate = input as Partial<WalletState>;
  const nextState: WalletState = {};

  if (candidate.enrollmentId && typeof candidate.enrollmentId === "string") {
    nextState.enrollmentId = candidate.enrollmentId;
  }

  if (candidate.enrollmentLane === "remote" || candidate.enrollmentLane === "physical") {
    nextState.enrollmentLane = candidate.enrollmentLane;
  }

  if (candidate.physicalSessionId && typeof candidate.physicalSessionId === "string") {
    nextState.physicalSessionId = candidate.physicalSessionId;
  }

  if (candidate.localCredentialStoredAt && typeof candidate.localCredentialStoredAt === "string") {
    nextState.localCredentialStoredAt = candidate.localCredentialStoredAt;
  }

  if (candidate.pwaInstalledAt && typeof candidate.pwaInstalledAt === "string") {
    nextState.pwaInstalledAt = candidate.pwaInstalledAt;
  }

  if (hasKeyPair(candidate.holderKeyPair)) {
    nextState.holderKeyPair = candidate.holderKeyPair;
  }

  if (hasSignedCredential(candidate.credential)) {
    nextState.credential = candidate.credential;
  }

  return nextState;
}

function hasKeyPair(value: WalletState["holderKeyPair"] | unknown): value is NonNullable<WalletState["holderKeyPair"]> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as WalletState["holderKeyPair"];
  return Boolean(candidate?.publicKeyJwk && candidate.privateKeyJwk);
}

function hasSignedCredential(value: WalletState["credential"] | unknown): value is NonNullable<WalletState["credential"]> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as WalletState["credential"];
  return Boolean(
    candidate?.payload &&
      typeof candidate.zignature === "string" &&
      candidate.algorithm === "Ed25519" &&
      typeof candidate.payload.credential_id === "string" &&
      typeof candidate.payload.issued_at === "string" &&
      typeof candidate.payload.activates_at === "string" &&
      typeof candidate.payload.expires_at === "string" &&
      candidate.payload.subject_public_key
  );
}
