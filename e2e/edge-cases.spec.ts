import { test, expect } from "@playwright/test";
import { resetDemo, storeCard, chooseStore, readCustomerCode, clerkConfirm, payWithSimulator } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

test("location denied: manual search still completes", async ({ page, context }) => {
  await context.clearPermissions(); // geolocation not granted
  await page.goto("/find");
  await page.getByRole("button", { name: /Use my location/i }).click();
  // Whatever the geolocation outcome, manual search must still work.
  await page.getByLabel(/postcode or area/i).fill("W1");
  await expect(page.getByText(/Showing stores near/i)).toBeVisible();
  await expect(storeCard(page, "zik-london-001")).toBeVisible();
});

test("no search match shows guidance, list still works", async ({ page }) => {
  await page.goto("/find");
  await page.getByLabel(/postcode or area/i).fill("ZZ99");
  await expect(page.getByText(/No match for that postcode/i)).toBeVisible();
  await expect(storeCard(page, "zik-london-001")).toBeVisible();
});

test("unknown route shows the branded 404", async ({ page }) => {
  const res = await page.goto("/definitely-not-a-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /Page not found/i })).toBeVisible();
  await page.getByRole("link", { name: /Go to home/i }).click();
  await expect(page).toHaveURL(/\/home/);
});

test("affiliate: honest 'no pass' path when the device has none", async ({ page }) => {
  await page.goto("/affiliate-demo");
  await page.getByRole("button", { name: /^Verify with Zik$/i }).click();
  await expect(page).toHaveURL(/affiliate-demo\/confirm/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /No Zik Pass found/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open my pass/i })).toBeVisible();
});

test("affiliate: approve with an active pass opens the gated site", async ({ page, request }) => {
  await page.goto("/find");
  await page.getByLabel(/postcode or area/i).fill("W1");
  await chooseStore(page, "zik-london-001");
  await page.getByRole("button", { name: /^Start/ }).click();
  const code = await readCustomerCode(page);
  await clerkConfirm(request, code, "zik-london-001");
  await expect(page.getByText(/ID check confirmed/i)).toBeVisible({ timeout: 15_000 });
  await payWithSimulator(page, "success");
  await expect(page.getByRole("heading", { name: /Your pass is ready/i })).toBeVisible({ timeout: 20_000 });

  await page.goto("/affiliate-demo");
  await page.getByRole("button", { name: /^Verify with Zik$/i }).click();
  await expect(page).toHaveURL(/affiliate-demo\/confirm/, { timeout: 15_000 });
  await page.getByRole("button", { name: /Confirm I.?m over 18/i }).click();

  // Bounces through /callback back to /affiliate-demo, now verified.
  await expect(page.getByText(/Age verified with Zik/i)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: /Continue \/ Log in/i }).click();
  await expect(page).toHaveURL(/affiliate-demo\/continue/, { timeout: 15_000 });

  // The site only ever holds the age result - never identity fields.
  await expect(page.getByText(/date of birth|passport number|document number/i)).toHaveCount(0);
});
