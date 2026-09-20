import { test, expect } from "@playwright/test";

test("demo dashboard supports keyboard simulation and mobile layout", async ({ page }) => {
  await page.goto("/affiliates/dashboard-demo");
  await expect(page.getByRole("heading", { name: "Your place in the pool." })).toBeVisible();
  await expect(page.getByText("Demo — illustrative data", { exact: true }).first()).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to dashboard" })).toBeFocused();
  const affiliates = page.getByRole("slider", { name: "Additional affiliates" });
  await affiliates.focus();
  await page.keyboard.press("End");
  await expect(affiliates).toHaveValue("800");
  await expect(page.locator('[aria-live="polite"]')).toContainText("£6.60");
  await page.getByRole("slider", { name: "Eligible gross revenue" }).focus();
  await page.keyboard.press("Home");
  await expect(page.locator('[aria-live="polite"]')).toContainText("£0.00");
  await page.getByRole("button", { name: "Reset simulation" }).click();
  await expect(affiliates).toHaveValue("0");
  await expect(page.locator('[aria-live="polite"]')).toContainText("£33.00");
  await page.screenshot({ path: "/tmp/zik-affiliate-dashboard-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("heading", { name: "Your place in the pool." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/zik-affiliate-dashboard-mobile.png", fullPage: true });
  await expect(page.getByRole("heading", { name: "The Zik product family" })).toBeVisible();
});
