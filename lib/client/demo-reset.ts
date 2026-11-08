"use client";

import { clearWallet } from "./wallet-client";
import { indexedVaultStorage } from "./vault-adapter";
import { destroyDatabase } from "./vault/store";
import { isDemoEnvironment } from "@/lib/shared/demo-environment";

/** Reset only Zik demo data, never unrelated browser storage or app caches. */
export async function resetDemoData(): Promise<void> {
  if (!isDemoEnvironment) throw new Error("Demo reset is unavailable in this environment.");
  const response = await fetch("/api/demo/reset", { method: "POST" });
  if (!response.ok) throw new Error("The server reset failed. Your local data has not been cleared. Please try again.");
  const result = await response.json();
  if (result.ok !== true) throw new Error("The server did not confirm the reset. Your local data has not been cleared.");
  try {
    // Remove the legacy copy first so it cannot repopulate the cleared wallet.
    for (const key of ["zik-pass-wallet", "zikpass-selected-store", "zikpass-operator-store", "zik-vault-onboarding", "jerkmeat-saved"]) {
      localStorage.removeItem(key);
    }
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("zik-purchase-sale:")) sessionStorage.removeItem(key);
    }
    await clearWallet();
    await indexedVaultStorage.remove();
    // The v2 Vault holds documents, extracted text, claims and applications; the whole
    // database goes, so nothing can reappear through a later migration or restore.
    await destroyDatabase();
    document.cookie = "zikpass-home-splash-seen=; Max-Age=0; Path=/; SameSite=Lax";
  } catch {
    throw new Error("The server was reset, but some data on this browser could not be cleared. Please retry before starting another demo.");
  }
}
