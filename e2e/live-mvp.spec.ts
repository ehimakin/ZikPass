import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });
test("finance preview survives reload and appears in the wallet", async ({ page }) => {
  await page.goto("/prove-with-finance-check");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: "/tmp/zik-payment-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Confirm test payment" }).click();
  await expect(page.getByText("Your pass is on its way")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Your pass is on its way")).toBeVisible();
  await page.getByRole("link", { name: "Open wallet", exact: true }).click();
  await expect(page.getByText("Approved. In your wallet.")).toBeVisible({ timeout: 35000 });
  await expect(page.getByText("Your proof of age belongs here")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Finance-check preview" })).toBeVisible();
  await expect(page.getByText("Your preview pass is saved on this device.", { exact: false })).toBeVisible();
  await page.screenshot({ path: "/tmp/zik-wallet-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("physical card stays store-first", async ({ page }) => {
  await page.goto("/shop");
  await expect(page.getByRole("link", { name: "Find a participating store" })).toBeVisible();
  await expect(page.getByText("Complete demo checkout")).toHaveCount(0);
  await page.getByRole("link", { name: "Find a participating store" }).click();
  await expect(page.getByText("The first locations are on their way.")).toBeVisible();
});

test("home and Vault fit a phone", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const route of ["/home", "/vault", "/ecosystem", "/help", "/id", "/validate"]) {
    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (route === "/home") await page.screenshot({ path: "/tmp/zik-home-mobile.png" });
  }
  expect(errors).toEqual([]);
});

test("payment sheet keeps keyboard focus while progress refreshes", async ({ page }) => {
  await page.goto("/prove-with-finance-check");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  const confirm = page.getByRole("button", { name: "Confirm test payment" });
  await confirm.focus();
  await page.waitForTimeout(1500);
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("digital acquisition is free in person and separate from finance", async ({ page }) => {
  await page.goto("/get-pass");
  await expect(page.getByText("Digital Zik Pass · 99p one-off, free during Early Access. Get verified in person.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Choose a store", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to payment" })).toHaveCount(0);
  await page.goto("/get-pass?store_id=zik-london-001");
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  await expect(page.getByText("You pay nothing and your pass is issued to this phone.", { exact: false })).toBeVisible();
  await page.goto("/ecosystem");
  for (const price of ["99p one-off · Free during Early Access", "£2.99 · Keep your card for life", "35p/month", "99p/month", "£1.99 one-off", "From £5.99 · Depends on the document", "£3.99 one-off"]) {
    await expect(page.getByText(price, { exact: true })).toBeVisible();
  }
});
