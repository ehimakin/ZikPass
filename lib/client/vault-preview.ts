export type VaultOutcome = "success" | "failure" | "demo";

/** Visual prototype boundary only. No storage, crypto, authentication or network calls.
 * Replace this adapter when a production validation contract is available.
 */
export async function validateMockVaultKey(key: string, signal: AbortSignal): Promise<VaultOutcome> {
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 350);
    signal.addEventListener("abort", abort, { once: true });
  });
  if (process.env.NODE_ENV === "development" && key === "memaguy") return "demo";
  return key.trim().toUpperCase() === "OPEN" ? "success" : "failure";
}
