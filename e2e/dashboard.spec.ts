import { test, expect } from '@playwright/test';

test('dashboard exposes four workspaces and protects staff actions', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Your dashboard' })).toBeVisible();
  for (const name of ['Customer', 'Affiliate site', 'Partner store', 'Zik admin']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await page.goto('/verify?code=123456');
  await expect(page).toHaveURL(/\/dashboard\/store\/login\?next=verify&code=123456/);
  await expect(page.getByRole('heading', { name: 'Store sign-in' })).toBeVisible();
  await page.goto('/issuer');
  await expect(page).toHaveURL(/\/dashboard\/admin$/);
});

test('old store links retain the requested action', async ({ page }) => {
  await page.goto('/store?next=/verify/purchase');
  await expect(page).toHaveURL(/\/dashboard\/store\/login/);
  await expect(page.getByRole('heading', { name: 'Store sign-in' })).toBeVisible();
});

test('shared navigation is present exactly once across public and dashboard pages', async ({ page }) => {
  for (const path of ['/home', '/find', '/dashboard', '/dashboard/store/login', '/dashboard/customer', '/dashboard/affiliate', '/dashboard/admin', '/onboarding']) {
    await page.goto(path);
    await expect(page.getByRole('navigation', { name: 'Primary', exact: true })).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Primary', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Zik Pass home', exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('navigation', { name: 'Site menu', exact: true }).getByRole('link', { name: /Dashboard/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('navigation', { name: 'Primary', exact: true })).toHaveCount(1);
});

test('store login keeps shared navigation visible while scrolling on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard/store/login');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toBeInViewport();
  await expect(page.getByRole('navigation', { name: 'Primary', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Site menu', exact: true })).toBeVisible();
});
