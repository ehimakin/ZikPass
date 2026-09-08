import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const CLERK_TOKEN = "demo-retail-terminal";

/** Reset all transient runtime state (demo-gated). */
export async function resetDemo(request: APIRequestContext) {
  const res = await request.post("/api/demo/reset");
  expect(res.ok()).toBeTruthy();
}

/** The store-finder list card for a given store id. */
export function storeCard(page: Page, storeId: string) {
  return page.locator(`[data-testid="store-card"][data-store-id="${storeId}"]`);
}

/** Pick a store from the finder and land on the onboarding screen. */
export async function chooseStore(page: Page, storeId: string) {
  await storeCard(page, storeId).click();
  await page.getByRole("button", { name: /Choose this store/i }).click();
  await expect(page).toHaveURL(/\/get-pass/);
}

/** Read the 6-char customer code shown on the onboarding screen. */
export async function readCustomerCode(page: Page): Promise<string> {
  const codeEl = page.getByText(/^[A-Z0-9]{6}$/).first();
  await expect(codeEl).toBeVisible({ timeout: 15_000 });
  const code = (await codeEl.textContent())?.trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  return code!;
}

interface ClerkResult {
  lookup: Awaited<ReturnType<APIRequestContext["post"]>>;
  verify?: Awaited<ReturnType<APIRequestContext["post"]>>;
}

/** Act as the store clerk: look up the code, then optionally confirm/reject. */
export async function clerkAct(
  request: APIRequestContext,
  code: string,
  storeId: string,
  decision?: "confirm" | "reject"
): Promise<ClerkResult> {
  const headers = {
    "x-zik-retailer-token": CLERK_TOKEN,
    "x-zik-store-id": storeId,
    "Content-Type": "application/json"
  };
  const lookup = await request.post("/api/physical/sessions/lookup", {
    headers,
    data: { userCode: code }
  });
  if (!decision || !lookup.ok()) return { lookup };
  const verify = await request.post("/api/physical/sessions/verify", {
    headers,
    data: { userCode: code, decision }
  });
  return { lookup, verify };
}

/** Convenience: clerk looks up + confirms, asserting success. */
export async function clerkConfirm(request: APIRequestContext, code: string, storeId: string) {
  const { lookup, verify } = await clerkAct(request, code, storeId, "confirm");
  expect(lookup.ok(), await lookup.text()).toBeTruthy();
  expect(verify!.ok(), await verify!.text()).toBeTruthy();
}

/** Run the demo-checkout simulator to a chosen outcome (opens the sheet if needed). */
export async function payWithSimulator(page: Page, outcome: "success" | "decline") {
  const dialog = page.getByRole("dialog", { name: /demo checkout/i });
  if (!(await dialog.isVisible())) {
    await page.getByRole("button", { name: /Zik demo checkout/i }).click();
    await expect(dialog).toBeVisible();
  }
  if (outcome === "success") {
    await dialog.getByRole("button", { name: /^Pay / }).click();
  } else {
    await dialog.getByRole("button", { name: /Simulate a declined card/i }).click();
  }
}

/** The enrollment id stored in this browser's wallet (IndexedDB). */
export async function enrollmentIdFromWallet(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open("zik-pass-wallet", 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rec = await new Promise<{ state?: { enrollmentId?: string } } | undefined>((res) => {
      const tx = db.transaction("wallet", "readonly").objectStore("wallet").get("primary");
      tx.onsuccess = () => res(tx.result);
    });
    return rec?.state?.enrollmentId ?? "";
  });
}
