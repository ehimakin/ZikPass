import { expect, test } from "@playwright/test";

test("physical card demo checkout persists a pending card without activating a pass", async ({ page }) => {
  await page.goto("/shop");
  await page.getByRole("button", { name: "Review demo purchase" }).click();
  await page.getByRole("button", { name: "Complete demo checkout" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("Wallet now shows a demo card");
  await page.getByRole("link", { name: "Back to Wallet" }).click();
  const card = page.getByRole("img", { name: "Zik Card: demo purchase, awaiting receipt and activation" });
  await expect(card).toHaveClass(/zk-physical-card--pending/);
  await expect(card).toHaveCSS("opacity", "0.55");
  await expect(page.getByText("Pass: Not added", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Purchase physical pass" })).toHaveCount(0);
  await page.reload();
  await expect(card).toBeVisible();
  await expect(page.getByRole("main").getByRole("status")).toContainText("no card will be shipped");
});

test("tracker concept checkout does not create a pending physical card", async ({ page }) => {
  await page.goto("/shop");
  await page.getByRole("radio", { name: /Zik Card Tracker/ }).check();
  await page.getByRole("button", { name: "Review tracker demo" }).click();
  await page.getByRole("button", { name: "Complete demo checkout" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("Your wallet is unchanged");
  await page.getByRole("link", { name: "Back to Wallet" }).click();
  await expect(page.getByRole("link", { name: "Purchase physical pass" })).toBeVisible();
  await expect(page.locator(".zk-physical-card--pending")).toHaveCount(0);
});
