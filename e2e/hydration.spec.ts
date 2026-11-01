import { test, expect } from '@playwright/test';

test('root layout hydrates without nonce attribute mismatches', async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error' && /hydrat|server rendered HTML/i.test(message.text())) hydrationErrors.push(message.text());
  });
  page.on('pageerror', error => {
    if (/hydrat/i.test(error.message)) hydrationErrors.push(error.message);
  });
  for (const route of ['/home', '/dashboard/store/login']) {
    await page.goto(route);
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Site menu', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  }
  expect(hydrationErrors).toEqual([]);
});
