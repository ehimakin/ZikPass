import { test, expect } from '@playwright/test';

test('Wallet is the credential home and opens the existing pass view', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Wallet', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Wallet' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('Not added', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Get Zik Pass', exact: true })).toHaveAttribute('href', '/find');
  await expect(page.getByRole('link', { name: 'Go to Vault', exact: true })).toHaveAttribute('href', '/vault');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('link', { name: 'Open Zik Pass', exact: true }).click();
  await expect(page).toHaveURL(/\/pass$/);
  await expect(page.getByRole('heading', { name: 'My pass', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Wallet' }).click();
  await expect(page).toHaveURL(/\/wallet$/);
});

test('Wallet preserves installed-app handoff routing', async ({ request }) => {
  const response = await request.get('/wallet?source=pwa&handoff_token=test-token', { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe('/pass?source=pwa&handoff_token=test-token');
});

test('Wallet shows the saved credential status', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zik-pass-wallet', JSON.stringify({ credential: {
      algorithm: 'Ed25519', zignature: 'test-only', payload: {
        credential_id: 'wallet-test', issued_at: new Date(Date.now() - 2000).toISOString(),
        activates_at: new Date(Date.now() - 1000).toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString(),
        subject_public_key: { kty: 'OKP', crv: 'Ed25519', x: 'test' }
      }
    } }));
  });
  await page.goto('/wallet');
  await expect(page.getByText('Active', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Zik Pass', exact: true })).toHaveAttribute('href', '/pass');
  await expect(page.getByRole('link', { name: 'Get Zik Pass', exact: true })).toHaveCount(0);
});
