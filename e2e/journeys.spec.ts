import { test, expect } from "@playwright/test";
import {
  CLERK_TOKEN,
  resetDemo,
  chooseStore,
  readCustomerCode,
  clerkAct,
  clerkConfirm,
  payWithSimulator,
  enrollmentIdFromWallet
} from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

test("self-directed: discover a store, get verified, pay, receive a pass", async ({ page, request }) => {
  await page.goto("/find");
  await page.getByLabel(/postcode or area/i).fill("EC1");
  await expect(page.getByText(/Showing stores near/i)).toBeVisible();
  await chooseStore(page, "zik-london-003");

  await page.getByRole("button", { name: /^Start/ }).click();
  const code = await readCustomerCode(page);

  await clerkConfirm(request, code, "zik-london-003");

  await expect(page.getByText(/ID check confirmed/i)).toBeVisible({ timeout: 15_000 });
  await payWithSimulator(page, "success");

  await expect(page.getByRole("heading", { name: /Your pass is ready/i })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: /Open my pass/i }).click();
  await expect(page.getByText("18+ verified")).toBeVisible();
  await expect(page.getByText(/zp_/)).toBeVisible();
});

test("clerk-first purchase sale: till payment, customer activates, one payment", async ({ page, request }) => {
  const headers = {
    "x-zik-retailer-token": CLERK_TOKEN,
    "x-zik-store-id": "zik-london-001",
    "Content-Type": "application/json"
  };
  const started = await request
    .post("/api/purchase-sale", { headers, data: { action: "start" } })
    .then((r) => r.json());
  await request.post("/api/purchase-sale", {
    headers,
    data: { action: "confirm_id", sessionId: started.id }
  });
  const paid = await request
    .post("/api/purchase-sale", {
      headers,
      data: { action: "confirm_payment", sessionId: started.id, method: "cash" }
    })
    .then((r) => r.json());
  const token = paid.token ?? started.token;

  await page.goto(`/card#activate=${encodeURIComponent(token)}`);
  await page.getByRole("button", { name: /Save my Zik Pass/i }).click();

  await expect(page.getByRole("heading", { name: /Your pass is ready/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /Zik demo checkout/i })).toHaveCount(0);

  const enrollmentId = await enrollmentIdFromWallet(page);
  const { payments } = await request.get(`/api/payments/${enrollmentId}`).then((r) => r.json());
  const passPayments = payments.filter((p: { purpose: string }) => p.purpose === "pass_issuance");
  expect(passPayments).toHaveLength(1);
  expect(passPayments[0].status).toBe("confirmed");
  expect(passPayments[0].method).toBe("cash_in_store");
});

test("payment declined, then retried successfully - no premature issuance", async ({ page, request }) => {
  await page.goto("/get-pass?store_id=zik-london-001");
  await page.getByRole("button", { name: /^Start/ }).click();
  const code = await readCustomerCode(page);
  await clerkConfirm(request, code, "zik-london-001");
  await expect(page.getByText(/ID check confirmed/i)).toBeVisible({ timeout: 15_000 });

  await payWithSimulator(page, "decline");
  await expect(page.getByText(/declined/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Your pass is ready/i })).toHaveCount(0);

  await payWithSimulator(page, "success");
  await expect(page.getByRole("heading", { name: /Your pass is ready/i })).toBeVisible({ timeout: 20_000 });
});

test("delete pass from this device returns to the empty state", async ({ page, request }) => {
  await page.goto("/get-pass?store_id=zik-london-001");
  await page.getByRole("button", { name: /^Start/ }).click();
  const code = await readCustomerCode(page);
  await clerkConfirm(request, code, "zik-london-001");
  await expect(page.getByText(/ID check confirmed/i)).toBeVisible({ timeout: 15_000 });
  await payWithSimulator(page, "success");
  await expect(page.getByRole("heading", { name: /Your pass is ready/i })).toBeVisible({ timeout: 20_000 });

  await page.goto("/pass");
  await expect(page.getByText("18+ verified")).toBeVisible();
  await page.getByText(/Remove this pass from this device/i).click();
  await page.getByRole("button", { name: /Delete pass from this device/i }).click();
  await page.getByRole("button", { name: /Yes, delete/i }).click();

  await expect(page.getByText(/No pass on this device yet/i)).toBeVisible();
});

test("cross-store clerk cannot look up another store's session", async ({ page, request }) => {
  await page.goto("/get-pass?store_id=zik-london-002"); // Camden
  await page.getByRole("button", { name: /^Start/ }).click();
  const code = await readCustomerCode(page);

  const { lookup } = await clerkAct(request, code, "zik-london-005"); // Brixton terminal
  expect(lookup.status()).toBe(400);
  expect(await lookup.text()).toMatch(/not authorised for the requested store session/i);

  // The right store still works.
  await clerkConfirm(request, code, "zik-london-002");
});
